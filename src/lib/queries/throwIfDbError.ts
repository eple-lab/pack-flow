/**
 * Supabase 조회 오류를 PfError로 바꿔 던지는 작은 도우미.
 *
 * 하는 일
 * 1. 조회 결과의 error가 있으면 errors.ts의 fromSupabaseError로 코드를 정해 PfError로 던진다.
 * 2. 모르는 DB 오류는 PF_INTERNAL이 되고 원문은 응답이 아니라 서버 로그에만 남는다(새 오류 코드를 만들지 않는다).
 *
 * 근거: docs/04-api-contract.md 2절, src/lib/api/errors.ts
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 조회 오류 변환 도우미 (WU-41)
 */
import { fromSupabaseError, PfError } from '@/lib/api/errors';
import type { ServerErrorCode } from '@/types/erp';

/**
 * 조회 결과의 error를 확인한다.
 * @throws PfError error가 있을 때(코드는 fromSupabaseError가 정한다. 모르면 PF_INTERNAL)
 * 부작용: 모르는 오류는 서버 로그에 가린 원문이 남는다.
 */
export function throwIfDbError(error: { message?: unknown; details?: unknown; code?: unknown } | null | undefined): void {
  if (!error) return;
  const { body } = fromSupabaseError(error);
  throw new PfError(body.error.code as ServerErrorCode, body.error.detail ?? null);
}
