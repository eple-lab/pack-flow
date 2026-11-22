/**
 * GET /api/health — 서버와 DB가 살아 있는지 알려 준다(로그인 없이).
 *
 * 하는 일
 * 1. Supabase REST 주소에 짧게(3초) 요청해 DB 쪽에 닿는지만 본다. 응답 코드가 5xx가 아니면 닿은 것으로 본다.
 *    닿으면 200 `{status:"ok", db:"ok"}`, 못 닿으면 503 `{status:"degraded", db:"error"}`.
 * 2. 응답에 주소 · 키 · 오류 원문을 싣지 않는다. 사용자 데이터를 읽지 않는다(키는 공개 anon 키 헤더로만 쓴다).
 * 3. 로그인 · CSRF 검사가 필요 없는 읽기 전용이라 createHandler를 거치지 않는다. Render 상태 확인이 쓴다.
 *
 * 근거: docs/04-api-contract.md 3.1, WU-06 3번 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/health (WU-04)
 */
import { getPublicEnv } from '@/lib/env';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

const PROBE_TIMEOUT_MS = 3000;

/** DB(Supabase REST)에 닿는가. 닿으면 true. 부작용: 실패 사유를 코드만 로그에 남긴다. */
async function dbReachable(): Promise<boolean> {
  try {
    const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: supabaseAnonKey },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: 'no-store',
    });
    return response.status < 500;
  } catch (error) {
    log.warn('health.db_unreachable', { cause: error instanceof Error ? error.name : 'unknown' });
    return false;
  }
}

/** LLM 제공자 이름만 알려 준다(키는 읽지 않는다). 모르면 생략. */
function llmName(): string | undefined {
  const value = process.env.LLM_PROVIDER?.trim() || 'ollama';
  return ['gemini', 'ollama', 'fake'].includes(value) ? value : undefined;
}

/** 상태 확인. 200 `{data:{status,db,llm}}` 또는 503 `{data:{status:"degraded",db:"error",llm}}`. */
export async function GET() {
  const up = await dbReachable();
  const llm = llmName();
  return Response.json(
    { data: { status: up ? 'ok' : 'degraded', db: up ? 'ok' : 'error', ...(llm ? { llm } : {}) } },
    { status: up ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
