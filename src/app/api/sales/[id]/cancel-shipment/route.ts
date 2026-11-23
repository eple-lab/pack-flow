/**
 * 출고 취소 API 라우트.
 *
 * 하는 일
 * 1. 경로의 id는 uuid 형식을 검사한다(틀리면 400 PF_VALIDATION, field "id"). 검사 결과는 stub 때와 같다(checkPathParam).
 * 2. 본문 스키마는 없다. 취소는 반대 기록을 추가하는 방식이다(원칙 2).
 * 3. DB 함수 pf_cancel_shipment를 래퍼(cancelShipment)로 부른다. 응답은 { sale, stock_qty }.
 *
 * 근거: docs/04-api-contract.md 3.4 · WU-04 · WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/sales/[id]/cancel-shipment stub (WU-04)
 * 2026-11-23  eple  stub → 실제 처리 (WU-41)
 */
import { createHandler } from '@/lib/api/handler';
import { cancelShipment } from '@/lib/inventory';
import { checkPathParam } from '@/lib/queries/pathParam';

// POST /api/sales/{id}/cancel-shipment — 출고 취소. 오류: PF_VALIDATION(400) · PF_NOT_FOUND(404) · PF_INVALID_TRANSITION(409)
export const POST = createHandler({
  run: async ({ supabase, params }) => {
    const id = checkPathParam(params, 'id');
    return { data: await cancelShipment(supabase, { id }) };
  },
});
