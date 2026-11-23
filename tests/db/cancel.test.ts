/**
 * WU-23 입출고 취소 · 소유권 · 원장 검증. 구역: sorek-charlie.
 * 2026-11-23  sorek-charlie  처음 작성 (WU-23)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { cancelReceipt, cancelShipment, createPurchase, createSale, receivePurchase, shipSale } from '@/lib/inventory';
import { assertInvariants, makeItem, resetAndSeed, signIn } from './helpers';

let a: SupabaseClient;
let b: SupabaseClient;

beforeAll(async () => { a = await signIn('A'); b = await signIn('B'); });
beforeEach(async () => { await resetAndSeed(a, 'demo'); });
afterEach(async () => { if (a) await assertInvariants(a); });

async function idOf(table: 'purchases' | 'sales', field: 'purchase_id' | 'sale_id', number: string) {
  const { data, error } = await a.from(table).select('id').eq(field, number).single();
  expect(error).toBeNull();
  return data!.id as string;
}

it('T-S3-1 출고 취소가 재고를 복원하고 반대 기록을 추가한다', async () => {
  const id = await idOf('sales', 'sale_id', 'S-201');
  expect((await shipSale(a, { id })).stock_qty).toBe(4);
  await expect(cancelShipment(b, { id })).rejects.toMatchObject({ code: 'PF_NOT_FOUND' });
  expect(await cancelShipment(a, { id })).toMatchObject({ stock_qty: 10, sale: { fulfillment_status: '출고취소' } });
  await expect(cancelShipment(a, { id })).rejects.toMatchObject({ code: 'PF_INVALID_TRANSITION' });
  await expect(shipSale(a, { id })).rejects.toMatchObject({ code: 'PF_INVALID_TRANSITION' });
  const logs = await a.from('stock_logs').select('change_qty, reason').eq('ref_id', 'S-201').order('change_qty');
  expect(logs.error).toBeNull();
  expect(logs.data).toEqual([{ change_qty: -6, reason: '실판매출고' }, { change_qty: 6, reason: '출고취소' }]);
});

it('C-01 부분 입고 취소가 실제 입고 수량만 차감한다', async () => {
  const id = await idOf('purchases', 'purchase_id', 'P-101');
  expect((await receivePurchase(a, { id, received_qty: 8 })).stock_qty).toBe(18);
  await expect(cancelReceipt(b, { id })).rejects.toMatchObject({ code: 'PF_NOT_FOUND' });
  expect(await cancelReceipt(a, { id })).toMatchObject({ stock_qty: 10, purchase: { received_qty: 8, status: '입고취소' } });
  const logs = await a.from('stock_logs').select('change_qty, reason').eq('ref_id', 'P-101').order('change_qty');
  expect(logs.error).toBeNull();
  expect(logs.data).toEqual([{ change_qty: -8, reason: '입고취소' }, { change_qty: 8, reason: '구매입고' }]);
});

it('C-02 이미 판매한 입고분은 재고가 부족하면 취소할 수 없다', async () => {
  const { sku_id } = await makeItem(a);
  const purchase = await createPurchase(a, { sku_id, supplier: '가상 공급처', order_qty: 10, purchase_cost: 1000, invoice_no: null });
  await receivePurchase(a, { id: purchase.id, received_qty: 8 });
  const sale = await createSale(a, { sku_id, channel: '가상 판매처', sold_qty: 6, sale_amount: 1000, invoice_no: null });
  await shipSale(a, { id: sale.id });
  await expect(cancelReceipt(a, { id: purchase.id })).rejects.toMatchObject({
    code: 'PF_INSUFFICIENT_STOCK', detail: { sku_id, stock_qty: 2, requested: 8 },
  });
  const row = await a.from('purchases').select('status, received_qty').eq('id', purchase.id).single();
  expect(row.error).toBeNull();
  expect(row.data).toEqual({ status: '입고완료', received_qty: 8 });
});
