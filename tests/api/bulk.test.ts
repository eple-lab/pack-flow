/**
 * 일괄 등록 API 시험 — /api/bulk/preview · /api/bulk/commit을 실제 dev DB(pf_bulk_apply)로 부른다.
 *
 * 하는 일
 * 1. createServerSupabase를 vi.mock으로 계정 A의 클라이언트로 바꾸고 route의 POST를 Request로 직접 부른다.
 * 2. parse(jkspawn WU-13)는 아직 없을 수 있어 시험용 간이 parse로 바꾼다(탭 6칸). 이 시험이 보는 것은 DB 쪽이다.
 * 3. 시험마다 demo 시드로 시작하고(PRD-001 재고 10), 끝에 assertInvariants로 T-INV 위반 0행을 확인한다.
 * 4. 새 마이그레이션 20261124090000_bulk_apply.sql이 dev에 적용돼야 통과한다(자리 함수는 PF_NOT_IMPLEMENTED).
 *
 * 기대(먼저 적음)
 * - T-S3-5 입고 7행 + 실패 3행(없는 품목 · 출고 100개 · 중복 송장)을 commit → 200, applied 7, skipped 3
 *          (line 8 PF_NOT_FOUND · line 9 PF_INSUFFICIENT_STOCK · line 10 PF_DUPLICATE_INVOICE),
 *          PRD-001 재고 17, 구매 건수 +7, 판매 건수 +0(실패한 출고 행의 판매 생성도 되돌려짐), T-INV 0행
 * - 출고 행 성공: 출고 2개 → applied 1, 재고 8, 판매 건수 +1, 그 판매의 상태 '출고완료'
 * - T-S4-4 같은 행을 다시 commit → applied 0, skipped 2 모두 PF_DUPLICATE_INVOICE, 재고 그대로
 * - preview 전후 건수 같음: 유효 · 무효(없는 품목 · 이미 등록된 송장 · 재고 초과)가 섞인 붙여넣기를 preview해도
 *          items · purchases · sales · stock_logs 건수와 PRD-001 재고가 그대로. 행별 valid가 DB 상태와 맞음
 * - 행 수 501 commit → 400 PF_VALIDATION, DB 그대로
 * - 함수 직접 호출에서 501행 → PF_VALIDATION (스키마를 우회해도 함수가 한 번 더 막는다)
 *
 * 근거: docs/07-test-strategy.md T-S3-5 · T-S4-4 · T-INV, docs/work-units/WU-43-bulk-seed-api.md
 * 구역: eple (docs/06-work-plan.md 1절 'API 테스트')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 일괄 등록 API 시험 (WU-43)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { bulkApply } from '@/lib/inventory';
import type { BulkErrorReason, BulkRowInput } from '@/types/erp';
import { assertInvariants, resetAndSeed, signIn } from '../db/helpers';

vi.mock('server-only', () => ({}));
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => holder.client as SupabaseClient }));

/** 시험용 간이 parse: 줄마다 탭 6칸(구분 품목코드 수량 거래처 송장 비고). */
vi.mock('@/lib/bulk/parse', () => ({
  parse: (text: string) => {
    const rows: BulkRowInput[] = [];
    const errors: Array<{ line: number; reason: BulkErrorReason }> = [];
    text.split('\n').forEach((raw, index) => {
      if (raw.trim() === '') return;
      const cols = raw.split('\t');
      if (cols.length !== 6) {
        errors.push({ line: index + 1, reason: '열 개수 오류' });
        return;
      }
      rows.push({
        line: index + 1,
        kind: cols[0] as '입고' | '출고',
        sku_id: cols[1],
        qty: Number(cols[2]),
        partner: cols[3],
        invoice_no: cols[4] || null,
        memo: cols[5] || null,
      });
    });
    return { rows, errors };
  },
}));

import { POST as commit } from '@/app/api/bulk/commit/route';
import { POST as preview } from '@/app/api/bulk/preview/route';

const ORIGIN = 'https://app.packflow.test';
let a: SupabaseClient;

async function post(handler: (r: Request) => Promise<Response>, body: unknown) {
  const response = await handler(
    new Request(`${ORIGIN}/api/bulk/x`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-pf': '1' },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: await response.json() };
}

function row(line: number, overrides: Partial<BulkRowInput> = {}): BulkRowInput {
  return { line, kind: '입고', sku_id: 'PRD-001', qty: 1, partner: '가상 공급처', invoice_no: `BULK-${line}`, memo: null, ...overrides };
}

async function counts() {
  const out: Record<string, number> = {};
  for (const table of ['items', 'purchases', 'sales', 'stock_logs']) {
    const r = await a.from(table).select('*', { count: 'exact', head: true });
    expect(r.error).toBeNull();
    out[table] = r.count ?? -1;
  }
  const stock = await a.from('items').select('stock_qty').eq('sku_id', 'PRD-001').single();
  expect(stock.error).toBeNull();
  out.stock = (stock.data as { stock_qty: number }).stock_qty;
  return out;
}

beforeAll(async () => {
  a = await signIn('A');
  holder.client = a;
});
beforeEach(async () => {
  holder.client = a;
  await resetAndSeed(a, 'demo');
});
afterEach(async () => {
  if (a) await assertInvariants(a); // T-INV 0행
});

describe('일괄 반영 /api/bulk/commit (실제 dev DB)', () => {
  it('T-S3-5 입고 7행 + 실패 3행 → 성공 7행만 남고 실패 3행은 skipped, 재고 17', async () => {
    const before = await counts();
    const good = Array.from({ length: 7 }, (_, i) => row(i + 1));
    const rows = [
      ...good,
      row(8, { sku_id: 'MISSING-001' }),
      row(9, { kind: '출고', qty: 100, partner: '쿠팡', invoice_no: 'BULK-9' }),
      row(10, { invoice_no: good[0].invoice_no }),
    ];
    const res = await post(commit, { rows });
    expect(res.status).toBe(200);
    expect(res.body.data.applied).toBe(7);
    expect(res.body.data.skipped).toHaveLength(3);
    expect(res.body.data.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ line: 8, code: 'PF_NOT_FOUND' }),
        expect.objectContaining({ line: 9, code: 'PF_INSUFFICIENT_STOCK' }),
        expect.objectContaining({ line: 10, code: 'PF_DUPLICATE_INVOICE' }),
      ]),
    );
    const after = await counts();
    expect(after.stock).toBe(17);
    expect(after.purchases).toBe(before.purchases + 7);
    expect(after.sales).toBe(before.sales); // 실패한 출고 행의 판매 생성도 되돌려졌다
  });

  it('출고 행 성공: 출고 2개 → 재고 8, 판매 +1, 상태 출고완료', async () => {
    const before = await counts();
    const res = await post(commit, { rows: [row(1, { kind: '출고', qty: 2, partner: '쿠팡', invoice_no: 'BULK-OUT-1' })] });
    expect(res.body.data).toEqual({ applied: 1, skipped: [] });
    const after = await counts();
    expect(after.stock).toBe(8);
    expect(after.sales).toBe(before.sales + 1);
    const sale = await a.from('sales').select('fulfillment_status, source').eq('invoice_no', 'BULK-OUT-1').single();
    expect(sale.data).toEqual({ fulfillment_status: '출고완료', source: 'bulk' });
  });

  it('T-S4-4 같은 행을 다시 반영하면 0행, 2행 모두 중복 송장으로 건너뜀', async () => {
    const rows = [row(1), row(2)];
    expect((await post(commit, { rows })).body.data).toEqual({ applied: 2, skipped: [] });
    const mid = await counts();
    const retry = await post(commit, { rows });
    expect(retry.body.data.applied).toBe(0);
    expect(retry.body.data.skipped).toEqual([
      expect.objectContaining({ line: 1, code: 'PF_DUPLICATE_INVOICE' }),
      expect.objectContaining({ line: 2, code: 'PF_DUPLICATE_INVOICE' }),
    ]);
    expect(await counts()).toEqual(mid);
  });

  it('501행 commit → 400 PF_VALIDATION, DB 그대로', async () => {
    const before = await counts();
    const res = await post(commit, { rows: Array.from({ length: 501 }, (_, i) => row(i + 1)) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PF_VALIDATION');
    expect(await counts()).toEqual(before);
  });

  it('함수 직접 호출 501행 → PF_VALIDATION (스키마를 우회해도 함수가 막는다)', async () => {
    const before = await counts();
    await expect(bulkApply(a, { rows: Array.from({ length: 501 }, (_, i) => row(i + 1)) })).rejects.toMatchObject({ code: 'PF_VALIDATION' });
    expect(await counts()).toEqual(before);
  });
});

describe('미리보기 /api/bulk/preview (실제 dev DB)', () => {
  it('유효 · 무효가 섞여도 DB 건수 · 재고가 그대로이고 행별 valid가 DB 상태와 맞다', async () => {
    // 이미 등록된 송장을 하나 만들어 둔다
    await post(commit, { rows: [row(1, { invoice_no: 'TAKEN-1' })] });
    const before = await counts();
    const tsv = (kind: string, sku: string, qty: number, partner: string, inv: string) => [kind, sku, qty, partner, inv, '메모'].join('\t');
    const text = [
      tsv('입고', 'PRD-001', 1, '공급처', 'NEW-1'),
      tsv('입고', 'MISSING-001', 1, '공급처', 'NEW-2'),
      tsv('입고', 'PRD-001', 1, '공급처', 'TAKEN-1'),
      tsv('출고', 'PRD-001', 999, '쿠팡', 'NEW-3'),
    ].join('\n');
    const res = await post(preview, { format: 'tsv', text });
    expect(res.status).toBe(200);
    const rows = res.body.data.rows as Array<{ line: number; valid: boolean; errors: string[] }>;
    expect(rows.map((r) => r.valid)).toEqual([true, false, false, false]);
    expect(rows[1].errors).toEqual(['미등록 품목코드']);
    expect(rows[2].errors).toEqual(['이미 등록된 송장번호']);
    expect(rows[3].errors).toEqual(['출고 수량이 재고보다 많음(미리보기 시점 기준)']);
    expect(await counts()).toEqual(before);
  });
});
