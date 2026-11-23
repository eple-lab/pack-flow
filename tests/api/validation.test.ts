/**
 * API 입력 검증 시험 — T-VAL-2 · 3 · 4 (실제 사용자 JWT · dev DB, 라우트를 직접 부른다).
 *
 * 하는 일
 * 1. 계정 A로 로그인하고 createServerSupabase를 그 클라이언트로 바꿔(vi.mock) route 모듈의 POST · PATCH를
 *    Request(X-PF: 1, 같은 Origin)로 직접 부른다. 서버 · 쿠키 없이 라우트 코드 전체(CSRF → 로그인 → 검증 → DB)를 탄다.
 * 2. 환경변수가 없으면 건너뛰지 않고 실패한다(tests/db/helpers.ts의 signIn이 그렇다).
 * 3. 계정 A 데이터만 쓴다. 시작 · 끝에 demo 시드로 초기화한다(helpers.resetAndSeed, 본인 데이터만).
 *
 * 기대(먼저 적음)
 * - T-VAL-2 수량 "10" · 1.5 · 0 · 100001 → 400 PF_VALIDATION, reason not_integer · not_integer · out_of_range · out_of_range.
 *           판매 sold_qty · 구매 order_qty 둘 다. 검증에서 막히므로 DB 행 수는 그대로
 * - T-VAL-3 user_id · stock_qty(구매 · 판매 · 품목 등록 · 품목 수정) → 400 not_allowed_field, 그 전후 items 행 전체(재고 포함)가 같다
 * - T-VAL-4 품목명 앞뒤 공백 → 지워서 저장, 빈 선택 칸 "" → null 저장.
 *           - 수정(PATCH)은 DB 함수 없이 되므로 지금 통과해야 한다
 *           - 등록(POST /api/items → pf_create_item)은 dev DB에 실제 SQL이 없으면 PF_NOT_IMPLEMENTED(501)로 실패한다(그대로 둔다)
 *
 * 근거: docs/07-test-strategy.md T-VAL-2 · 3 · 4, docs/04-api-contract.md 4.1 · 4.2
 * 구역: eple (docs/06-work-plan.md 1절 '테스트 기반')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — T-VAL-2 · 3 · 4 API 시험 (WU-41)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { resetAndSeed, signIn } from '../db/helpers';

vi.mock('server-only', () => ({}));
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => holder.client as SupabaseClient }));

import { PATCH as patchItem } from '@/app/api/items/[sku_id]/route';
import { POST as postItem } from '@/app/api/items/route';
import { POST as postPurchase } from '@/app/api/purchases/route';
import { POST as postSale } from '@/app/api/sales/route';

const ORIGIN = 'https://app.packflow.test';
type Handler = (request: Request, ctx?: { params?: Promise<Record<string, string>> }) => Promise<Response>;

function call(handler: Handler, path: string, method: string, body: unknown, params: Record<string, string> = {}) {
  const request = new Request(`${ORIGIN}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-pf': '1', origin: ORIGIN },
    body: JSON.stringify(body),
  });
  return handler(request, { params: Promise.resolve(params) });
}

let client: SupabaseClient;

/** items 행 전체(재고 포함)를 품목코드 순으로 읽는다. */
async function snapshotItems() {
  const { data, error } = await client.from('items').select('*').order('sku_id', { ascending: true });
  expect(error).toBeNull();
  return data;
}

async function countOf(table: 'purchases' | 'sales' | 'stock_logs') {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
  expect(error).toBeNull();
  return count ?? 0;
}

const SALE_OK = { sku_id: 'PRD-001', channel: '쿠팡', sold_qty: 1, sale_amount: 1000, invoice_no: null };
const PURCHASE_OK = { sku_id: 'PRD-001', supplier: '거래처', order_qty: 1, purchase_cost: 1000, invoice_no: null };

beforeAll(async () => {
  client = await signIn('A');
  holder.client = client;
  await resetAndSeed(client, 'demo');
});

afterAll(async () => {
  // 시험이 만든 품목을 정리한다. 실패해도 시험 결과를 가리지 않는다.
  try {
    await resetAndSeed(client, 'demo');
  } catch {
    /* 정리 실패는 무시 */
  }
});

describe('T-VAL-2 수량 검증', () => {
  const cases: Array<[string, unknown, string]> = [
    ['"10"(문자열)', '10', 'not_integer'],
    ['1.5', 1.5, 'not_integer'],
    ['0', 0, 'out_of_range'],
    ['100001', 100001, 'out_of_range'],
  ];

  it.each(cases)('T-VAL-2a 판매 sold_qty %s → 400 %s 이유, DB 변화 없음', async (_label, value, reason) => {
    const before = [await countOf('sales'), await countOf('stock_logs')];
    const res = await call(postSale, '/api/sales', 'POST', { ...SALE_OK, sold_qty: value });
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('PF_VALIDATION');
    expect(error.detail).toMatchObject({ field: 'sold_qty', reason });
    expect([await countOf('sales'), await countOf('stock_logs')]).toEqual(before);
  });

  it.each(cases)('T-VAL-2b 구매 order_qty %s → 400 %s 이유, DB 변화 없음', async (_label, value, reason) => {
    const before = [await countOf('purchases'), await countOf('stock_logs')];
    const res = await call(postPurchase, '/api/purchases', 'POST', { ...PURCHASE_OK, order_qty: value });
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('PF_VALIDATION');
    expect(error.detail).toMatchObject({ field: 'order_qty', reason });
    expect([await countOf('purchases'), await countOf('stock_logs')]).toEqual(before);
  });
});

describe('T-VAL-3 계약에 없는 필드', () => {
  const targets: Array<[string, Handler, string, string, Record<string, unknown>, Record<string, string>]> = [
    ['판매 등록', postSale, '/api/sales', 'POST', SALE_OK, {}],
    ['구매 등록', postPurchase, '/api/purchases', 'POST', PURCHASE_OK, {}],
    ['품목 등록', postItem, '/api/items', 'POST', { sku_id: 'TST-VAL3', item_name: 'x', unit_cost: 1, sale_price: 1, safety_stock: 0 }, {}],
    ['품목 수정', patchItem, '/api/items/PRD-001', 'PATCH', { item_name: '바꾸려는 이름' }, { sku_id: 'PRD-001' }],
  ];
  const extras: Array<[string, unknown]> = [
    ['user_id', '00000000-0000-4000-8000-000000000001'],
    ['stock_qty', 9999],
  ];

  for (const [label, handler, path, method, base, params] of targets) {
    for (const [field, value] of extras) {
      it(`T-VAL-3 ${label} + ${field} → 400 not_allowed_field, items 행(재고 포함) 전후 같음`, async () => {
        const before = await snapshotItems();
        const counts = [await countOf('purchases'), await countOf('sales'), await countOf('stock_logs')];
        const res = await call(handler, path, method, { ...base, [field]: value }, params);
        expect(res.status).toBe(400);
        const { error } = await res.json();
        expect(error.code).toBe('PF_VALIDATION');
        expect(error.detail).toEqual({ field, reason: 'not_allowed_field' });
        expect(await snapshotItems()).toEqual(before);
        expect([await countOf('purchases'), await countOf('sales'), await countOf('stock_logs')]).toEqual(counts);
      });
    }
  }
});

describe('T-VAL-4 공백 · 빈 값 정규화', () => {
  it('T-VAL-4a 품목 수정: 품목명 앞뒤 공백은 지워 저장, source_url ""은 null로 저장', async () => {
    const res = await call(patchItem, '/api/items/PRD-001', 'PATCH', { item_name: '   공백 품목   ', source_url: '' }, { sku_id: 'PRD-001' });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.item_name).toBe('공백 품목');
    expect(data.source_url).toBeNull();
    const { data: row, error } = await client.from('items').select('item_name, source_url').eq('sku_id', 'PRD-001').single();
    expect(error).toBeNull();
    expect(row).toEqual({ item_name: '공백 품목', source_url: null });
  });

  it('T-VAL-4b 품목 등록: 품목명 앞뒤 공백은 지워 저장, source_url ""은 null로 저장 (pf_create_item 실제 SQL 필요)', async () => {
    const sku = `TST-${Math.floor(100000 + Math.random() * 900000)}`;
    const res = await call(postItem, '/api/items', 'POST', {
      sku_id: sku, item_name: `  ${sku} 이름  `, unit_cost: 100, sale_price: 200, safety_stock: 1, source_url: '   ',
    });
    // pf_create_item이 아직 stub이면 여기서 501로 실패한다 — 건너뛰지 않는다
    expect(res.status).toBe(201);
    const { data: row, error } = await client.from('items').select('item_name, source_url, stock_qty').eq('sku_id', sku).single();
    expect(error).toBeNull();
    expect(row).toEqual({ item_name: `${sku} 이름`, source_url: null, stock_qty: 0 });
  });
});
