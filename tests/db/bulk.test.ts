/**
 * WU-23에서 WU-43 일괄 반영의 부분 성공과 재시도를 검증한다. 구역: sorek-charlie.
 * 2026-11-23  sorek-charlie  처음 작성 (WU-23)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { bulkApply } from '@/lib/inventory';
import type { BulkRowInput } from '@/types/erp';
import { assertInvariants, resetAndSeed, signIn } from './helpers';

let a: SupabaseClient;
beforeAll(async () => { a = await signIn('A'); });
beforeEach(async () => { await resetAndSeed(a, 'demo'); });
afterEach(async () => { if (a) await assertInvariants(a); });

function row(line: number, overrides: Partial<BulkRowInput> = {}): BulkRowInput {
  return { line, kind: '입고', sku_id: 'PRD-001', qty: 1, partner: '가상 공급처', invoice_no: `BULK-${line}`, memo: null, ...overrides };
}

it('T-S3-5 10행 중 실패 3행을 건너뛰고 성공 7행을 반영한다', async () => {
  const valid = Array.from({ length: 7 }, (_, index) => row(index + 1));
  const rows = [...valid,
    row(8, { sku_id: 'MISSING-001' }),
    row(9, { kind: '출고', qty: 100 }),
    row(10, { invoice_no: valid[0].invoice_no }),
  ];
  const result = await bulkApply(a, { rows });
  expect(result.applied).toBe(7);
  expect(result.skipped).toHaveLength(3);
  expect(result.skipped).toEqual(expect.arrayContaining([
    expect.objectContaining({ line: 8, code: 'PF_NOT_FOUND' }),
    expect.objectContaining({ line: 9, code: 'PF_INSUFFICIENT_STOCK' }),
    expect.objectContaining({ line: 10, code: 'PF_DUPLICATE_INVOICE' }),
  ]));
  const stock = await a.from('items').select('stock_qty').eq('sku_id', 'PRD-001').single();
  expect(stock.error).toBeNull();
  expect(stock.data?.stock_qty).toBe(17);
});

it('T-S4-4 동일 송장 행을 재시도하면 중복으로 건너뛴다', async () => {
  const rows = [row(1), row(2)];
  expect(await bulkApply(a, { rows })).toMatchObject({ applied: 2, skipped: [] });
  const retry = await bulkApply(a, { rows });
  expect(retry.applied).toBe(0);
  expect(retry.skipped).toHaveLength(2);
  expect(retry.skipped).toEqual(expect.arrayContaining([
    expect.objectContaining({ line: 1, code: 'PF_DUPLICATE_INVOICE' }),
    expect.objectContaining({ line: 2, code: 'PF_DUPLICATE_INVOICE' }),
  ]));
});
