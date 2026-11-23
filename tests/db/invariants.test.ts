/**
 * WU-21 invariants DB 검증. 테스트 계정의 사용자 JWT로 실행한다.
 * 근거: docs/work-units/WU-21-inventory-core.md
 * 구역: sorek-charlie
 * 이력
 * 2026-11-23  sorek-charlie  처음 작성 — 재고 RPC 검증 (WU-21)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPurchase, createSale, receivePurchase, setSaleStatus, shipSale } from '@/lib/inventory';
import { PURCHASE_STATUSES, SALE_STATUSES } from '@/types/erp';
import { assertInvariants, makeItem, signIn } from './helpers';

describe('WU-21 계정 격리와 재고 불변식', () => {
  let owner: SupabaseClient;
  let other: SupabaseClient;
  beforeAll(async () => {
    [owner, other] = await Promise.all([signIn('A'), signIn('B')]);
  });
  afterEach(async () => {
    await Promise.all([assertInvariants(owner), assertInvariants(other)]);
  });

  it('T-INV-1 다른 계정의 구매·판매는 PF_NOT_FOUND이며 원장과 소유자 거래가 그대로다', async () => {
    const { sku_id } = await makeItem(owner);
    const purchase = await createPurchase(owner, {
      sku_id, supplier: '테스트 공급처', order_qty: 8, purchase_cost: 1000, invoice_no: null,
    });
    const sale = await createSale(owner, {
      sku_id, channel: '테스트 판매처', sold_qty: 1, sale_amount: 2000, invoice_no: null,
    });
    await expect(receivePurchase(other, { id: purchase.id, received_qty: 8 }))
      .rejects.toMatchObject({ code: 'PF_NOT_FOUND' });
    await expect(shipSale(other, { id: sale.id })).rejects.toMatchObject({ code: 'PF_NOT_FOUND' });
    await expect(setSaleStatus(other, { id: sale.id, to_status: SALE_STATUSES[1] }))
      .rejects.toMatchObject({ code: 'PF_NOT_FOUND' });
    const [buy, sell, item, logs] = await Promise.all([
      owner.from('purchases').select('status').eq('id', purchase.id).single(),
      owner.from('sales').select('fulfillment_status').eq('id', sale.id).single(),
      owner.from('items').select('stock_qty').eq('sku_id', sku_id).single(),
      owner.from('stock_logs').select('log_id').eq('sku_id', sku_id),
    ]);
    expect(buy).toMatchObject({ error: null, data: { status: PURCHASE_STATUSES[0] } });
    expect(sell).toMatchObject({ error: null, data: { fulfillment_status: SALE_STATUSES[0] } });
    expect(item).toMatchObject({ error: null, data: { stock_qty: 0 } });
    expect(logs).toMatchObject({ error: null, data: [] });
  });
});
