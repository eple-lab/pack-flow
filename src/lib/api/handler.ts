/**
 * 라우트 공통 처리 — CSRF → 로그인 확인 → JSON 파싱 → 스키마 검사 → 실행 → 오류 변환.
 *
 * 하는 일
 * 1. 변경 요청(GET 외)은 X-PF · Origin을 먼저 검사한다(403 PF_CSRF). 로그인 여부와 상관없이 먼저다.
 * 2. 사용자 JWT 클라이언트로 로그인 확인(401 PF_UNAUTHENTICATED). user_id는 여기서만 얻고 요청 본문에서 받지 않는다(원칙 3).
 * 3. 본문은 JSON만, 100KB까지(깨지면 400 PF_VALIDATION field "body"). 스키마(`schema`)로 검사 · 정규화하고
 *    실패는 `{field, reason, min, max}` detail로 돌려준다. 쿼리는 `query` 스키마로 같은 방식.
 * 4. `run`이 던진 PfError는 코드의 HTTP로, Supabase 오류 모양은 코드로, 그 밖의 예외는 500 PF_INTERNAL로 바꾼다.
 *    원문은 응답에 없고 서버 로그에만 남는다(errors.ts).
 * 5. 모든 응답에 `Cache-Control: no-store`. 성공은 `{data}`, 실패는 `{error:{code,message,detail}}`(04 1절).
 *
 * 근거: docs/04-api-contract.md 1 · 2 · 4.1, docs/05-security.md 3절, WU-03 4번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 라우트 공통 handler (WU-03)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { parseJsonText, parseWith } from '@/lib/validation/detail';
import type { ApiSuccessBody } from '@/types/erp';
import { checkCsrf } from './csrf';
import { errorResult, toErrorResult, type ErrorResult } from './errors';

/** 로그인한 사용자. 이메일은 응답 · 로그에 함부로 싣지 않는다. */
export type AuthUser = { id: string; email: string | null };

/** `run`이 받는 것. */
export type HandlerContext<TBody, TQuery, TParams> = {
  request: Request;
  /** 사용자 JWT 클라이언트(서비스 키 아님) */
  supabase: SupabaseClient;
  /** 로그인 필수 라우트(기본)에서는 항상 있다. `requireUser: false`면 null일 수 있다 */
  user: AuthUser | null;
  /** schema로 검사 · 정규화한 본문. schema를 안 주면 undefined */
  body: TBody;
  /** query 스키마로 검사한 쿼리. 안 주면 undefined */
  query: TQuery;
  /** 경로 파라미터(`{id}` 등) — 형식 검사는 라우트가 uuidParam 등으로 한다 */
  params: TParams;
};

/** `run`의 결과: 상태 코드(기본 200, 생성은 201)와 `data`. */
export type HandlerResult = { data: unknown; status?: 200 | 201 };

export type HandlerOptions<TBody, TQuery, TParams> = {
  /** 본문 스키마. 주면 본문을 JSON으로 읽어 검사한다 */
  schema?: z.ZodType<TBody>;
  /** 쿼리 스키마(GET 목록의 status · limit 등) */
  query?: z.ZodType<TQuery>;
  /** 기본 true. 로그아웃처럼 로그인 없이도 부를 라우트만 false */
  requireUser?: boolean;
  run: (ctx: HandlerContext<TBody, TQuery, TParams>) => Promise<HandlerResult>;
  /** 테스트에서 가짜 Supabase를 주입한다. 기본은 쿠키 기반 서버 클라이언트 */
  getSupabase?: () => Promise<SupabaseClient>;
};

/** Next 16 라우트 핸들러의 두 번째 인자(params는 Promise). */
type RouteContext<TParams> = { params?: Promise<TParams> };

function respond(result: ErrorResult): Response {
  return Response.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
}

function ok(result: HandlerResult): Response {
  const body: ApiSuccessBody<unknown> = { data: result.data };
  return Response.json(body, { status: result.status ?? 200, headers: { 'Cache-Control': 'no-store' } });
}

/** URL 쿼리를 객체로(같은 이름이 여러 번이면 마지막 값). */
function queryObject(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) out[key] = value;
  return out;
}

/**
 * 라우트 핸들러를 만든다. 던지는 오류는 모두 `{error}` 응답으로 바뀌므로 `run` 안에서는 `throw new PfError(...)`만 쓰면 된다.
 *
 * 사용 예 (src/app/api/purchases/route.ts):
 * ```ts
 * export const POST = createHandler({
 *   schema: purchaseCreate,            // 04 4.2 스키마 — 계약에 없는 필드는 400
 *   run: async ({ supabase, body }) => {
 *     const purchase = await createPurchase(supabase, { ...body, source: 'form' }); // 재고 판정은 DB 함수
 *     return { data: purchase, status: 201 };
 *   },
 * });
 * ```
 * 경로 파라미터가 있으면 `export const POST = createHandler<Body, undefined, { id: string }>({...})`.
 *
 * @returns `(request, routeContext) => Response` — Next 라우트 핸들러로 그대로 export
 * 오류 코드: PF_CSRF(403) · PF_UNAUTHENTICATED(401) · PF_VALIDATION(400) · run이 던진 코드 · PF_INTERNAL(500)
 */
export function createHandler<TBody = undefined, TQuery = undefined, TParams = Record<string, string>>(
  options: HandlerOptions<TBody, TQuery, TParams>,
) {
  const { schema, query, requireUser = true, run, getSupabase = createServerSupabase } = options;

  return async function handler(request: Request, routeContext?: RouteContext<TParams>): Promise<Response> {
    try {
      // 1. CSRF — 로그인 확인보다 먼저(남의 사이트가 보낸 요청은 로그인 여부도 알려 주지 않는다)
      if (!checkCsrf(request)) return respond(errorResult('PF_CSRF'));

      // 2. 로그인 확인 — 쿠키 세션의 JWT 클레임(sub)이 있어야 한다
      const supabase = await getSupabase();
      let user: AuthUser | null = null;
      const { data } = await supabase.auth.getClaims();
      const claims = data?.claims;
      if (claims && typeof claims.sub === 'string' && claims.sub !== '') {
        user = { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null };
      }
      if (requireUser && !user) return respond(errorResult('PF_UNAUTHENTICATED'));

      // 3. 본문 JSON 파싱 + 스키마 검사
      let body: TBody = undefined as TBody;
      if (schema) {
        const parsedJson = parseJsonText(await request.text());
        if (!parsedJson.ok) return respond(errorResult('PF_VALIDATION', parsedJson.detail));
        const checked = parseWith(schema, parsedJson.data);
        if (!checked.ok) return respond(errorResult('PF_VALIDATION', checked.detail));
        body = checked.data;
      }

      // 3b. 쿼리 검사
      let parsedQuery: TQuery = undefined as TQuery;
      if (query) {
        const checked = parseWith(query, queryObject(request));
        if (!checked.ok) return respond(errorResult('PF_VALIDATION', checked.detail));
        parsedQuery = checked.data;
      }

      // 4. 실행
      const params = (routeContext?.params ? await routeContext.params : {}) as TParams;
      const result = await run({ request, supabase, user, body, query: parsedQuery, params });
      return ok(result);
    } catch (thrown) {
      // 모르는 예외는 PF_INTERNAL로 — 원문은 errors.ts가 로그에만 남긴다
      return respond(toErrorResult(thrown));
    }
  };
}
