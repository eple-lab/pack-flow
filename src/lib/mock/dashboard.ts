/**
 * 대시보드 응답 목 — 화면 개발용 KPI · 파이프라인 · 품절 임박 카드 값.
 *
 * 하는 일
 * 1. 화면 개발용 목이다. NEXT_PUBLIC_USE_MOCK=1일 때 api-client가 이 값을 돌려준다(서버를 부르지 않는다).
 * 2. KPI · alerts는 mockItems에서 계산한다(눈으로 맞춘 숫자를 따로 적지 않는다). 파이프라인은 상태 상수로 키를 만든다.
 * 3. 오늘 입고 · 출고는 0으로 둔다(목 시간 기준이 없다).
 *
 * 근거: docs/04-api-contract.md 3.5 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 대시보드 목 (WU-04)
 */
import type { Dashboard, PurchaseStatus, SaleStatus } from '@/types/erp';
import { PURCHASE_STATUSES, SALE_STATUSES } from '@/types/erp';
import { mockItems } from './items';
import { mockStockLogs } from './stockLogs';

/** 구매 상태별 건수 목. '이동·통관중' 1건, 나머지 0. */
const mockPurchasePipeline = Object.fromEntries(
  PURCHASE_STATUSES.map((status) => [status, status === '이동·통관중' ? 1 : 0]),
) as Record<PurchaseStatus, number>;

/** 판매 상태별 건수 목. '출고대기' 1건, '주문접수' 1건, 나머지 0. */
const mockSalePipeline = Object.fromEntries(
  SALE_STATUSES.map((status) => [status, status === '출고대기' || status === '주문접수' ? 1 : 0]),
) as Record<SaleStatus, number>;

/** 품절 임박 카드 목. stock_qty < safety_stock 인 품목만(PRD-003). */
const mockAlerts = mockItems
  .filter((item) => item.below_safety)
  .map((item) => ({
    sku_id: item.sku_id,
    item_name: item.item_name,
    stock_qty: item.stock_qty,
    safety_stock: item.safety_stock,
  }));

/** 대시보드 목 한 벌. KPI 재고 합계 53 = 10 + 40 + 3. */
export const mockDashboard: Dashboard = {
  kpi: {
    item_count: mockItems.length,
    stock_total: mockItems.reduce((sum, item) => sum + item.stock_qty, 0),
    below_safety: mockItems.filter((item) => item.below_safety).length,
    today_in: 0,
    today_out: 0,
  },
  pipeline: {
    purchase: mockPurchasePipeline,
    sale: mockSalePipeline,
  },
  items: mockItems,
  alerts: mockAlerts,
  recent_changes: mockStockLogs.slice(0, 5),
};
