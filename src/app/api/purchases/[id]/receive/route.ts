/**
 * 입고 확정 API 라우트.
 *
 * 하는 일
 * 1. 경로의 id는 uuid 형식을 검사한다(틀리면 400 PF_VALIDATION, field "id"). 검사 결과는 stub 때와 같다(checkPathParam).
 * 2. 본문 received_qty는 receive 스키마로 검사한다(1 ~ 100,000).
 * 3. 구매를 사용자 JWT로 먼저 읽어(없으면 404 PF_NOT_FOUND) makeReceive(order_qty)로 한 번 더 검사한다 —
 *    화면에 field 오류(1 ~ order_qty)를 주려는 것이다. DB 함수(pf_receive_purchase)도 같은 검사를 한다.
 * 4. 재고 반영은 DB 함수가 한다(원칙 1). 응답은 { purchase, stock_qty }.
 *
 * 근거: docs/04-api-contract.md 3.3 · WU-04 · WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/purchases/[id]/receive stub (WU-04)
 * 2026-11-23  eple  stub → 실제 처리 (WU-41)
 */
import { PfError } from '@/lib/api/errors';
import { createHandler } from '@/lib/api/handler';
import { receivePurchase } from '@/lib/inventory';
import { getPurchaseOrderQty } from '@/lib/queries/items';
import { checkPathParam } from '@/lib/queries/pathParam';
import { parseWith } from '@/lib/validation/detail';
import { makeReceive, receive } from '@/lib/validation/schemas';

// POST /api/purchases/{id}/receive — 입고 확정. 오류: PF_VALIDATION(400) · PF_NOT_FOUND(404) · PF_INVALID_TRANSITION(409)
export const POST = createHandler({
  schema: receive,
  run: async ({ supabase, body, params }) => {
    const id = checkPathParam(params, 'id');
    // 구매별 상한(order_qty)으로 다시 검사 — 없는 구매 · 남의 구매는 404
    const orderQty = await getPurchaseOrderQty(supabase, id);
    const checked = parseWith(makeReceive(orderQty), body);
    if (!checked.ok) throw new PfError('PF_VALIDATION', checked.detail);
    return { data: await receivePurchase(supabase, { id, received_qty: checked.data.received_qty }) };
  },
});
