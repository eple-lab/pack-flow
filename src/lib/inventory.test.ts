/**
 * inventory.ts 단위 테스트 — 래퍼가 맞는 DB 함수를 맞는 인자 이름으로 부르는지, 오류를 PfError로 옮기는지.
 *
 * 하는 일: 기대(함수 이름 · 인자 이름 · 오류 코드 · HTTP 상태)를 먼저 적고 가짜 rpc로 확인한다.
 * 마이그레이션 파일은 fs로 읽어 래퍼 목록과 맞는지 본다(DB 없이 돈다).
 *
 * 근거: WU-03 6번 · docs/03-data-model.md 4절 · AGENTS.md 4절
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 재고 함수 래퍼 시험 (WU-03)
 * 2026-11-23  eple  시드 SQL 파일을 비교 대상에 넣고 NO_SQL_YET을 비움 (WU-08)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorResult, HTTP_STATUS, PfError } from '@/lib/api/errors';
import {
  bulkApply,
  cancelReceipt,
  cancelShipment,
  createItem,
  createPurchase,
  createSale,
  llmTake,
  receivePurchase,
  resetAndSeed,
  RPC_PARAMS,
  type Rpc,
  setPurchaseStatus,
  setSaleStatus,
  shipSale,
} from './inventory';

/** 가짜 rpc: 호출을 기록하고 주어진 data를 돌려준다. */
function fakeRpc(data: unknown = { ok: true }, error: { message?: unknown; details?: unknown; code?: unknown } | null = null) {
  const calls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = [];
  const rpc: Rpc = {
    rpc: (fn, args) => {
      calls.push({ fn, args });
      return Promise.resolve({ data: error ? null : data, error });
    },
  };
  return { rpc, calls };
}

/** 프로미스가 던진 오류를 돌려준다(던지지 않았으면 undefined). */
async function thrownBy(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e;
  }
}

const MIGRATIONS = [
  'supabase/migrations/20261120100200_inventory.sql',
  'supabase/migrations/20261120100300_bulk.sql',
  'supabase/migrations/20261120100100_core_functions.sql',
  'supabase/migrations/20261123100000_seed.sql',
];
/** 래퍼를 만들지 않는 내부 함수(T-INV-1에서 뺀다). */
const NO_WRAPPER = ['pf_require_user', 'pf_purchase_transition_ok', 'pf_sale_transition_ok'];
/** 래퍼는 있으나 SQL은 아직 없는 함수. 시드 SQL(20261123100000_seed.sql)이 생겨 지금은 비어 있다. */
const NO_SQL_YET: string[] = [];

/** 마이그레이션 파일들에서 함수 이름 → 인자 이름(순서대로) 목록을 뽑는다. */
function readMigrationFunctions(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const re = /create or replace function public\.(pf_\w+)\(([^)]*)\)/g;
  for (const rel of MIGRATIONS) {
    const sql = readFileSync(resolve(process.cwd(), rel), 'utf8');
    for (const m of sql.matchAll(re)) {
      const name = m[1] ?? '';
      const names = (m[2] ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .map((part) => part.split(/\s+/)[0] ?? '');
      found.set(name, names);
    }
  }
  return found;
}

describe('T-INV: 재고 함수 래퍼', () => {
  afterEach(() => vi.restoreAllMocks());

  it('T-INV-1 마이그레이션의 함수 이름 · 인자 이름이 RPC_PARAMS와 같다', () => {
    // 기대: 래퍼 없는 3개를 뺀 함수 이름 목록이 RPC_PARAMS(아직 SQL 없는 것 제외)와 같고, 인자 이름 배열도 순서까지 같다
    const found = readMigrationFunctions();
    const sqlNames = [...found.keys()].filter((name) => !NO_WRAPPER.includes(name)).sort();
    const wrapperNames = Object.keys(RPC_PARAMS)
      .filter((name) => !NO_SQL_YET.includes(name))
      .sort();
    expect(sqlNames).toEqual(wrapperNames);
    for (const name of wrapperNames) {
      expect(RPC_PARAMS[name], name).toEqual(found.get(name));
    }
  });

  // 기대: 각 래퍼는 함수 이름 하나로 한 번 부르고, 인자 객체 키는 RPC_PARAMS와 같으며, data를 그대로 돌려준다
  const cases: Array<[string, (rpc: Rpc) => Promise<unknown>]> = [
    ['pf_create_item', (r) => createItem(r, { sku_id: 'PRD-001', item_name: '박스', unit_cost: 1000, sale_price: 2000, safety_stock: 3, source_url: null })],
    ['pf_create_purchase', (r) => createPurchase(r, { sku_id: 'PRD-001', supplier: '공급사', order_qty: 10, purchase_cost: 900, invoice_no: null })],
    ['pf_set_purchase_status', (r) => setPurchaseStatus(r, { id: 'a1', to_status: '품절' })],
    ['pf_receive_purchase', (r) => receivePurchase(r, { id: 'a1', received_qty: 10 })],
    ['pf_cancel_receipt', (r) => cancelReceipt(r, { id: 'a1' })],
    ['pf_create_sale', (r) => createSale(r, { sku_id: 'PRD-001', channel: '쇼핑몰', sold_qty: 2, sale_amount: 4000, invoice_no: null })],
    ['pf_set_sale_status', (r) => setSaleStatus(r, { id: 'b1', to_status: '주문취소' })],
    ['pf_ship_sale', (r) => shipSale(r, { id: 'b1' })],
    ['pf_cancel_shipment', (r) => cancelShipment(r, { id: 'b1' })],
    ['pf_bulk_apply', (r) => bulkApply(r, { rows: [] })],
    ['pf_llm_take', (r) => llmTake(r, { user_limit: 20, global_limit: 200 })],
    ['pf_reset_and_seed', (r) => resetAndSeed(r, { data: { dataset: 'demo' } })],
  ];

  it.each(cases)('T-INV-2 %s 래퍼는 맞는 함수를 맞는 인자 이름으로 부르고 data를 그대로 돌려준다', async (fn, run) => {
    const data = { marker: fn };
    const { rpc, calls } = fakeRpc(data);
    const result = await run(rpc);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.fn).toBe(fn);
    expect(Object.keys(calls[0]?.args ?? {})).toEqual(RPC_PARAMS[fn]);
    expect(result).toBe(data);
  });

  it('T-INV-3 source를 생략하면 p_source가 form, 주면 그 값', async () => {
    const base = { sku_id: 'PRD-001', invoice_no: null };

    const a = fakeRpc();
    await createPurchase(a.rpc, { ...base, supplier: '공급사', order_qty: 1, purchase_cost: 1 });
    expect(a.calls[0]?.args?.p_source).toBe('form');

    const b = fakeRpc();
    await createPurchase(b.rpc, { ...base, supplier: '공급사', order_qty: 1, purchase_cost: 1, source: 'bulk' });
    expect(b.calls[0]?.args?.p_source).toBe('bulk');

    const c = fakeRpc();
    await createSale(c.rpc, { ...base, channel: '쇼핑몰', sold_qty: 1, sale_amount: 1 });
    expect(c.calls[0]?.args?.p_source).toBe('form');

    const d = fakeRpc();
    await createSale(d.rpc, { ...base, channel: '쇼핑몰', sold_qty: 1, sale_amount: 1, source: 'agent' });
    expect(d.calls[0]?.args?.p_source).toBe('agent');
  });

  it('T-INV-4 PF_NOT_IMPLEMENTED 오류는 PfError로 던져지고 HTTP 501이다', async () => {
    // 기대: code === 'PF_NOT_IMPLEMENTED', detail 없음, errorResult 상태 501
    const { rpc } = fakeRpc(null, { message: 'PF_NOT_IMPLEMENTED', details: null });
    const err = await thrownBy(shipSale(rpc, { id: 'b1' }));
    expect(err).toBeInstanceOf(PfError);
    const pf = err as PfError;
    expect(pf.code).toBe('PF_NOT_IMPLEMENTED');
    expect(pf.detail).toBeNull();
    expect(HTTP_STATUS[pf.code]).toBe(501);
    expect(errorResult(pf.code, pf.detail).status).toBe(501);
  });

  it('T-INV-5 PF_INSUFFICIENT_STOCK는 detail(JSON 문자열)을 객체로 옮긴다', async () => {
    // 기대: detail === { sku_id, stock_qty: 4, requested: 9 }, code === 'PF_INSUFFICIENT_STOCK'
    const detailText = '{"sku_id":"PRD-001","stock_qty":4,"requested":9}';
    const { rpc } = fakeRpc(null, { message: 'PF_INSUFFICIENT_STOCK', details: detailText });
    const err = (await thrownBy(shipSale(rpc, { id: 'b1' }))) as PfError;
    expect(err).toBeInstanceOf(PfError);
    expect(err.code).toBe('PF_INSUFFICIENT_STOCK');
    expect(err.detail).toEqual({ sku_id: 'PRD-001', stock_qty: 4, requested: 9 });
  });

  it('T-INV-6 모르는 DB 오류는 PF_INTERNAL이고 원문이 응답 오류에 없다', async () => {
    // 기대: code === 'PF_INTERNAL', detail null, 원문 문장은 오류 객체 어디에도 없음(서버 로그에만 남음)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = 'duplicate key value violates unique constraint "items_sku_key" for PRD-777';
    const { rpc } = fakeRpc(null, { message: raw, details: 'Key (sku_id)=(PRD-777) already exists', code: '23505' });
    const err = (await thrownBy(createItem(rpc, { sku_id: 'PRD-777', item_name: 'x', unit_cost: 1, sale_price: 1, safety_stock: 0, source_url: null }))) as PfError;
    expect(err).toBeInstanceOf(PfError);
    expect(err.code).toBe('PF_INTERNAL');
    expect(err.detail).toBeNull();
    expect(err.message).not.toContain('duplicate');
    expect(JSON.stringify(err)).not.toContain('PRD-777');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
