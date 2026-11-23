/**
 * T-AUTH API 권한 시험 — 테스트 계정 A · B로 서로의 id를 써서 라우트를 실제 dev DB에 부른다.
 *
 * 하는 일
 * 1. createServerSupabase를 vi.mock으로 바꿔, 시험마다 "누구로 부를지"(A · B · 로그인 안 함)를 고른다.
 * 2. route 모듈의 GET · POST · PATCH를 Request로 직접 부른다(CSRF → 로그인 → 검증 → DB 전체를 탄다).
 * 3. A · B 둘 다 demo 시드로 시작하고 끝낸다(각자 본인 데이터만 초기화된다).
 *
 * 기대(먼저 적음)
 * - T-AUTH-1 로그인 없이 GET /api/items → 401 PF_UNAUTHENTICATED
 * - T-AUTH-2 B가 A의 구매 id로 receive → 404 PF_NOT_FOUND, A의 재고 · 이력 건수 · 구매 상태 그대로
 * - T-AUTH-3 B가 A의 판매 id로 ship → 404 PF_NOT_FOUND, A 그대로
 * - (덧붙임) B가 PATCH /api/items/PRD-001 → B 자기 품목만 바뀌고 A의 같은 품목코드 행은 그대로
 *            B의 GET /api/purchases 목록에 A의 구매 id가 없다
 * - T-AUTH-7 B가 POST /api/seed {dataset: demo} → 200, B 데이터만 demo로 바뀌고 A의 재고 · 이력 · 거래 그대로
 * - T-AUTH-8 X-PF 헤더 없이 POST /api/sales → 403 PF_CSRF, 판매 건수 그대로
 *
 * 근거: docs/05-security.md 3절 T-AUTH, docs/work-units/WU-42-auth-tests.md
 * 구역: eple (docs/06-work-plan.md 1절 'API 테스트')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — T-AUTH-1 · 2 · 3 · 7 · 8 (WU-42)
 * 2026-11-23  eple  T-AUTH-7을 DB 함수 대신 POST /api/seed 라우트로 (WU-43)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadLocalEnv, resetAndSeed, signIn } from '../db/helpers';

vi.mock('server-only', () => ({}));
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => holder.client as SupabaseClient }));

import { PATCH as patchItem } from '@/app/api/items/[sku_id]/route';
import { GET as getItems } from '@/app/api/items/route';
import { POST as postReceive } from '@/app/api/purchases/[id]/receive/route';
import { GET as getPurchases } from '@/app/api/purchases/route';
import { POST as postShip } from '@/app/api/sales/[id]/ship/route';
import { POST as postSale } from '@/app/api/sales/route';
import { POST as postSeed } from '@/app/api/seed/route';

const ORIGIN = 'https://app.packflow.test';
type Handler = (request: Request, ctx?: { params?: Promise<Record<string, string>> }) => Promise<Response>;

async function call(
  handler: Handler,
  path: string,
  init: { method?: string; body?: unknown; csrf?: boolean; params?: Record<string, string> } = {},
) {
  const { method = 'GET', body, csrf = true, params = {} } = init;
  const headers: Record<string, string> = { origin: ORIGIN };
  if (method !== 'GET') {
    headers['content-type'] = 'application/json';
    if (csrf) headers['x-pf'] = '1';
  }
  const response = await handler(
    new Request(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    { params: Promise.resolve(params) },
  );
  return { status: response.status, body: await response.json() };
}

let clientA: SupabaseClient;
let clientB: SupabaseClient;

/** A의 상태를 A 자신의 클라이언트로 읽는다(비교용 스냅샷). */
async function snapshotA() {
  const [items, logs, purchases, sales] = await Promise.all([
    clientA.from('items').select('sku_id, stock_qty, item_name').order('sku_id'),
    clientA.from('stock_logs').select('*', { count: 'exact', head: true }),
    clientA.from('purchases').select('purchase_id, status, received_qty').order('purchase_id'),
    clientA.from('sales').select('sale_id, fulfillment_status').order('sale_id'),
  ]);
  for (const r of [items, logs, purchases, sales]) expect(r.error).toBeNull();
  return { items: items.data, logs: logs.count, purchases: purchases.data, sales: sales.data };
}

async function idOfA(table: 'purchases' | 'sales', column: 'purchase_id' | 'sale_id', value: string) {
  const { data, error } = await clientA.from(table).select('id').eq(column, value).single();
  expect(error).toBeNull();
  return (data as { id: string }).id;
}

beforeAll(async () => {
  clientA = await signIn('A');
  clientB = await signIn('B');
  await resetAndSeed(clientA, 'demo');
  await resetAndSeed(clientB, 'demo');
});

afterAll(async () => {
  await resetAndSeed(clientA, 'demo');
  await resetAndSeed(clientB, 'demo');
});

describe('T-AUTH API 권한 (실제 dev DB, 계정 A · B)', () => {
  it('T-AUTH-1 로그인 없이 GET /api/items → 401 PF_UNAUTHENTICATED', async () => {
    loadLocalEnv();
    holder.client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const res = await call(getItems, '/api/items');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('PF_UNAUTHENTICATED');
  });

  it('T-AUTH-2 B가 A의 구매 id로 입고 확정 → 404, A의 재고 · 이력 · 구매 그대로', async () => {
    const before = await snapshotA();
    const id = await idOfA('purchases', 'purchase_id', 'P-101');
    holder.client = clientB;
    const res = await call(postReceive, '/api/purchases/x/receive', { method: 'POST', body: { received_qty: 1 }, params: { id } });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PF_NOT_FOUND');
    expect(await snapshotA()).toEqual(before);
  });

  it('T-AUTH-3 B가 A의 판매 id로 출고 확정 → 404, A 그대로', async () => {
    const before = await snapshotA();
    const id = await idOfA('sales', 'sale_id', 'S-201');
    holder.client = clientB;
    const res = await call(postShip, '/api/sales/x/ship', { method: 'POST', body: {}, params: { id } });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PF_NOT_FOUND');
    expect(await snapshotA()).toEqual(before);
  });

  it('T-AUTH-2b B의 품목 수정은 B 행만 바꾸고, 같은 품목코드의 A 행은 그대로 / B 구매 목록에 A의 구매 없음', async () => {
    const before = await snapshotA();
    holder.client = clientB;
    const patched = await call(patchItem, '/api/items/PRD-001', { method: 'PATCH', body: { item_name: 'B가 바꾼 이름' }, params: { sku_id: 'PRD-001' } });
    expect(patched.status).toBe(200);
    expect(patched.body.data.item_name).toBe('B가 바꾼 이름');
    expect(await snapshotA()).toEqual(before);

    const aPurchaseId = await idOfA('purchases', 'purchase_id', 'P-101');
    const list = await call(getPurchases, '/api/purchases');
    expect(list.status).toBe(200);
    expect((list.body.data as { id: string }[]).some((p) => p.id === aPurchaseId)).toBe(false);
  });

  it('T-AUTH-7 B가 POST /api/seed(demo) → 200, B만 demo로 바뀌고 A 그대로', async () => {
    // B를 demo와 다른 상태로 만들어 두어야 초기화가 실제로 일어났는지 보인다
    await resetAndSeed(clientB, { items: [{ sku_id: 'BBB-001', item_name: 'B 전용', unit_cost: 1, sale_price: 2, initial_qty: 1, safety_stock: 0 }] });
    const before = await snapshotA();
    holder.client = clientB;
    const res = await call(postSeed, '/api/seed', { method: 'POST', body: { dataset: 'demo' } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ items: 3, purchases: 1, sales: 2 });
    const { data: bItems, error } = await clientB.from('items').select('sku_id').order('sku_id');
    expect(error).toBeNull();
    expect((bItems ?? []).map((r) => r.sku_id)).toEqual(['PRD-001', 'PRD-002', 'PRD-003']);
    expect(await snapshotA()).toEqual(before);
  });

  it('T-AUTH-8 X-PF 헤더 없이 POST /api/sales → 403 PF_CSRF, 판매 건수 그대로', async () => {
    holder.client = clientB;
    const { count: beforeCount } = await clientB.from('sales').select('*', { count: 'exact', head: true });
    const res = await call(postSale, '/api/sales', {
      method: 'POST',
      csrf: false,
      body: { sku_id: 'BBB-001', channel: '쿠팡', sold_qty: 1, sale_amount: 1, invoice_no: null },
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PF_CSRF');
    const { count: afterCount } = await clientB.from('sales').select('*', { count: 'exact', head: true });
    expect(afterCount).toBe(beforeCount);
  });
});
