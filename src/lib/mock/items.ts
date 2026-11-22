/**
 * 품목 목 데이터 — 화면 개발용 가짜 품목 3개.
 *
 * 하는 일
 * 1. NEXT_PUBLIC_USE_MOCK=1일 때 api-client가 이 값을 돌려준다(서버를 부르지 않는다).
 * 2. 계획서 7절 시드 예시(PRD-001~003)와 같은 숫자를 쓴다.
 * 3. stock_qty는 stockLogs.ts 이력 합계와 맞춘다. below_safety는 stock_qty < safety_stock 규칙으로 눈으로 계산해 적었다.
 *
 * 근거: docs/04-api-contract.md 3절 · docs/pack-flow-plan.md 7절 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 품목 목 데이터 (WU-04)
 */

import type { Item } from '@/types/erp';

/** 목 품목 3개. PRD-003(재고 3 < 안전재고 4)만 below_safety = true. */
export const mockItems: Item[] = [
  {
    id: '00000000-0000-4000-8000-0000000000a1',
    sku_id: 'PRD-001',
    item_name: '무선 마우스',
    source_url: null,
    unit_cost: 8000,
    sale_price: 15000,
    stock_qty: 10,
    safety_stock: 5,
    below_safety: false, // 10 < 5 → 아님
    created_at: '2026-11-23T01:00:00.000Z',
    updated_at: '2026-11-23T01:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-0000000000a2',
    sku_id: 'PRD-002',
    item_name: 'USB-C 케이블',
    source_url: null,
    unit_cost: 2000,
    sale_price: 5000,
    stock_qty: 40,
    safety_stock: 15,
    below_safety: false, // 40 < 15 → 아님
    created_at: '2026-11-23T01:00:00.000Z',
    updated_at: '2026-11-23T01:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-0000000000a3',
    sku_id: 'PRD-003',
    item_name: '노트북 거치대',
    source_url: null,
    unit_cost: 12000,
    sale_price: 25000,
    stock_qty: 3,
    safety_stock: 4,
    below_safety: true, // 3 < 4 → 품절 임박
    created_at: '2026-11-23T01:00:00.000Z',
    updated_at: '2026-11-23T01:00:00.000Z',
  },
];
