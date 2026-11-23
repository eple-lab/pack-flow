/**
 * WU-23 구매 상태 전이 검증. 구역: sorek-charlie.
 * 2026-11-23  sorek-charlie  처음 작성 (WU-23)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { createPurchase, receivePurchase, setPurchaseStatus } from '@/lib/inventory';
import { assertInvariants, resetAndSeed, signIn } from './helpers';

let a: SupabaseClient;
beforeAll(async () => { a = await signIn('A'); });
beforeEach(async () => { await resetAndSeed(a, 'demo'); });
afterEach(async () => { if (a) await assertInvariants(a); });

async function purchaseId() {
  return (await createPurchase(a, {
    sku_id: 'PRD-001', supplier: '가상 공급처', order_qty: 10, purchase_cost: 1000, invoice_no: null,
  })).id;
}

it.each(['이동·통관중', '품절', '취소'] as const)('T-S3-3 발주완료 → %s는 원장 변동 없이 허용한다', async (to) => {
  const id = await purchaseId();
  await expect(setPurchaseStatus(a, { id, to_status: to })).resolves.toMatchObject({ status: to });
});

it('T-S3-3 입고완료 → 발주완료와 취소 → 입고완료를 거부한다', async () => {
  const received = await purchaseId();
  await receivePurchase(a, { id: received, received_qty: 8 });
  // API 입력 타입을 우회해 DB 함수 자체의 상태 제한을 시험한다.
  const invalid = await a.rpc('pf_set_purchase_status', { p_id: received, p_to_status: '발주완료' });
  expect(invalid.error?.message).toBe('PF_INVALID_TRANSITION');

  const cancelled = await purchaseId();
  await setPurchaseStatus(a, { id: cancelled, to_status: '취소' });
  await expect(receivePurchase(a, { id: cancelled, received_qty: 8 })).rejects.toMatchObject({ code: 'PF_INVALID_TRANSITION' });
});
