/**
 * WU-21 validation DB 검증. 테스트 계정의 사용자 JWT로 실행한다.
 * 근거: docs/work-units/WU-21-inventory-core.md
 * 구역: sorek-charlie
 * 이력
 * 2026-11-23  sorek-charlie  처음 작성 — 재고 RPC 검증 (WU-21)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPurchase, createSale, receivePurchase } from '@/lib/inventory';
import { assertInvariants, makeItem, signIn } from './helpers';

describe('WU-21 DB 입력 검증', () => {
  let client: SupabaseClient;
  beforeAll(async () => { client = await signIn('A'); });
  afterEach(async () => { await assertInvariants(client); });

  it('T-VAL-1 null 송장 두 건을 허용하고 빈 문자열도 null로 저장한다', async () => {
    const { sku_id } = await makeItem(client);
    for (const invoice_no of [null, null, '']) {
      const sale = await createSale(client, {
        sku_id, channel: '테스트 판매처', sold_qty: 1, sale_amount: 2000, invoice_no,
      });
      expect(sale.invoice_no).toBeNull();
    }
  });

  it.each([0, 100001])('T-VAL-1 판매·구매 생성 RPC에서 수량 %s는 out_of_range다', async (qty) => {
    const { sku_id } = await makeItem(client);
    const sale = await client.rpc('pf_create_sale', {
      p_sku_id: sku_id, p_channel: '테스트 판매처', p_sold_qty: qty, p_sale_amount: 2000,
    });
    const purchase = await client.rpc('pf_create_purchase', {
      p_sku_id: sku_id, p_supplier: '테스트 공급처', p_order_qty: qty, p_purchase_cost: 1000,
    });
    for (const [result, field] of [[sale, 'sold_qty'], [purchase, 'order_qty']] as const) {
      expect(result.error?.message).toBe('PF_VALIDATION');
      expect(JSON.parse(result.error?.details ?? '{}')).toMatchObject({ field, reason: 'out_of_range' });
    }
  });

  it.each([0, 11])('T-VAL-1 발주 10개의 입고 수량 %s는 out_of_range다', async (received_qty) => {
    const { sku_id } = await makeItem(client);
    const purchase = await createPurchase(client, {
      sku_id, supplier: '테스트 공급처', order_qty: 10, purchase_cost: 1000, invoice_no: null,
    });
    await expect(receivePurchase(client, { id: purchase.id, received_qty })).rejects.toMatchObject({
      code: 'PF_VALIDATION', detail: { field: 'received_qty', reason: 'out_of_range' },
    });
  });
});
