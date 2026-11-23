/**
 * T-S1-3(API 쪽) 대시보드 = DB 직접 집계 — 실제 dev DB · 사용자 JWT로 입고 → 출고 → GET /api/dashboard.
 *
 * 하는 일
 * 1. 계정 A로 로그인하고 createServerSupabase를 그 클라이언트로 바꿔(vi.mock) route 모듈을 Request로 직접 부른다.
 * 2. demo 시드를 넣고 대시보드를 시드의 expected · DB 직접 집계와 비교한다.
 * 3. API로 P-101 8개 입고 → S-201 출고(6개) 뒤 다시 비교한다(화면의 '입고 → 출고 → 대시보드 갱신'을 API로).
 * 4. 끝에 demo 시드로 되돌린다(계정 A 데이터만).
 *
 * 기대(먼저 적음) — demo 시드: PRD-001 10/안전 5, PRD-002 40/15, PRD-003 3/5, P-101 이동·통관중(10개), S-201 출고대기(PRD-001 6개)
 * - 시작: kpi item_count 3 · stock_total 53 · below_safety 1(PRD-003) = expected, today_in 0 · today_out 0, alerts [PRD-003]
 * - P-101 8개 입고 → 200, stock_qty 18 / S-201 출고 → 200, stock_qty 12
 * - 끝: stock_total 55(53 + 8 − 6), PRD-001 12, today_in 1 · today_out 1,
 *       pipeline 구매 입고완료 1 · 이동·통관중 0, 판매 출고완료 1 · 출고대기 0, recent_changes[0] = PRD-001 −6 실판매출고, [1] = +8 구매입고
 * - 매 단계 kpi · items 재고 = DB에서 직접 읽어 센 값
 * - 실패해야 함: S-201을 한 번 더 출고 → 409 PF_INVALID_TRANSITION, 대시보드 값 그대로
 *
 * 근거: docs/07-test-strategy.md T-S1-3, docs/04-api-contract.md 3.3 · 3.4 · 3.5, WU-41 다 됐다의 기준
 * 구역: eple (docs/06-work-plan.md 1절 'API 테스트')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — T-S1-3 API 쪽 실제 DB 시험 (WU-41)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import demo from '@/lib/seed/demo.json';
import type { Dashboard } from '@/types/erp';
import { resetAndSeed, signIn } from '../db/helpers';

vi.mock('server-only', () => ({}));
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => holder.client as SupabaseClient }));

import { GET as getDashboard } from '@/app/api/dashboard/route';
import { POST as postReceive } from '@/app/api/purchases/[id]/receive/route';
import { POST as postShip } from '@/app/api/sales/[id]/ship/route';

const ORIGIN = 'https://app.packflow.test';

async function dashboard(): Promise<Dashboard> {
  const response = await getDashboard(new Request(`${ORIGIN}/api/dashboard`, { headers: { origin: ORIGIN } }));
  expect(response.status).toBe(200);
  return (await response.json()).data as Dashboard;
}

type Handler = (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
async function post(handler: Handler, path: string, id: string, body: unknown = {}) {
  const response = await handler(
    new Request(`${ORIGIN}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-pf': '1', origin: ORIGIN },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
  return { status: response.status, body: await response.json() };
}

let client: SupabaseClient;

/** DB에서 직접 읽어 센 값(대시보드 계산과 별개로). */
async function directKpi() {
  const { data, error } = await client.from('items').select('sku_id, stock_qty, safety_stock');
  expect(error).toBeNull();
  const rows = data ?? [];
  return {
    item_count: rows.length,
    stock_total: rows.reduce((s, r) => s + r.stock_qty, 0),
    below_safety: rows.filter((r) => r.stock_qty < r.safety_stock).length,
    stock: Object.fromEntries(rows.map((r) => [r.sku_id, r.stock_qty])),
  };
}

async function uuidOf(table: 'purchases' | 'sales', column: 'purchase_id' | 'sale_id', value: string) {
  const { data, error } = await client.from(table).select('id').eq(column, value).single();
  expect(error).toBeNull();
  return (data as { id: string }).id;
}

beforeAll(async () => {
  client = await signIn('A');
  holder.client = client;
  await resetAndSeed(client, 'demo');
});

afterAll(async () => {
  await resetAndSeed(client, 'demo');
});

describe('T-S1-3 대시보드 = DB 집계 (API 쪽, 실제 DB)', () => {
  it('T-S1-3a demo 시드 직후 kpi · 재고 = 시드 expected = DB 직접 집계', async () => {
    const d = await dashboard();
    const direct = await directKpi();
    expect(d.kpi).toMatchObject(demo.expected.kpi);
    expect(d.kpi).toMatchObject({ item_count: direct.item_count, stock_total: direct.stock_total, below_safety: direct.below_safety });
    expect(Object.fromEntries(d.items.map((i) => [i.sku_id, i.stock_qty]))).toEqual(demo.expected.stock);
    expect(d.kpi.today_in).toBe(0);
    expect(d.kpi.today_out).toBe(0);
    expect(d.alerts.map((a) => a.sku_id)).toEqual(['PRD-003']);
  });

  it('T-S1-3b P-101 8개 입고 → S-201 출고 → 대시보드가 같이 바뀌고 DB 집계와 같다', async () => {
    const received = await post(postReceive, '/api/purchases/x/receive', await uuidOf('purchases', 'purchase_id', 'P-101'), { received_qty: 8 });
    expect(received.status).toBe(200);
    expect(received.body.data.stock_qty).toBe(18);

    const shipped = await post(postShip, '/api/sales/x/ship', await uuidOf('sales', 'sale_id', 'S-201'));
    expect(shipped.status).toBe(200);
    expect(shipped.body.data.stock_qty).toBe(12);

    const d = await dashboard();
    const direct = await directKpi();
    expect(d.kpi).toEqual({ item_count: 3, stock_total: 55, below_safety: 1, today_in: 1, today_out: 1 });
    expect(d.kpi).toMatchObject({ item_count: direct.item_count, stock_total: direct.stock_total, below_safety: direct.below_safety });
    expect(Object.fromEntries(d.items.map((i) => [i.sku_id, i.stock_qty]))).toEqual(direct.stock);
    expect(d.pipeline.purchase['입고완료']).toBe(1);
    expect(d.pipeline.purchase['이동·통관중']).toBe(0);
    expect(d.pipeline.sale['출고완료']).toBe(1);
    expect(d.pipeline.sale['출고대기']).toBe(0);
    expect(d.recent_changes.slice(0, 2).map((l) => [l.sku_id, l.change_qty, l.reason])).toEqual([
      ['PRD-001', -6, '실판매출고'],
      ['PRD-001', 8, '구매입고'],
    ]);
  });

  it('T-S1-3c (실패해야 함) 같은 판매를 한 번 더 출고 → 409 PF_INVALID_TRANSITION, 대시보드 그대로', async () => {
    const before = await dashboard();
    const again = await post(postShip, '/api/sales/x/ship', await uuidOf('sales', 'sale_id', 'S-201'));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('PF_INVALID_TRANSITION');
    const after = await dashboard();
    expect(after.kpi).toEqual(before.kpi);
    expect(after.recent_changes).toEqual(before.recent_changes);
  });
});
