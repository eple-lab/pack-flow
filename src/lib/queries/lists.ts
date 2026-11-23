/**
 * 품목 · 구매 · 판매 목록 조회 (사용자 JWT 클라이언트로 읽는다 — RLS가 남의 데이터를 거른다).
 *
 * 하는 일
 * 1. listItems: 품목 + 재고. below_safety는 테이블 컬럼이 없어 stock_qty < safety_stock으로 계산한다(재고 수량을 저장하지 않는다).
 *    정렬은 품목코드(sku_id) 오름차순 — 계약에 정렬 규정이 없어 화면 목(PRD-001, 002, 003 순)에 맞췄다.
 * 2. listPurchases · listSales: status가 있으면 그 상태만, 최근순(created_at 내림차순, 같으면 id 내림차순으로 순서 고정).
 * 3. user_id 컬럼은 응답에 싣지 않는다(칸을 하나씩 고른다).
 *
 * 근거: docs/04-api-contract.md 3.2 ~ 3.4, docs/03-data-model.md 2절, WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 품목 · 구매 · 판매 목록 조회 (WU-41)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Item, Purchase, PurchaseStatus, Sale, SaleStatus } from '@/types/erp';
import { throwIfDbError } from './throwIfDbError';

const ITEM_COLUMNS = 'id, sku_id, item_name, source_url, unit_cost, sale_price, stock_qty, safety_stock, created_at, updated_at';
const PURCHASE_COLUMNS =
  'id, purchase_id, sku_id, supplier, order_qty, received_qty, purchase_cost, status, invoice_no, source, received_at, created_at, updated_at';
const SALE_COLUMNS =
  'id, sale_id, sku_id, channel, sold_qty, sale_amount, fulfillment_status, invoice_no, source, shipped_at, created_at, updated_at';

/** 재고가 안전재고보다 적은가(경계: 같으면 아님). */
export function isBelowSafety(stockQty: number, safetyStock: number): boolean {
  return stockQty < safetyStock;
}

/**
 * 품목 목록(품목코드 순)에 below_safety를 붙여 돌려준다.
 * @throws PfError DB 오류(PF_INTERNAL 등)
 */
export async function listItems(supabase: SupabaseClient): Promise<Item[]> {
  const { data, error } = await supabase.from('items').select(ITEM_COLUMNS).order('sku_id', { ascending: true });
  throwIfDbError(error);
  const rows = (data ?? []) as unknown as Array<Omit<Item, 'below_safety'>>;
  return rows.map((row) => ({ ...row, below_safety: isBelowSafety(row.stock_qty, row.safety_stock) }));
}

/**
 * 구매 목록(최근순). status를 주면 그 상태만.
 * @throws PfError DB 오류
 */
export async function listPurchases(supabase: SupabaseClient, status: PurchaseStatus | null): Promise<Purchase[]> {
  let q = supabase.from('purchases').select(PURCHASE_COLUMNS);
  if (status) q = q.eq('status', status);
  const { data, error } = await q.order('created_at', { ascending: false }).order('id', { ascending: false });
  throwIfDbError(error);
  return (data ?? []) as unknown as Purchase[];
}

/**
 * 판매 목록(최근순). status를 주면 그 출고 상태만.
 * @throws PfError DB 오류
 */
export async function listSales(supabase: SupabaseClient, status: SaleStatus | null): Promise<Sale[]> {
  let q = supabase.from('sales').select(SALE_COLUMNS);
  if (status) q = q.eq('fulfillment_status', status);
  const { data, error } = await q.order('created_at', { ascending: false }).order('id', { ascending: false });
  throwIfDbError(error);
  return (data ?? []) as unknown as Sale[];
}
