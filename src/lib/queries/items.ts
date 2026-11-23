/**
 * 품목 수정 · 구매 입고 상한 조회 (사용자 JWT 클라이언트 — RLS가 남의 행을 거른다).
 *
 * 하는 일
 * 1. updateItem: items의 마스터 5칸(item_name · source_url · unit_cost · sale_price · safety_stock)만 바꾼다.
 *    DB 함수가 없다 — RLS의 칸 단위 update 권한이 허용하는 칸이 이것뿐이다(20261120100400_rls.sql).
 *    stock_qty · sku_id · user_id는 스키마(itemUpdate)가 400으로 막고, DB 권한도 한 번 더 막는다.
 * 2. 응답은 user_id를 뺀 Item(below_safety 포함). 행이 없으면(없는 품목 · 남의 품목) PF_NOT_FOUND.
 * 3. getPurchaseOrderQty: 입고 확정 본문의 received_qty 상한(order_qty)을 정하려고 구매를 먼저 읽는다.
 *
 * 근거: docs/04-api-contract.md 3.2 · 3.3 · 4.2, WU-41 4단계
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 품목 수정 · 구매 order_qty 조회 (WU-41)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PfError } from '@/lib/api/errors';
import type { Item } from '@/types/erp';
import type { ItemUpdateInput } from '@/lib/validation/schemas';
import { isBelowSafety } from './lists';
import { throwIfDbError } from './throwIfDbError';

const ITEM_COLUMNS = 'id, sku_id, item_name, source_url, unit_cost, sale_price, stock_qty, safety_stock, created_at, updated_at';

/**
 * 품목 마스터를 수정한다.
 * @param body itemUpdate 스키마를 통과한 값(허용 칸만 있다)
 * @throws PfError PF_NOT_FOUND(행 없음) · DB 오류 변환(PF_INTERNAL 등)
 * 부작용: items 행 update(updated_at은 DB 트리거가 갱신).
 */
export async function updateItem(supabase: SupabaseClient, skuId: string, body: ItemUpdateInput): Promise<Item> {
  const { data, error } = await supabase.from('items').update(body).eq('sku_id', skuId).select(ITEM_COLUMNS).maybeSingle();
  throwIfDbError(error);
  if (!data) throw new PfError('PF_NOT_FOUND');
  const row = data as unknown as Omit<Item, 'below_safety'>;
  return { ...row, below_safety: isBelowSafety(row.stock_qty, row.safety_stock) };
}

/**
 * 구매의 order_qty를 읽는다.
 * @throws PfError PF_NOT_FOUND(없는 구매 · 남의 구매) · DB 오류 변환
 */
export async function getPurchaseOrderQty(supabase: SupabaseClient, id: string): Promise<number> {
  const { data, error } = await supabase.from('purchases').select('order_qty').eq('id', id).maybeSingle();
  throwIfDbError(error);
  if (!data) throw new PfError('PF_NOT_FOUND');
  return (data as { order_qty: number }).order_qty;
}
