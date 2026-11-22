/**
 * 구매 목 데이터 — 진행 중 구매 1건(P-101).
 *
 * 하는 일
 * 1. NEXT_PUBLIC_USE_MOCK=1일 때 구매 목록 화면에 보여 줄 값을 준다.
 * 2. 계획서 7절 시드 예시의 P-101(PRD-001, 가나물산, 10개 발주, 이동·통관중)과 같다.
 * 3. 아직 입고 전이라 received_qty · invoice_no · received_at은 null이다.
 *
 * 근거: docs/04-api-contract.md 3절 · docs/pack-flow-plan.md 7절 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 구매 목 데이터 (WU-04)
 */

import type { Purchase } from '@/types/erp';

/** 목 구매 1건. 입고 전 상태이므로 재고에는 아직 반영되지 않는다. */
export const mockPurchases: Purchase[] = [
  {
    id: '00000000-0000-4000-8000-0000000000b1',
    purchase_id: 'P-101',
    sku_id: 'PRD-001',
    supplier: '가나물산',
    order_qty: 10,
    received_qty: null,
    purchase_cost: 80000,
    status: '이동·통관중',
    invoice_no: null,
    source: 'seed',
    received_at: null,
    created_at: '2026-11-23T01:00:00.000Z',
    updated_at: '2026-11-23T01:00:00.000Z',
  },
];
