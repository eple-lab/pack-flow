/**
 * GET /api/items 라우트 시험 — 가짜 Supabase로 below_safety 계산 · 정렬 · 오류 변환을 본다.
 *
 * 기대(먼저 적음)
 * - C-01 재고 3 / 안전재고 5 → below_safety true. 재고 5 / 안전재고 5 → false(경계). 6/5 → false
 * - C-02 응답은 sku_id 오름차순이고 select 칸에 user_id가 없다
 * - C-03 Supabase 오류 → 500 PF_INTERNAL, 응답에 DB 원문 없음
 * - C-04 로그인 안 함 → 401 PF_UNAUTHENTICATED, DB를 부르지 않음
 *
 * 근거: docs/04-api-contract.md 3.2, WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — items 목록 시험 (WU-41)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fakeDb } from '@/lib/queries/fakeDb.testutil';

vi.mock('server-only', () => ({}));
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => holder.client as SupabaseClient }));

import { GET } from './route';

const row = (sku_id: string, stock_qty: number, safety_stock: number) => ({
  id: `id-${sku_id}`, sku_id, item_name: `이름-${sku_id}`, source_url: null, unit_cost: 1, sale_price: 2,
  stock_qty, safety_stock, created_at: '2026-11-23T01:00:00.000Z', updated_at: '2026-11-23T01:00:00.000Z',
});
const call = () => GET(new Request('https://app.packflow.test/api/items'));

describe('GET /api/items', () => {
  beforeEach(() => { holder.client = null; });

  it('C-01 below_safety = stock_qty < safety_stock (3/5 true, 5/5 false, 6/5 false)', async () => {
    holder.client = fakeDb({ items: [row('PRD-001', 3, 5), row('PRD-002', 5, 5), row('PRD-003', 6, 5)] }).client;
    const res = await call();
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.map((i: { below_safety: boolean }) => i.below_safety)).toEqual([true, false, false]);
  });

  it('C-02 sku_id 오름차순으로 정렬되고 user_id 칸은 요청하지 않는다', async () => {
    const db = fakeDb({ items: [row('PRD-003', 1, 0), row('PRD-001', 1, 0), row('PRD-002', 1, 0)] });
    holder.client = db.client;
    const { data } = await (await call()).json();
    expect(data.map((i: { sku_id: string }) => i.sku_id)).toEqual(['PRD-001', 'PRD-002', 'PRD-003']);
    const select = db.calls[0].ops.find((o) => o.op === 'select')!;
    expect(String(select.args[0])).not.toContain('user_id');
  });

  it('C-03 Supabase 오류 → 500 PF_INTERNAL, 원문은 응답에 없다', async () => {
    holder.client = fakeDb({}, { failTables: ['items'] }).client;
    const res = await call();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text).error.code).toBe('PF_INTERNAL');
    expect(text).not.toContain('secret-detail');
  });

  it('C-04 로그인 안 함 → 401, DB 조회 없음', async () => {
    const db = fakeDb({ items: [row('PRD-001', 1, 1)] }, { claims: null });
    holder.client = db.client;
    const res = await call();
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('PF_UNAUTHENTICATED');
    expect(db.calls).toHaveLength(0);
  });
});
