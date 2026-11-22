/**
 * 재고 이력 목 데이터 — 초기 재고 '재고조정' 기록 3건과 그 페이지 응답.
 *
 * 하는 일
 * 1. 최근순(log_id 큰 순)으로 둔다. 키셋 페이지네이션이라 next_cursor는 null(마지막 페이지).
 * 2. 초기 재고를 '재고조정' +N으로 넣어, sku별 change_qty 합 = mockItems의 stock_qty가 되게 한다.
 *    · PRD-003: +3 = 3 / PRD-002: +40 = 40 / PRD-001: +10 = 10 (눈으로 계산해 확인)
 *
 * 근거: docs/04-api-contract.md 3절 · docs/03-data-model.md 2절 · docs/pack-flow-plan.md 7절 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 재고 이력 목 데이터 (WU-04)
 */

import type { StockLog, StockLogPage } from '@/types/erp';

/** 목 재고 이력 3건. 최근순: log_id 3 → 2 → 1. */
export const mockStockLogs: StockLog[] = [
  {
    log_id: 3,
    sku_id: 'PRD-003',
    change_qty: 3,
    reason: '재고조정',
    ref_type: 'seed',
    ref_id: 'seed',
    created_at: '2026-11-23T01:00:00.000Z',
  },
  {
    log_id: 2,
    sku_id: 'PRD-002',
    change_qty: 40,
    reason: '재고조정',
    ref_type: 'seed',
    ref_id: 'seed',
    created_at: '2026-11-23T01:00:00.000Z',
  },
  {
    log_id: 1,
    sku_id: 'PRD-001',
    change_qty: 10,
    reason: '재고조정',
    ref_type: 'seed',
    ref_id: 'seed',
    created_at: '2026-11-23T01:00:00.000Z',
  },
];

/** 목 재고 이력 페이지. 3건이 전부라 다음 커서가 없다. */
export const mockStockLogPage: StockLogPage = {
  rows: mockStockLogs,
  next_cursor: null,
};
