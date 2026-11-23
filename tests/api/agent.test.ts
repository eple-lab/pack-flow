/**
 * T-AI-1 발주서 초안 → [확인] 시에만 `발주완료` 저장 — 실제 dev DB · 사용자 JWT로 route를 Request로 직접 부른다.
 *
 * 하는 일
 * 1. 계정 A로 로그인하고 createServerSupabase를 그 클라이언트로 바꿔(vi.mock) /api/agent/draft-po · /confirm route를 부른다.
 *    CSRF(X-PF) · 로그인 · 스키마 검사 · 응답 코드(201)까지 createHandler를 그대로 지난다. 쿠키 처리만 빠진다.
 * 2. LLM은 fake 제공자(LLM_PROVIDER=fake)로 고정한다 — 외부 호출 없음. 문안 내용은 저장에 쓰이지 않는다.
 * 3. 끝에 demo 시드로 되돌린다(계정 A 데이터만). 계정 B는 읽기·거부 확인에만 쓴다.
 *
 * 기대(먼저 적음) — demo 시드의 품절 임박 품목(재고 < 안전재고, PRD-003 포함):
 * - 초안: 200, lines에 PRD-003, 모든 줄의 재고 · 안전재고 · 단가는 DB 값. 초안만 만들면 purchases 건수 그대로([취소]에 해당)
 * - [확인]: 201, purchases에 `발주완료` 1건(source agent · 수량 · 금액은 보낸 값), 건수 +1, 재고 그대로, 불변식 통과
 * - 실패해야 함: X-PF 없음 → 403 · 수량 0 → 400 · 없는 품목 포함 → 404 PF_NOT_FOUND이고 다른 줄도 저장 안 됨
 *               · 계정 B가 A의 품목으로 확정 → 404 PF_NOT_FOUND, A · B 건수 그대로
 *
 * 근거: docs/07-test-strategy.md T-AI-1, docs/04-api-contract.md 3.8, WU-33 다 됐다의 기준
 * 구역: skygaul (docs/06-work-plan.md 1절 — tests/api는 eple 'API 테스트' 구역이나 T-AI-1 시험은 skygaul 담당)
 *
 * 이력
 * 2026-11-23  skygaul  처음 작성 — T-AI-1 실제 DB 시험을 정식 파일로 (WU-33)
 * 2026-11-23  skygaul  demo 시드가 8개 품목이 돼 초안 후보가 늘어남 — 후보에 PRD-003 포함 · 모든 줄이 DB 값과 같은지로 검사 (WU-22 반영)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PoDraft } from '@/types/agent';
import { assertInvariants, makeItem, resetAndSeed, signIn } from '../db/helpers';

vi.hoisted(() => {
  process.env.LLM_PROVIDER = 'fake';
});
vi.mock('server-only', () => ({}));
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => holder.client as SupabaseClient }));

import { POST as postConfirm } from '@/app/api/agent/draft-po/confirm/route';
import { POST as postDraft } from '@/app/api/agent/draft-po/route';

const ORIGIN = 'https://app.packflow.test';

type Json = { data?: unknown; error?: { code: string } };

async function call(handler: (request: Request) => Promise<Response>, path: string, body: unknown, headers: Record<string, string> = { 'x-pf': '1' }) {
  const response = await handler(
    new Request(`${ORIGIN}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as Json };
}

const draft = (body: unknown = {}) => call(postDraft, '/api/agent/draft-po', body);
const confirm = (lines: unknown[], headers?: Record<string, string>) => call(postConfirm, '/api/agent/draft-po/confirm', { lines }, headers);

async function purchaseCount(db: SupabaseClient): Promise<number> {
  const { count, error } = await db.from('purchases').select('*', { count: 'exact', head: true });
  expect(error).toBeNull();
  return count ?? 0;
}

let a: SupabaseClient;
let b: SupabaseClient;

beforeAll(async () => {
  a = await signIn('A');
  b = await signIn('B');
  holder.client = a;
  await resetAndSeed(a, 'demo');
});

afterAll(async () => {
  holder.client = a;
  await resetAndSeed(a, 'demo');
});

describe('T-AI-1 발주서 초안 → 확인 시에만 저장 (실제 DB)', () => {
  it('T-AI-1a 초안은 PRD-003 표(DB 값)를 주고, 만들기만 하면 purchases가 늘지 않는다', async () => {
    holder.client = a;
    const before = await purchaseCount(a);
    const res = await draft();
    expect(res.status).toBe(200);
    const d = res.body.data as PoDraft;
    // demo 시드가 품목 8개로 늘어(WU-22) 후보가 PRD-003 하나가 아닐 수 있다. 안전재고 미만 PRD-003은 반드시 들어 있어야 하고,
    // 모든 줄의 표 값은 DB 값과 같아야 한다.
    expect(d.lines.map((l) => l.sku_id)).toContain('PRD-003');

    const { data: items, error } = await a.from('items').select('sku_id,item_name,unit_cost,stock_qty,safety_stock');
    expect(error).toBeNull();
    const bySku = new Map((items ?? []).map((row) => [row.sku_id as string, row]));
    for (const line of d.lines) {
      const item = bySku.get(line.sku_id)!;
      expect(line).toMatchObject({
        item_name: item.item_name,
        unit_cost: item.unit_cost,
        stock_qty: item.stock_qty,
        safety_stock: item.safety_stock,
      });
      expect(line.stock_qty).toBeLessThan(line.safety_stock);
      expect(line.recommended_qty).toBeGreaterThanOrEqual(1);
    }
    expect(await purchaseCount(a)).toBe(before);
  });

  it('T-AI-1b [확인] → 201, purchases에 발주완료 1건(source agent), 재고 그대로, 불변식 통과', async () => {
    holder.client = a;
    const before = await purchaseCount(a);
    const stockBefore = (await a.from('items').select('stock_qty').eq('sku_id', 'PRD-003').single()).data!.stock_qty;
    const res = await confirm([{ sku_id: 'PRD-003', supplier: '시험상사', order_qty: 6, purchase_cost: 72000 }]);
    expect(res.status).toBe(201);
    const purchases = (res.body.data as { purchases: { purchase_id: string }[] }).purchases;
    expect(purchases).toHaveLength(1);

    const { data: row, error } = await a.from('purchases').select('status,source,order_qty,purchase_cost,supplier').eq('purchase_id', purchases[0]!.purchase_id).single();
    expect(error).toBeNull();
    expect(row).toMatchObject({ status: '발주완료', source: 'agent', order_qty: 6, purchase_cost: 72000, supplier: '시험상사' });
    expect(await purchaseCount(a)).toBe(before + 1);
    expect((await a.from('items').select('stock_qty').eq('sku_id', 'PRD-003').single()).data!.stock_qty).toBe(stockBefore);
    await assertInvariants(a);
  });

  it('T-AI-1c (실패해야 함) X-PF 없음 → 403, 수량 0 → 400, 저장 없음', async () => {
    holder.client = a;
    const before = await purchaseCount(a);
    const line = { sku_id: 'PRD-003', supplier: '시험상사', order_qty: 6, purchase_cost: 72000 };
    expect((await confirm([line], {})).status).toBe(403);
    const zero = await confirm([{ ...line, order_qty: 0 }]);
    expect(zero.status).toBe(400);
    expect(zero.body.error?.code).toBe('PF_VALIDATION');
    expect(await purchaseCount(a)).toBe(before);
  });

  it('T-AI-1d (실패해야 함) 없는 품목이 한 줄이라도 있으면 404이고 다른 줄도 저장 안 됨', async () => {
    holder.client = a;
    const before = await purchaseCount(a);
    const res = await confirm([
      { sku_id: 'PRD-003', supplier: '시험상사', order_qty: 1, purchase_cost: 12000 },
      { sku_id: 'ZZZ-999', supplier: '시험상사', order_qty: 1, purchase_cost: 1000 },
    ]);
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('PF_NOT_FOUND');
    expect(await purchaseCount(a)).toBe(before);
  });

  it('T-AI-1e (실패해야 함) 계정 B가 A만의 품목으로 확정 → 404, A · B 구매 건수 그대로, B의 초안에 A 품목 없음', async () => {
    holder.client = a;
    const mine = await makeItem(a, { item_name: 'A 전용 품목' });
    const beforeA = await purchaseCount(a);
    const beforeB = await purchaseCount(b);

    holder.client = b;
    const res = await confirm([{ sku_id: mine.sku_id, supplier: '시험상사', order_qty: 1, purchase_cost: 1000 }]);
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('PF_NOT_FOUND');
    const bDraft = (await draft({ sku_ids: [mine.sku_id] })).body.data as PoDraft;
    expect(bDraft.lines.map((l) => l.sku_id)).not.toContain(mine.sku_id);

    expect(await purchaseCount(a)).toBe(beforeA);
    expect(await purchaseCount(b)).toBe(beforeB);
  });
});
