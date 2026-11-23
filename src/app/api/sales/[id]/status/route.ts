/**
 * 판매 상태 변경 API 라우트.
 *
 * 하는 일
 * 1. 경로의 id는 uuid 형식을 검사한다(틀리면 400 PF_VALIDATION, field "id"). 검사 결과는 stub 때와 같다(checkPathParam).
 * 2. 본문 to는 saleStatusChange 스키마로 검사한다(출고대기 · 주문취소).
 * 3. DB 함수 pf_set_sale_status를 래퍼(setSaleStatus)로 부른다. 전이 판정은 DB가 한다(재고 영향 없음).
 *
 * 근거: docs/04-api-contract.md 3.4 · WU-04 · WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/sales/[id]/status stub (WU-04)
 * 2026-11-23  eple  stub → 실제 처리 (WU-41)
 */
import { createHandler } from '@/lib/api/handler';
import { setSaleStatus } from '@/lib/inventory';
import { checkPathParam } from '@/lib/queries/pathParam';
import { saleStatusChange } from '@/lib/validation/schemas';

// POST /api/sales/{id}/status — 판매 상태 변경. 오류: PF_VALIDATION(400) · PF_NOT_FOUND(404) · PF_INVALID_TRANSITION(409)
export const POST = createHandler({
  schema: saleStatusChange,
  run: async ({ supabase, body, params }) => {
    const id = checkPathParam(params, 'id');
    return { data: await setSaleStatus(supabase, { id, to_status: body.to }) };
  },
});
