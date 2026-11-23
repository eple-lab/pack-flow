/**
 * 대시보드 요약 조회 — KPI · 파이프라인 · 품목 · 품절 임박 · 최근 재고 변동.
 *
 * 하는 일
 * 1. 재고 수량은 items.stock_qty를 그대로 읽는다. 여기서 재고를 계산해 저장하지 않는다(원칙 1). 합계 · 건수만 센다.
 * 2. today_in = 오늘(Asia/Seoul) received_at인 '입고완료' 구매 건수, today_out = 오늘 shipped_at인 '출고완료' 판매 건수.
 *    경계는 time.ts의 todayRangeKst(00:00 포함 ~ 다음날 00:00 미포함). 입고취소로 상태가 바뀐 건은 세지 않는다.
 * 3. pipeline은 상태 상수 전체 키를 0으로 채운 뒤 상태별 건수(head count 쿼리)로 덮는다. 행을 통째로 읽지 않아
 *    PostgREST 행 수 제한(기본 1000)에 잘리지 않는다.
 * 4. recent_changes = stock_logs 최근 5건(created_at 내림차순, 같으면 log_id 내림차순).
 *
 * 근거: docs/04-api-contract.md 3.5, docs/03-data-model.md 2절, WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 대시보드 조회 (WU-41)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { todayRangeKst } from '@/lib/time';
import {
  PURCHASE_STATUSES,
  SALE_STATUSES,
  type Dashboard,
  type PurchaseStatus,
  type SaleStatus,
  type StockLog,
} from '@/types/erp';
import { listItems } from './lists';
import { throwIfDbError } from './throwIfDbError';

const STOCK_LOG_COLUMNS = 'log_id, sku_id, change_qty, reason, ref_type, ref_id, created_at';
const RECENT_LIMIT = 5;

/** 조건에 맞는 행 수. head 요청이라 행은 가져오지 않는다. */
async function countRows(
  supabase: SupabaseClient,
  table: 'purchases' | 'sales',
  statusColumn: 'status' | 'fulfillment_status',
  status: string,
  range?: { column: 'received_at' | 'shipped_at'; startIso: string; endIso: string },
): Promise<number> {
  let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq(statusColumn, status);
  if (range) q = q.gte(range.column, range.startIso).lt(range.column, range.endIso);
  const { count, error } = await q;
  throwIfDbError(error);
  return count ?? 0;
}

/**
 * 대시보드 응답을 만든다.
 * @param now 기준 시각(테스트에서 고정값을 넣는다)
 * @throws PfError DB 오류(PF_INTERNAL 등)
 */
export async function getDashboard(supabase: SupabaseClient, now: Date = new Date()): Promise<Dashboard> {
  const today = todayRangeKst(now);

  const [items, purchaseCounts, saleCounts, todayIn, todayOut, logs] = await Promise.all([
    listItems(supabase),
    Promise.all(PURCHASE_STATUSES.map((s) => countRows(supabase, 'purchases', 'status', s))),
    Promise.all(SALE_STATUSES.map((s) => countRows(supabase, 'sales', 'fulfillment_status', s))),
    countRows(supabase, 'purchases', 'status', '입고완료', { column: 'received_at', ...today }),
    countRows(supabase, 'sales', 'fulfillment_status', '출고완료', { column: 'shipped_at', ...today }),
    supabase
      .from('stock_logs')
      .select(STOCK_LOG_COLUMNS)
      .order('created_at', { ascending: false })
      .order('log_id', { ascending: false })
      .limit(RECENT_LIMIT),
  ]);
  throwIfDbError(logs.error);

  // 상태 상수 전체 키를 0으로 시작 — 0건 상태도 응답에 있다
  const purchasePipeline = Object.fromEntries(PURCHASE_STATUSES.map((s) => [s, 0])) as Record<PurchaseStatus, number>;
  const salePipeline = Object.fromEntries(SALE_STATUSES.map((s) => [s, 0])) as Record<SaleStatus, number>;
  PURCHASE_STATUSES.forEach((s, i) => (purchasePipeline[s] = purchaseCounts[i]));
  SALE_STATUSES.forEach((s, i) => (salePipeline[s] = saleCounts[i]));

  const belowSafety = items.filter((item) => item.below_safety);
  return {
    kpi: {
      item_count: items.length,
      stock_total: items.reduce((sum, item) => sum + item.stock_qty, 0),
      below_safety: belowSafety.length,
      today_in: todayIn,
      today_out: todayOut,
    },
    pipeline: { purchase: purchasePipeline, sale: salePipeline },
    items,
    alerts: belowSafety.map(({ sku_id, item_name, stock_qty, safety_stock }) => ({ sku_id, item_name, stock_qty, safety_stock })),
    recent_changes: (logs.data ?? []) as unknown as StockLog[],
  };
}
