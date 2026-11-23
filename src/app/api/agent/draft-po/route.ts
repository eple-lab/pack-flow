/**
 * 발주서 초안 만들기 API 라우트 — 조회 → 계산(코드) → 문안(LLM). 읽기만 하고 구매를 저장하지 않는다.
 *
 * 하는 일
 * 1. 본문(sku_ids, 선택)은 draftPoRequest 스키마로 검사한다(잘못되면 400 PF_VALIDATION).
 * 2. 사용자 JWT 클라이언트로 품목 · 7일 이력 · 구매를 읽어 후보 표를 계산하고 LLM 문안을 붙인다(createPoDraft).
 * 3. LLM 오류 · 호출 상한 초과는 오류 응답이 아니라 200 + llm_error로 돌려준다 — 표는 그대로 보여 준다(P-08).
 *
 * 근거: docs/04-api-contract.md 3.8 · WU-33
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple     자리 생성 (WU-04) — 구현은 skygaul WU-33/34
 * 2026-11-23  skygaul  stub을 초안 만들기로 교체 (WU-33)
 */
import { createPoDraft } from '@/lib/agent/draft-po';
import { createHandler } from '@/lib/api/handler';
import { draftPoRequest } from '@/lib/validation/schemas';

// POST /api/agent/draft-po — 발주 초안 생성. 오류: PF_VALIDATION(400) · PF_UNAUTHENTICATED(401) · PF_INTERNAL(500)
export const POST = createHandler({
  schema: draftPoRequest,
  run: async ({ supabase, body }) => ({ data: await createPoDraft(supabase, { skuIds: body.sku_ids }) }),
});
