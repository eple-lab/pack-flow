/**
 * 오류 코드 → HTTP 상태 · 한국어 문구 · 응답 본문 변환, Supabase 오류 해석.
 *
 * 하는 일
 * 1. 04 2절 표의 HTTP 상태와 04 4.4 표의 문구를 한곳에 둔다(문구를 새로 짓지 않는다). {from} 같은 자리는 detail 값으로 채운다.
 * 2. DB 함수 예외는 PostgREST에서 `message`=코드(PF_…), `details`=JSON 문자열로 온다. 이를 `{error:{code,message,detail}}`로 바꾼다.
 * 3. 모르는 오류(코드가 목록에 없음 · 화면 전용 PF_NETWORK/PF_TIMEOUT 포함)는 PF_INTERNAL 500으로 바꾸고
 *    원문은 응답에 넣지 않는다 — 원문은 log.ts를 거쳐 서버 로그에만 남는다(WU-03 9번, 05 로그 규칙).
 *
 * 근거: docs/04-api-contract.md 1 · 2 · 4.4, docs/03-data-model.md 4절, WU-03 4 · 9번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — HTTP · 문구 매핑 · Supabase 오류 변환 · PfError (WU-03)
 */
import { log } from '@/lib/log';
import {
  CLIENT_ERROR_CODES,
  SERVER_ERROR_CODES,
  type ApiErrorBody,
  type PfErrorCode,
  type ServerErrorCode,
} from '@/types/erp';

/** 서버 코드 → HTTP 상태(04 2절). */
export const HTTP_STATUS: Record<ServerErrorCode, number> = {
  PF_UNAUTHENTICATED: 401,
  PF_CSRF: 403,
  PF_NOT_FOUND: 404,
  PF_VALIDATION: 400,
  PF_INVALID_TRANSITION: 409,
  PF_INSUFFICIENT_STOCK: 409,
  PF_DUPLICATE_INVOICE: 409,
  PF_DUPLICATE_SKU: 409,
  PF_QUOTA_EXCEEDED: 429,
  PF_LLM_UNAVAILABLE: 503,
  PF_NOT_IMPLEMENTED: 501,
  PF_INTERNAL: 500,
};

/** 코드 → 화면에 보이는 문구(04 4.4 표 그대로). `{ }`는 detail 값으로 채운다. 화면 전용 코드도 여기 있다. */
export const PF_MESSAGES: Record<PfErrorCode, string> = {
  PF_UNAUTHENTICATED: '로그인이 필요해요. 다시 로그인해 주세요',
  PF_CSRF: '요청을 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요',
  PF_NOT_FOUND: '찾을 수 없어요. 목록을 새로고침해 주세요',
  PF_VALIDATION: '입력값을 확인해 주세요',
  PF_INVALID_TRANSITION: '지금 상태({from})에서는 {to}(으)로 바꿀 수 없어요',
  PF_INSUFFICIENT_STOCK: '재고가 부족해요. {sku_id} 남은 수량 {stock_qty}개',
  PF_DUPLICATE_INVOICE: '이미 등록된 송장번호예요 ({invoice_no})',
  PF_DUPLICATE_SKU: '이미 있는 품목코드예요 ({sku_id})',
  // [#83 bug] 앱 상한은 한국 시간 자정에 풀리는데 '오후 5시'(Gemini 할당량 기준)로 안내함 → 04 4.4대로 '자정'으로 고침 (eple)
  PF_QUOTA_EXCEEDED: '오늘 AI 사용 한도를 다 썼어요. 한국 시간 자정 이후 다시 쓸 수 있어요',
  PF_LLM_UNAVAILABLE: 'AI가 지금 응답하지 않아요. 잠시 뒤 다시 시도해 주세요 (입출고는 그대로 쓸 수 있어요)',
  PF_NOT_IMPLEMENTED: '아직 준비 중인 기능이에요',
  PF_INTERNAL: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  PF_NETWORK: '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요',
  PF_TIMEOUT: '응답이 늦어요. 잠시 뒤 다시 시도해 주세요 (배포 서버가 깨어나는 중일 수 있어요)',
};

/** detail에 값이 없을 때 자리에 채우는 글자(원문 `{from}`이 화면에 그대로 보이지 않게). */
const MISSING_VALUE = '—';

/** 문자열이 서버가 돌려줄 수 있는 코드인가(화면 전용 코드는 서버 응답에 없으므로 제외). */
export function isServerErrorCode(value: unknown): value is ServerErrorCode {
  return typeof value === 'string' && (SERVER_ERROR_CODES as readonly string[]).includes(value);
}

/** 문자열이 04 2절의 코드(화면 전용 포함)인가. */
export function isPfErrorCode(value: unknown): value is PfErrorCode {
  return isServerErrorCode(value) || (typeof value === 'string' && (CLIENT_ERROR_CODES as readonly string[]).includes(value));
}

/**
 * 코드의 문구를 만든다. `{from}` 같은 자리를 detail 값으로 바꾼다.
 * @param detail 코드마다 다른 detail(04 2절). 없는 값은 `—`
 */
export function messageFor(code: PfErrorCode, detail?: Record<string, unknown> | null): string {
  return PF_MESSAGES[code].replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = detail?.[key];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : MISSING_VALUE;
  });
}

/** 변환 결과: 응답 상태 코드와 본문. */
export type ErrorResult = { status: number; body: ApiErrorBody };

/**
 * 오류 코드 하나를 응답(상태 + `{error:{code,message,detail}}`)으로 만든다.
 * PF_INTERNAL에는 detail을 싣지 않는다(내부 사정 노출 방지).
 * @param code 서버 코드 (화면 전용 PF_NETWORK · PF_TIMEOUT은 서버가 못 보낸다)
 */
export function errorResult(code: ServerErrorCode, detail?: Record<string, unknown> | null): ErrorResult {
  const hasDetail = code !== 'PF_INTERNAL' && detail != null && Object.keys(detail).length > 0;
  return {
    status: HTTP_STATUS[code],
    body: {
      error: {
        code,
        message: messageFor(code, detail),
        ...(hasDetail ? { detail: detail as Record<string, unknown> } : {}),
      },
    },
  };
}

/**
 * 라우트 안에서 던지는 오류 — handler.ts가 잡아 응답으로 바꾼다.
 * 예: `throw new PfError('PF_NOT_FOUND')`
 */
export class PfError extends Error {
  readonly code: ServerErrorCode;
  readonly detail: Record<string, unknown> | null;

  constructor(code: ServerErrorCode, detail: Record<string, unknown> | null = null) {
    super(code);
    this.name = 'PfError';
    this.code = code;
    this.detail = detail;
  }
}

/** Supabase(PostgREST) 오류에서 우리가 읽는 칸 — message=코드, details=JSON 문자열. */
type SupabaseLikeError = { message?: unknown; details?: unknown; code?: unknown };

/** detail 문자열(JSON)을 일반 객체로 읽는다. 객체가 아니거나 JSON이 아니면 null. */
function parseDetail(details: unknown): Record<string, unknown> | null {
  let value: unknown = details;
  if (typeof details === 'string') {
    try {
      value = JSON.parse(details);
    } catch {
      return null;
    }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Supabase/PostgREST 오류를 응답으로 바꾼다.
 * `message`가 서버 코드(PF_…)면 그 코드, `details`가 JSON이면 detail로 쓴다.
 * 그 밖의 오류(모르는 코드 · 일반 DB 오류 · 화면 전용 코드)는 PF_INTERNAL이고 원문은 응답에 없다(서버 로그에만).
 * 부작용: 모르는 오류는 log.error로 가린 원문을 남긴다.
 */
export function fromSupabaseError(error: SupabaseLikeError): ErrorResult {
  const message = typeof error.message === 'string' ? error.message.trim() : '';
  if (isServerErrorCode(message)) return errorResult(message, parseDetail(error.details));
  log.error('api.unmapped_db_error', {
    code: 'PF_INTERNAL',
    pg_code: typeof error.code === 'string' ? error.code : null,
    cause: message,
  });
  return errorResult('PF_INTERNAL');
}

/**
 * 던져진 값 무엇이든 응답으로 바꾼다 — PfError · Supabase 오류 모양 · 그 밖(→ PF_INTERNAL).
 * 부작용: 모르는 오류는 log.error로 가린 원문을 남긴다.
 */
export function toErrorResult(thrown: unknown): ErrorResult {
  if (thrown instanceof PfError) return errorResult(thrown.code, thrown.detail);
  if (thrown !== null && typeof thrown === 'object' && 'message' in thrown) {
    return fromSupabaseError(thrown as SupabaseLikeError);
  }
  log.error('api.unexpected_throw', { code: 'PF_INTERNAL', cause: typeof thrown === 'string' ? thrown : typeof thrown });
  return errorResult('PF_INTERNAL');
}
