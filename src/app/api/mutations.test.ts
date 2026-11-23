/**
 * 변경 라우트 9개 + PATCH items 단위 시험 — 가짜 rpc로 래퍼 인자 · 응답 · 오류 변환을 본다.
 *
 * 기대(먼저 적음)
 * - C-41 POST /api/items: 품목명 앞뒤 공백은 지워지고 빈 source_url은 null로 pf_create_item에 넘어간다. 201 {data}
 * - C-42 POST /api/purchases: pf_create_purchase 인자(p_source = 'form')와 201. 빈 송장번호 → p_invoice_no null.
 *        계약에 없는 user_id → 400 not_allowed_field, rpc 0회
 * - C-43 purchases/{id}/status: to '품절' → p_id · p_to_status. 목록 밖 값 → 400 not_allowed_value, rpc 0회
 * - C-44 purchases/{id}/receive: order_qty 10인 구매에 5 → p_received_qty 5. 11 → 400 out_of_range(min 1, max 10), rpc 0회.
 *        없는 구매 → 404 PF_NOT_FOUND, rpc 0회
 * - C-45 purchases/{id}/cancel-receipt: p_id만 넘기고 { purchase, stock_qty } 그대로 200
 * - C-46 POST /api/sales: pf_create_sale 인자(p_source 'form')와 201
 * - C-47 sales/{id}/status: to '출고대기' → p_id · p_to_status
 * - C-48 sales/{id}/ship: { sale, stock_qty } 200. PF_INSUFFICIENT_STOCK(detail 포함) → 409 + detail + 04 4.4 문구
 * - C-49 sales/{id}/cancel-shipment: p_id만 넘긴다
 * - C-50 DB 오류 모양 → HTTP: PF_NOT_FOUND 404 · PF_INVALID_TRANSITION 409(detail) · PF_INSUFFICIENT_STOCK 409 ·
 *        PF_NOT_IMPLEMENTED 501 · 모르는 오류 500 PF_INTERNAL(원문 미노출)
 * - C-51 X-PF 헤더 없음 / 다른 Origin → 403 PF_CSRF, rpc · DB 0회 (10개 라우트 전부)
 * - C-52 잘못된 uuid(경로) → 400 field "id" · 잘못된 품목코드 → 400 field "sku_id", rpc · DB 0회
 * - C-53 로그인 안 함 → 401 PF_UNAUTHENTICATED, rpc · DB 0회 (10개 라우트 전부)
 * - C-54 PATCH /api/items/{sku_id}: 공백 제거 · "" → null로 update, 응답 below_safety 포함 · user_id 칸 없음,
 *        없는 품목(남의 품목 포함) → 404, stock_qty · sku_id · user_id 본문 → 400 not_allowed_field(DB 0회),
 *        빈 본문 {} → 400 required(field "body"), item_name "  " → 400 required, DB 오류 → 500 원문 없음
 *
 * 근거: docs/04-api-contract.md 2 · 3.2 ~ 3.4 · 4.1 ~ 4.4, WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 변경 라우트 단위 시험 (WU-41)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fakeRpcDb, type RpcReply } from '@/lib/queries/fakeRpc.testutil';

vi.mock('server-only', () => ({}));
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => holder.client as SupabaseClient }));

import { POST as createItem } from './items/route';
import { PATCH as patchItem } from './items/[sku_id]/route';
import { POST as createPurchase } from './purchases/route';
import { POST as purchaseStatus } from './purchases/[id]/status/route';
import { POST as purchaseReceive } from './purchases/[id]/receive/route';
import { POST as purchaseCancelReceipt } from './purchases/[id]/cancel-receipt/route';
import { POST as createSale } from './sales/route';
import { POST as saleStatus } from './sales/[id]/status/route';
import { POST as saleShip } from './sales/[id]/ship/route';
import { POST as saleCancelShipment } from './sales/[id]/cancel-shipment/route';

const ORIGIN = 'https://app.packflow.test';
const ID = '11111111-1111-4111-8111-111111111111';
const USER = '00000000-0000-4000-8000-000000000001';

type Handler = (request: Request, ctx?: { params?: Promise<Record<string, string>> }) => Promise<Response>;

/** 라우트를 부른다. headers: 'none'이면 X-PF · Origin 없음. */
function call(
  handler: Handler,
  opts: { path: string; method?: string; body?: unknown; params?: Record<string, string>; headers?: 'ok' | 'none' | 'foreign-origin' },
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.headers !== 'none') headers['x-pf'] = '1';
  if (opts.headers === 'foreign-origin') headers.origin = 'https://evil.example';
  else if (opts.headers !== 'none') headers.origin = ORIGIN;
  const request = new Request(`${ORIGIN}${opts.path}`, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return handler(request, { params: Promise.resolve(opts.params ?? {}) });
}

const err = (code: string, detail?: Record<string, unknown>): RpcReply => ({
  error: { message: code, ...(detail ? { details: JSON.stringify(detail) } : {}) },
});

const purchaseRow = { id: ID, order_qty: 10, user_id: USER };
const PURCHASE = { id: ID, purchase_id: 'P-101', status: '발주완료' };
const SALE = { id: ID, sale_id: 'S-201', fulfillment_status: '출고완료' };

const ITEM_BODY = { sku_id: 'PRD-001', item_name: '  테스트 품목  ', unit_cost: 1000, sale_price: 2000, safety_stock: 5, source_url: '' };
const PURCHASE_BODY = { sku_id: 'PRD-001', supplier: ' 거래처 ', order_qty: 10, purchase_cost: 5000, invoice_no: '' };
const SALE_BODY = { sku_id: 'PRD-001', channel: '쿠팡', sold_qty: 3, sale_amount: 9000, invoice_no: '  ' };

/** 10개 라우트 표 — C-51 · C-52 · C-53이 같이 쓴다. */
const ROUTES: Array<{
  name: string;
  handler: Handler;
  path: string;
  method?: string;
  body: unknown;
  params?: Record<string, string>;
  paramName?: 'id' | 'sku_id';
}> = [
  { name: 'POST items', handler: createItem, path: '/api/items', body: ITEM_BODY },
  { name: 'PATCH items/{sku_id}', handler: patchItem, path: '/api/items/PRD-001', method: 'PATCH', body: { item_name: '새 이름' }, params: { sku_id: 'PRD-001' }, paramName: 'sku_id' },
  { name: 'POST purchases', handler: createPurchase, path: '/api/purchases', body: PURCHASE_BODY },
  { name: 'POST purchases/{id}/status', handler: purchaseStatus, path: `/api/purchases/${ID}/status`, body: { to: '품절' }, params: { id: ID }, paramName: 'id' },
  { name: 'POST purchases/{id}/receive', handler: purchaseReceive, path: `/api/purchases/${ID}/receive`, body: { received_qty: 5 }, params: { id: ID }, paramName: 'id' },
  { name: 'POST purchases/{id}/cancel-receipt', handler: purchaseCancelReceipt, path: `/api/purchases/${ID}/cancel-receipt`, body: undefined, params: { id: ID }, paramName: 'id' },
  { name: 'POST sales', handler: createSale, path: '/api/sales', body: SALE_BODY },
  { name: 'POST sales/{id}/status', handler: saleStatus, path: `/api/sales/${ID}/status`, body: { to: '출고대기' }, params: { id: ID }, paramName: 'id' },
  { name: 'POST sales/{id}/ship', handler: saleShip, path: `/api/sales/${ID}/ship`, body: undefined, params: { id: ID }, paramName: 'id' },
  { name: 'POST sales/{id}/cancel-shipment', handler: saleCancelShipment, path: `/api/sales/${ID}/cancel-shipment`, body: undefined, params: { id: ID }, paramName: 'id' },
];

beforeEach(() => {
  holder.client = null;
});

describe('C-41 ~ C-49 변경 라우트 — 래퍼 인자 · 성공 응답', () => {
  it('C-41 POST /api/items: 공백 제거 · 빈 source_url → null로 pf_create_item, 201 {data}', async () => {
    const item = { sku_id: 'PRD-001', stock_qty: 0 };
    const db = fakeRpcDb({ rpc: () => ({ data: item }) });
    holder.client = db.client;
    const res = await call(createItem, { path: '/api/items', body: ITEM_BODY });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: item });
    expect(db.rpcCalls).toEqual([
      {
        fn: 'pf_create_item',
        args: { p_sku_id: 'PRD-001', p_item_name: '테스트 품목', p_unit_cost: 1000, p_sale_price: 2000, p_safety_stock: 5, p_source_url: null },
      },
    ]);
  });

  it('C-42 POST /api/purchases: p_source "form" · 빈 송장 → null · 201. user_id → 400 not_allowed_field, rpc 0회', async () => {
    const db = fakeRpcDb({ rpc: () => ({ data: PURCHASE }) });
    holder.client = db.client;
    const res = await call(createPurchase, { path: '/api/purchases', body: PURCHASE_BODY });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: PURCHASE });
    expect(db.rpcCalls).toEqual([
      {
        fn: 'pf_create_purchase',
        args: { p_sku_id: 'PRD-001', p_supplier: '거래처', p_order_qty: 10, p_purchase_cost: 5000, p_invoice_no: null, p_source: 'form' },
      },
    ]);

    const db2 = fakeRpcDb();
    holder.client = db2.client;
    const bad = await call(createPurchase, { path: '/api/purchases', body: { ...PURCHASE_BODY, user_id: USER } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.detail).toEqual({ field: 'user_id', reason: 'not_allowed_field' });
    expect(db2.rpcCalls).toHaveLength(0);
  });

  it('C-43 purchases/{id}/status: p_id · p_to_status 전달 200. 목록 밖 값 → 400 not_allowed_value, rpc 0회', async () => {
    const db = fakeRpcDb({ rpc: () => ({ data: PURCHASE }) });
    holder.client = db.client;
    const res = await call(purchaseStatus, { path: '/x', body: { to: '품절' }, params: { id: ID } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: PURCHASE });
    expect(db.rpcCalls).toEqual([{ fn: 'pf_set_purchase_status', args: { p_id: ID, p_to_status: '품절' } }]);

    const db2 = fakeRpcDb();
    holder.client = db2.client;
    const bad = await call(purchaseStatus, { path: '/x', body: { to: '입고완료' }, params: { id: ID } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.detail).toEqual({ field: 'to', reason: 'not_allowed_value' });
    expect(db2.rpcCalls).toHaveLength(0);
  });

  it('C-44 purchases/{id}/receive: 5 → p_received_qty 5 · 11 → 400 out_of_range(1~10) · 없는 구매 → 404, 둘 다 rpc 0회', async () => {
    const result = { purchase: PURCHASE, stock_qty: 5 };
    const db = fakeRpcDb({ rpc: () => ({ data: result }), tables: { purchases: [purchaseRow] } });
    holder.client = db.client;
    const ok = await call(purchaseReceive, { path: '/x', body: { received_qty: 5 }, params: { id: ID } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ data: result });
    expect(db.rpcCalls).toEqual([{ fn: 'pf_receive_purchase', args: { p_id: ID, p_received_qty: 5 } }]);
    // 구매는 사용자 클라이언트로 읽었고 order_qty 칸만 요청했다
    expect(db.tableCalls[0]).toMatchObject({ table: 'purchases', kind: 'select', columns: 'order_qty', eq: [['id', ID]] });

    const over = fakeRpcDb({ tables: { purchases: [purchaseRow] } });
    holder.client = over.client;
    const bad = await call(purchaseReceive, { path: '/x', body: { received_qty: 11 }, params: { id: ID } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.detail).toEqual({ field: 'received_qty', reason: 'out_of_range', min: 1, max: 10 });
    expect(over.rpcCalls).toHaveLength(0);

    const none = fakeRpcDb({ tables: { purchases: [] } });
    holder.client = none.client;
    const nf = await call(purchaseReceive, { path: '/x', body: { received_qty: 5 }, params: { id: ID } });
    expect(nf.status).toBe(404);
    expect((await nf.json()).error.code).toBe('PF_NOT_FOUND');
    expect(none.rpcCalls).toHaveLength(0);
  });

  it('C-45 purchases/{id}/cancel-receipt: p_id만 넘기고 {purchase, stock_qty} 그대로 200', async () => {
    const result = { purchase: { ...PURCHASE, status: '입고취소' }, stock_qty: 2 };
    const db = fakeRpcDb({ rpc: () => ({ data: result }) });
    holder.client = db.client;
    const res = await call(purchaseCancelReceipt, { path: '/x', params: { id: ID } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: result });
    expect(db.rpcCalls).toEqual([{ fn: 'pf_cancel_receipt', args: { p_id: ID } }]);
  });

  it('C-46 POST /api/sales: pf_create_sale 인자(p_source "form") · 공백 송장 → null · 201', async () => {
    const db = fakeRpcDb({ rpc: () => ({ data: SALE }) });
    holder.client = db.client;
    const res = await call(createSale, { path: '/api/sales', body: SALE_BODY });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: SALE });
    expect(db.rpcCalls).toEqual([
      {
        fn: 'pf_create_sale',
        args: { p_sku_id: 'PRD-001', p_channel: '쿠팡', p_sold_qty: 3, p_sale_amount: 9000, p_invoice_no: null, p_source: 'form' },
      },
    ]);
  });

  it('C-47 sales/{id}/status: to "출고대기" → p_id · p_to_status', async () => {
    const db = fakeRpcDb({ rpc: () => ({ data: SALE }) });
    holder.client = db.client;
    const res = await call(saleStatus, { path: '/x', body: { to: '출고대기' }, params: { id: ID } });
    expect(res.status).toBe(200);
    expect(db.rpcCalls).toEqual([{ fn: 'pf_set_sale_status', args: { p_id: ID, p_to_status: '출고대기' } }]);
  });

  it('C-48 sales/{id}/ship: 성공 {sale, stock_qty} 200 · 재고 부족 → 409 + detail + 04 4.4 문구', async () => {
    const result = { sale: SALE, stock_qty: 7 };
    const db = fakeRpcDb({ rpc: () => ({ data: result }) });
    holder.client = db.client;
    const ok = await call(saleShip, { path: '/x', params: { id: ID } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ data: result });
    expect(db.rpcCalls).toEqual([{ fn: 'pf_ship_sale', args: { p_id: ID } }]);

    const detail = { sku_id: 'PRD-001', stock_qty: 4, requested: 9 };
    holder.client = fakeRpcDb({ rpc: () => err('PF_INSUFFICIENT_STOCK', detail) }).client;
    const no = await call(saleShip, { path: '/x', params: { id: ID } });
    expect(no.status).toBe(409);
    expect((await no.json()).error).toEqual({ code: 'PF_INSUFFICIENT_STOCK', message: '재고가 부족해요. PRD-001 남은 수량 4개', detail });
  });

  it('C-49 sales/{id}/cancel-shipment: p_id만 넘긴다', async () => {
    const result = { sale: { ...SALE, fulfillment_status: '출고취소' }, stock_qty: 10 };
    const db = fakeRpcDb({ rpc: () => ({ data: result }) });
    holder.client = db.client;
    const res = await call(saleCancelShipment, { path: '/x', params: { id: ID } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: result });
    expect(db.rpcCalls).toEqual([{ fn: 'pf_cancel_shipment', args: { p_id: ID } }]);
  });
});

describe('C-50 DB 오류 모양 → HTTP 코드 · detail', () => {
  const cases: Array<[string, RpcReply, number, string, Record<string, unknown> | undefined]> = [
    ['PF_NOT_FOUND', err('PF_NOT_FOUND'), 404, 'PF_NOT_FOUND', undefined],
    [
      'PF_INVALID_TRANSITION',
      err('PF_INVALID_TRANSITION', { from: '출고완료', to: '출고대기', allowed: ['출고취소'] }),
      409,
      'PF_INVALID_TRANSITION',
      { from: '출고완료', to: '출고대기', allowed: ['출고취소'] },
    ],
    [
      'PF_INSUFFICIENT_STOCK',
      err('PF_INSUFFICIENT_STOCK', { sku_id: 'PRD-002', stock_qty: 0, requested: 1 }),
      409,
      'PF_INSUFFICIENT_STOCK',
      { sku_id: 'PRD-002', stock_qty: 0, requested: 1 },
    ],
    ['PF_NOT_IMPLEMENTED', err('PF_NOT_IMPLEMENTED'), 501, 'PF_NOT_IMPLEMENTED', undefined],
  ];

  it.each(cases)('C-50 %s → HTTP %i, detail 그대로', async (_name, reply, status, code, detail) => {
    holder.client = fakeRpcDb({ rpc: () => reply }).client;
    const res = await call(saleShip, { path: '/x', params: { id: ID } });
    expect(res.status).toBe(status);
    const { error } = await res.json();
    expect(error.code).toBe(code);
    expect(error.detail).toEqual(detail);
  });

  it('C-50 모르는 DB 오류 → 500 PF_INTERNAL, 원문(테이블 · SQL 메시지)은 응답에 없다', async () => {
    holder.client = fakeRpcDb({ rpc: () => ({ error: { message: 'relation "items" secret-detail does not exist', code: '42P01' } }) }).client;
    const res = await call(createItem, { path: '/api/items', body: ITEM_BODY });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text).error.code).toBe('PF_INTERNAL');
    expect(text).not.toContain('secret-detail');
    expect(text).not.toContain('items');
  });

  it('C-50 품목 등록 중복 코드 → 409 PF_DUPLICATE_SKU(detail 포함)', async () => {
    holder.client = fakeRpcDb({ rpc: () => err('PF_DUPLICATE_SKU', { sku_id: 'PRD-001' }) }).client;
    const res = await call(createItem, { path: '/api/items', body: ITEM_BODY });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: 'PF_DUPLICATE_SKU', detail: { sku_id: 'PRD-001' } });
  });
});

describe('C-51 ~ C-53 CSRF · 경로 파라미터 · 로그인 (10개 라우트 전부)', () => {
  it.each(ROUTES)('C-51 $name: X-PF 없음 · 다른 Origin → 403 PF_CSRF, rpc · DB 0회', async (route) => {
    for (const headers of ['none', 'foreign-origin'] as const) {
      const db = fakeRpcDb({ tables: { purchases: [purchaseRow] } });
      holder.client = db.client;
      const res = await call(route.handler, { ...route, headers });
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe('PF_CSRF');
      expect(db.rpcCalls).toHaveLength(0);
      expect(db.tableCalls).toHaveLength(0);
    }
  });

  it.each(ROUTES)('C-53 $name: 로그인 안 함 → 401 PF_UNAUTHENTICATED, rpc · DB 0회', async (route) => {
    const db = fakeRpcDb({ claims: null, tables: { purchases: [purchaseRow] } });
    holder.client = db.client;
    const res = await call(route.handler, route);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('PF_UNAUTHENTICATED');
    expect(db.rpcCalls).toHaveLength(0);
    expect(db.tableCalls).toHaveLength(0);
  });

  const withParam = ROUTES.filter((r) => r.paramName);
  it.each(withParam)('C-52 $name: 잘못된 경로 파라미터 → 400 PF_VALIDATION field=파라미터 이름, rpc · DB 0회', async (route) => {
    const badValues = route.paramName === 'id' ? ['not-a-uuid', '11111111-1111-4111-8111-11111111111Z'] : ['prd-001', 'A'];
    for (const bad of badValues) {
      const db = fakeRpcDb({ tables: { purchases: [purchaseRow], items: [] } });
      holder.client = db.client;
      const res = await call(route.handler, { ...route, params: { [route.paramName!]: bad } });
      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('PF_VALIDATION');
      expect(error.detail.field).toBe(route.paramName);
      expect(db.rpcCalls).toHaveLength(0);
      expect(db.tableCalls).toHaveLength(0);
    }
  });
});

describe('C-54 PATCH /api/items/{sku_id}', () => {
  const itemRow = () => ({
    id: ID, sku_id: 'PRD-001', item_name: '옛 이름', source_url: 'https://old.example', unit_cost: 1000, sale_price: 2000,
    stock_qty: 3, safety_stock: 5, created_at: '2026-11-23T01:00:00.000Z', updated_at: '2026-11-23T01:00:00.000Z', user_id: USER,
  });
  const patch = (body: unknown, sku = 'PRD-001') => call(patchItem, { path: `/api/items/${sku}`, method: 'PATCH', body, params: { sku_id: sku } });

  it('C-54 공백 제거 · "" → null로 update, 응답에 below_safety(3 < 5 → true)가 있고 user_id는 없다', async () => {
    const db = fakeRpcDb({ tables: { items: [itemRow()] } });
    holder.client = db.client;
    const res = await patch({ item_name: '  새 이름 ', source_url: '' });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({ sku_id: 'PRD-001', item_name: '새 이름', source_url: null, stock_qty: 3, below_safety: true });
    expect('user_id' in data).toBe(false);
    expect(db.tableCalls).toHaveLength(1);
    expect(db.tableCalls[0]).toMatchObject({ table: 'items', kind: 'update', values: { item_name: '새 이름', source_url: null }, eq: [['sku_id', 'PRD-001']] });
    expect(db.tableCalls[0].columns).not.toContain('user_id');
    expect(db.rpcCalls).toHaveLength(0);
    // update 값에 재고 · 코드 칸이 섞이지 않았다
    expect(Object.keys(db.tableCalls[0].values ?? {}).sort()).toEqual(['item_name', 'source_url']);
  });

  it('C-54 안전재고를 재고 이하로 낮추면 below_safety false(경계: 3 = 3)', async () => {
    holder.client = fakeRpcDb({ tables: { items: [itemRow()] } }).client;
    const { data } = await (await patch({ safety_stock: 3 })).json();
    expect(data.below_safety).toBe(false);
  });

  it('C-54 없는 품목 · 남의 품목(RLS로 0행) → 404 PF_NOT_FOUND', async () => {
    holder.client = fakeRpcDb({ tables: { items: [] } }).client;
    const res = await patch({ item_name: '새 이름' }, 'PRD-999');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('PF_NOT_FOUND');
  });

  it.each(['stock_qty', 'sku_id', 'user_id', 'id'])('C-54 본문에 %s → 400 not_allowed_field, DB 0회', async (field) => {
    const db = fakeRpcDb({ tables: { items: [itemRow()] } });
    holder.client = db.client;
    const res = await patch({ item_name: '새 이름', [field]: field === 'stock_qty' ? 999 : 'X-1' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.detail).toEqual({ field, reason: 'not_allowed_field' });
    expect(db.tableCalls).toHaveLength(0);
    expect(db.tables.items[0].stock_qty).toBe(3);
  });

  it('C-54 빈 본문 {} → 400 required(field "body"), DB 0회 (스키마 동작 확인용)', async () => {
    const db = fakeRpcDb({ tables: { items: [itemRow()] } });
    holder.client = db.client;
    const res = await patch({});
    expect(res.status).toBe(400);
    expect((await res.json()).error.detail).toEqual({ field: 'body', reason: 'required' });
    expect(db.tableCalls).toHaveLength(0);
  });

  it('C-54 item_name "  "(공백만) → 400 required, 숫자 "10" → 400 not_integer', async () => {
    const db = fakeRpcDb({ tables: { items: [itemRow()] } });
    holder.client = db.client;
    const blank = await patch({ item_name: '  ' });
    expect(blank.status).toBe(400);
    expect((await blank.json()).error.detail).toEqual({ field: 'item_name', reason: 'required' });
    const str = await patch({ unit_cost: '10' });
    expect(str.status).toBe(400);
    expect((await str.json()).error.detail).toEqual({ field: 'unit_cost', reason: 'not_integer' });
    expect(db.tableCalls).toHaveLength(0);
  });

  it('C-54 DB 오류 → 500 PF_INTERNAL, 원문 없음', async () => {
    holder.client = fakeRpcDb({ failTables: ['items'] }).client;
    const res = await patch({ item_name: '새 이름' });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text).error.code).toBe('PF_INTERNAL');
    expect(text).not.toContain('secret-detail');
  });
});

describe('C-55 T-VAL-2 단위판 — 수량 검증이 래퍼 호출 전에 막는다', () => {
  it.each([
    ['"10"', '10', 'not_integer'],
    ['1.5', 1.5, 'not_integer'],
    ['0', 0, 'out_of_range'],
    ['100001', 100001, 'out_of_range'],
  ])('C-55 sold_qty %s → 400 %s, rpc 0회', async (_label, value, reason) => {
    const db = fakeRpcDb();
    holder.client = db.client;
    const res = await call(createSale, { path: '/api/sales', body: { ...SALE_BODY, sold_qty: value } });
    expect(res.status).toBe(400);
    const { detail } = (await res.json()).error;
    expect(detail.field).toBe('sold_qty');
    expect(detail.reason).toBe(reason);
    expect(db.rpcCalls).toHaveLength(0);
  });
});
