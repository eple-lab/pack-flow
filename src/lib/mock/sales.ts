/**
 * 판매 목 데이터 — 출고 전 판매 2건(S-201, S-202).
 *
 * 하는 일
 * 1. NEXT_PUBLIC_USE_MOCK=1일 때 판매 목록 화면에 보여 줄 값을 준다.
 * 2. 계획서 7절 시드 예시의 S-201(PRD-001 6개), S-202(PRD-002 5개)와 같다.
 * 3. 둘 다 출고 전이라 재고(stockLogs.ts)에는 아직 반영되지 않았고 shipped_at은 null이다.
 *
 * 근거: docs/04-api-contract.md 3절 · docs/pack-flow-plan.md 7절 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 판매 목 데이터 (WU-04)
 */

import type { Sale } from '@/types/erp';

/** 목 판매 2건. 출고대기 · 주문접수 상태라 재고는 그대로다. */
export const mockSales: Sale[] = [
  {
    id: '00000000-0000-4000-8000-0000000000c1',
    sale_id: 'S-201',
    sku_id: 'PRD-001',
    channel: '스마트스토어',
    sold_qty: 6,
    sale_amount: 90000,
    fulfillment_status: '출고대기',
    invoice_no: null,
    source: 'seed',
    shipped_at: null,
    created_at: '2026-11-23T01:00:00.000Z',
    updated_at: '2026-11-23T01:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-0000000000c2',
    sale_id: 'S-202',
    sku_id: 'PRD-002',
    channel: '쿠팡',
    sold_qty: 5,
    sale_amount: 25000,
    fulfillment_status: '주문접수',
    invoice_no: null,
    source: 'seed',
    shipped_at: null,
    created_at: '2026-11-23T01:00:00.000Z',
    updated_at: '2026-11-23T01:00:00.000Z',
  },
];
