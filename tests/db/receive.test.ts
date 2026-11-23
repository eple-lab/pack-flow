/**
 * WU-21 receive DB 검증. 테스트 계정의 사용자 JWT로 실행한다.
 * 근거: docs/work-units/WU-21-inventory-core.md
 * 구역: sorek-charlie
 * 이력
 * 2026-11-23  sorek-charlie  처음 작성 — 재고 RPC 검증 (WU-21)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPurchase, receivePurchase } from '@/lib/inventory';
import { PURCHASE_STATUSES, STOCK_REASONS } from '@/types/erp';
import { assertInvariants, makeItem, signIn } from './helpers';

describe('WU-21 입고 확정', () => {
  let client: SupabaseClient;
  beforeAll(async () => { client = await signIn('A'); });
  afterEach(async () => { await assertInvariants(client); });

  it('T-S1-2 발주 10개 중 8개를 입고하면 재고와 이력이 8 늘어난다', async () => {
    const item = await makeItem(client);
    const purchase = await createPurchase(client, {
      sku_id: item.sku_id, supplier: '테스트 공급처', order_qty: 10, purchase_cost: 1000, invoice_no: null,
    });
    expect(purchase.status).toBe(PURCHASE_STATUSES[0]);
    const result = await receivePurchase(client, { id: purchase.id, received_qty: 8 });
    expect(result).toMatchObject({
      stock_qty: 8,
      purchase: { status: PURCHASE_STATUSES[2], received_qty: 8 },
    });
    expect(result.purchase.received_at).toBeTruthy();
    const logs = await client.from('stock_logs').select('change_qty, reason').eq('ref_id', purchase.purchase_id);
    expect(logs.error).toBeNull();
    expect(logs.data).toEqual([{ change_qty: 8, reason: STOCK_REASONS[0] }]);
    await expect(receivePurchase(client, { id: purchase.id, received_qty: 8 }))
      .rejects.toMatchObject({ code: 'PF_INVALID_TRANSITION' });
  });
});
