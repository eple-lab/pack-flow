/**
 * 발주서 초안 확정 API 라우트 — 사람이 확인한 줄을 구매(발주완료)로 등록한다.
 *
 * 하는 일
 * 1. 본문(lines, 사용자가 고친 값)은 poConfirm 스키마로 검사한다(잘못되면 400 PF_VALIDATION).
 * 2. 받은 내용을 처음부터 다시 검증한다 — 값 범위, 품목이 본인 것인지(남의 품목이면 404 PF_NOT_FOUND, 저장 없음).
 *    화면이 보낸 값을 그대로 믿지 않는다(04 3.8). LLM 응답은 이 라우트에 오지 않는다(원칙 4).
 * 3. 줄마다 pf_create_purchase를 source "agent"로 부른다. 결과는 201.
 *
 * 근거: docs/04-api-contract.md 3.8 · WU-33
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple     자리 생성 (WU-04) — 구현은 skygaul WU-33/34
 * 2026-11-23  skygaul  stub을 확정(재검증 · 구매 등록)으로 교체 (WU-33)
 */
import { confirmPoLines } from '@/lib/agent/draft-po';
import { createHandler } from '@/lib/api/handler';
import { poConfirm } from '@/lib/validation/schemas';

// POST /api/agent/draft-po/confirm — 발주 초안 확정. 오류: PF_VALIDATION(400) · PF_UNAUTHENTICATED(401) · PF_NOT_FOUND(404) · pf_create_purchase의 코드
export const POST = createHandler({
  schema: poConfirm,
  run: async ({ supabase, body }) => ({ data: await confirmPoLines(supabase, body.lines), status: 201 }),
});
