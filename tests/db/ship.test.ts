/**
 * WU-21 ship DB 검증. 테스트 계정의 사용자 JWT로 실행한다.
 * 근거: docs/work-units/WU-21-inventory-core.md
 * 구역: sorek-charlie
 * 이력
 * 2026-11-23  sorek-charlie  처음 작성 — 재고 RPC 검증 (WU-21)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPurchase, createSale, receivePurchase, setSaleStatus, shipSale } from '@/lib/inventory';
import { SALE_STATUSES, STOCK_REASONS } from '@/types/erp';
import { assertInvariants, makeItem, signIn } from './helpers';

describe('WU-21 출고 확정', () => {
  let client: SupabaseClient;
  let sku: string;
  beforeAll(async () => { client = await signIn('A'); });
  beforeEach(async () => {
    const item = await makeItem(client, { safety_stock: 5 });
    sku = item.sku_id;
    const purchase = await createPurchase(client, {
      sku_id: sku, supplier: '테스트 공급처', order_qty: 10, purchase_cost: 1000, invoice_no: null,
    });
    await receivePurchase(client, { id: purchase.id, received_qty: 10 });
  });
  afterEach(async () => { await assertInvariants(client); });

  it.each([false, true])('T-S1-1 재고 10개 중 6개를 출고하면 재고 4개, 이력 −6 1건 (출고대기 %s)', async (pending) => {
    const sale = await createSale(client, {
      sku_id: sku, channel: '테스트 판매처', sold_qty: 6, sale_amount: 2000, invoice_no: null,
    });
    if (pending) {
      const next = await setSaleStatus(client, { id: sale.id, to_status: SALE_STATUSES[1] });
      expect(next.fulfillment_status).toBe(SALE_STATUSES[1]);
    }
    const result = await shipSale(client, { id: sale.id });
    expect(result).toMatchObject({ stock_qty: 4, sale: { fulfillment_status: SALE_STATUSES[2] } });
    expect(result.sale.shipped_at).toBeTruthy();
    const logs = await client.from('stock_logs').select('change_qty, reason').eq('ref_id', sale.sale_id);
    expect(logs.error).toBeNull();
    expect(logs.data).toEqual([{ change_qty: -6, reason: STOCK_REASONS[1] }]);
  });

  it('T-S3-2 재고 4개에 50개 출고는 거부하고 재고·상태·이력을 유지한다', async () => {
    const first = await createSale(client, {
      sku_id: sku, channel: '테스트 판매처', sold_qty: 6, sale_amount: 2000, invoice_no: null,
    });
    await shipSale(client, { id: first.id });
    const sale = await createSale(client, {
      sku_id: sku, channel: '테스트 판매처', sold_qty: 50, sale_amount: 2000, invoice_no: null,
    });
    await expect(shipSale(client, { id: sale.id })).rejects.toMatchObject({
      code: 'PF_INSUFFICIENT_STOCK', detail: { sku_id: sku, stock_qty: 4, requested: 50 },
    });
    const [item, unchanged, logs] = await Promise.all([
      client.from('items').select('stock_qty').eq('sku_id', sku).single(),
      client.from('sales').select('fulfillment_status, shipped_at').eq('id', sale.id).single(),
      client.from('stock_logs').select('log_id').eq('ref_id', sale.sale_id),
    ]);
    expect(item).toMatchObject({ error: null, data: { stock_qty: 4 } });
    expect(unchanged).toMatchObject({
      error: null, data: { fulfillment_status: SALE_STATUSES[0], shipped_at: null },
    });
    expect(logs).toMatchObject({ error: null, data: [] });
  });
});
