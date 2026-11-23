/**
 * draft-po.ts 단위 테스트 — 발주서 초안 만들기(조회 → 계산 → LLM)와 확정(재검증 → 줄마다 구매 등록).
 *
 * 하는 일
 * 1. 기대 결과(표의 값 · 문안 · LLM 오류 · 저장 호출)를 먼저 적고 비교한다(D-34).
 * 2. 실제 DB · LLM은 부르지 않는다. 가짜 Supabase와 가짜 LLM을 끼워 넣는다.
 * 3. 일부러 실패해야 하는 경우(후보 없음 · LLM 실패 · 상한 초과 · 남의 품목 · 중간 실패)를 넣는다.
 * 4. 초안 조회가 읽기만 하는지(쓰기 · rpc 호출 없음), 7일 · 실판매출고만 가져오는지 확인한다.
 *
 * 근거: docs/work-units/WU-33-draft-po.md · docs/04-api-contract.md 3.8 · docs/02-decisions.md P-08 · 설계 원칙 4
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  skygaul  처음 작성 — 초안 만들기 · 확정 시험 (WU-33)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { messageFor, PfError } from '@/lib/api/errors';
import type { LlmRequest, LlmResponse } from '@/lib/llm';
import { confirmPoLines, createPoDraft } from './draft-po';

// draft-po.ts가 가져오는 llm.ts는 server-only · Supabase 서버 클라이언트를 쓴다 — 일반 Node에서는 비워 둔다
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: () => Promise.reject(new Error('시험에서 부르지 않는다')) }));

const NOW = new Date('2026-11-23T12:00:00Z');

/** demo 시드(src/lib/seed/demo.json)와 같은 값: PRD-003만 안전재고 미만, PRD-001은 입고 예정 10개 */
const ITEMS = [
  { sku_id: 'PRD-001', item_name: '무선 마우스', unit_cost: 8000, stock_qty: 10, safety_stock: 5 },
  { sku_id: 'PRD-002', item_name: 'USB-C 케이블', unit_cost: 2000, stock_qty: 40, safety_stock: 15 },
  { sku_id: 'PRD-003', item_name: '노트북 거치대', unit_cost: 12000, stock_qty: 3, safety_stock: 4 },
];
const PURCHASES = [
  { sku_id: 'PRD-001', supplier: '가나물산', order_qty: 10, status: '이동·통관중', created_at: '2026-11-20T00:00:00Z' },
];

type Calls = Array<{ table: string; ops: Array<[string, ...unknown[]]> }>;

/**
 * 가짜 Supabase. 테이블마다 정해 둔 행을 돌려주고, 부른 체인(select · eq · gte …)을 기록한다.
 * rpc는 rpcResults를 순서대로 돌려준다(없으면 오류). 필터는 일부러 하지 않는다 — 코드가 따로 걸러야 하는 것만 시험한다.
 */
function fakeSupabase(
  tables: Record<string, unknown[]>,
  options: { rpc?: Array<{ data?: unknown; error?: { message: string; details?: string } }>; tableError?: { message: string } } = {},
) {
  const calls: Calls = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      const ops: Array<[string, ...unknown[]]> = [];
      calls.push({ table, ops });
      const query = {
        select: (...a: unknown[]) => (ops.push(['select', ...a]), query),
        in: (...a: unknown[]) => (ops.push(['in', ...a]), query),
        eq: (...a: unknown[]) => (ops.push(['eq', ...a]), query),
        gte: (...a: unknown[]) => (ops.push(['gte', ...a]), query),
        order: (...a: unknown[]) => (ops.push(['order', ...a]), query),
        limit: (...a: unknown[]) => (ops.push(['limit', ...a]), query),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve(
            options.tableError ? { data: null, error: options.tableError } : { data: tables[table] ?? [], error: null },
          ).then(resolve),
      };
      return query;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      const next = options.rpc?.shift();
      if (!next) return { data: null, error: { message: 'PF_INTERNAL' } };
      return { data: next.data ?? null, error: next.error ?? null };
    },
  } as unknown as SupabaseClient;
  return { client, calls, rpcCalls };
}

const llmReply = (text: string, provider: LlmResponse['provider'] = 'ollama') =>
  vi.fn(async (request: LlmRequest) => {
    void request; // 부른 인자는 mock.calls로 확인한다
    return { text, provider, latencyMs: 5 } satisfies LlmResponse;
  });

const failing = (error: unknown) =>
  vi.fn(async () => {
    throw error;
  });

describe('D: 발주서 초안 (createPoDraft)', () => {
  it('D-1 PRD-003만 후보 → 표 값은 DB 값 · 추천 수량은 reorder 결과, 문안은 LLM, llm_error 없음', async () => {
    const { client } = fakeSupabase({ items: ITEMS, stock_logs: [], purchases: PURCHASES });
    const generateText = llmReply('안녕하세요. 노트북 거치대 발주를 요청드립니다.');
    const draft = await createPoDraft(client, { now: NOW, generateText, provider: 'ollama' });

    expect(draft.lines).toEqual([
      {
        sku_id: 'PRD-003',
        item_name: '노트북 거치대',
        stock_qty: 3,
        safety_stock: 4,
        recommended_qty: 1, // 출고 이력 0 + 안전 4 − 재고 3 − 입고 예정 0
        unit_cost: 12000,
        supplier: '미지정',
        basis: '최근 7일 출고 0개(하루 0개), 입고 예정 0개, 안전재고 4개 기준',
      },
    ]);
    expect(draft.message).toBe('안녕하세요. 노트북 거치대 발주를 요청드립니다.');
    expect(draft.llm_error).toBeNull();
    expect(draft.provider).toBe('ollama');
    expect(generateText).toHaveBeenCalledTimes(1);
    const request = generateText.mock.calls[0]![0];
    expect(request.user).toContain('PRD-003');
    expect(request.user).toContain('추천 수량 1');
    expect(request.user).toContain('2026-11-30'); // 요청 납기 = 오늘(11/23 KST) + 7일
    expect(request.system).toContain('바꾸지');
  });

  it('D-2 (실패해야 함) 발주할 품목이 없으면 lines가 비고 LLM을 부르지 않는다(상한도 안 쓴다)', async () => {
    const enough = ITEMS.map((i) => ({ ...i, stock_qty: 100 }));
    const { client } = fakeSupabase({ items: enough, stock_logs: [], purchases: [] });
    const generateText = llmReply('쓰이면 안 된다');
    const draft = await createPoDraft(client, { now: NOW, generateText, provider: 'ollama' });
    expect(draft).toEqual({ lines: [], message: null, llm_error: null, provider: 'ollama' });
    expect(generateText).not.toHaveBeenCalled();
  });

  it('D-3 T-AI-6 LLM이 안 되면 표는 그대로 · message null · llm_error 채움(200으로 돌려줄 값)', async () => {
    const { client } = fakeSupabase({ items: ITEMS, stock_logs: [], purchases: PURCHASES });
    const ok = await createPoDraft(client, { now: NOW, generateText: llmReply('문안'), provider: 'ollama' });
    const draft = await createPoDraft(client, {
      now: NOW,
      generateText: failing(new PfError('PF_LLM_UNAVAILABLE')),
      provider: 'ollama',
    });
    expect(draft.lines).toEqual(ok.lines);
    expect(draft.message).toBeNull();
    expect(draft.llm_error).toEqual({ code: 'PF_LLM_UNAVAILABLE', message: messageFor('PF_LLM_UNAVAILABLE') });
  });

  it('D-4 T-AI-7 호출 상한 초과도 표는 그대로, llm_error는 PF_QUOTA_EXCEEDED(한도 안내 문구)', async () => {
    const { client } = fakeSupabase({ items: ITEMS, stock_logs: [], purchases: [] });
    const draft = await createPoDraft(client, {
      now: NOW,
      generateText: failing(new PfError('PF_QUOTA_EXCEEDED', { scope: 'user' })),
      provider: 'gemini',
    });
    expect(draft.lines).toHaveLength(1);
    expect(draft.message).toBeNull();
    expect(draft.llm_error?.code).toBe('PF_QUOTA_EXCEEDED');
    expect(draft.llm_error?.message).toContain('한도');
    expect(draft.provider).toBe('gemini');
  });

  it('D-5 sku_ids를 주면 그 품목만 본다 (후보가 아닌 품목 · 없는 품목은 빈 표 · LLM 안 부름)', async () => {
    const { client } = fakeSupabase({ items: ITEMS, stock_logs: [], purchases: PURCHASES });
    const only3 = await createPoDraft(client, { now: NOW, skuIds: ['PRD-003'], generateText: llmReply('문안'), provider: 'ollama' });
    expect(only3.lines.map((l) => l.sku_id)).toEqual(['PRD-003']);

    const generateText = llmReply('쓰이면 안 된다');
    const notCandidate = await createPoDraft(client, { now: NOW, skuIds: ['PRD-001'], generateText, provider: 'ollama' });
    const unknown = await createPoDraft(client, { now: NOW, skuIds: ['PRD-999'], generateText, provider: 'ollama' });
    expect(notCandidate.lines).toEqual([]);
    expect(unknown.lines).toEqual([]);
    expect(generateText).not.toHaveBeenCalled();
  });

  it('D-6 LLM 문안의 숫자가 표와 달라도 표(저장될 값)는 그대로다', async () => {
    const { client } = fakeSupabase({ items: ITEMS, stock_logs: [], purchases: [] });
    const draft = await createPoDraft(client, {
      now: NOW,
      generateText: llmReply('노트북 거치대 999개를 단가 1원에 주문합니다'),
      provider: 'ollama',
    });
    expect(draft.message).toContain('999개');
    expect(draft.lines[0]).toMatchObject({ recommended_qty: 1, unit_cost: 12000 });
  });

  it('D-7 로그인 안 됨 같은 다른 오류는 삼키지 않고 그대로 던진다', async () => {
    const { client } = fakeSupabase({ items: ITEMS, stock_logs: [], purchases: [] });
    await expect(
      createPoDraft(client, { now: NOW, generateText: failing(new PfError('PF_UNAUTHENTICATED')), provider: 'ollama' }),
    ).rejects.toMatchObject({ code: 'PF_UNAUTHENTICATED' });
    await expect(
      createPoDraft(client, { now: NOW, generateText: failing(new Error('예상 못 한 오류')), provider: 'ollama' }),
    ).rejects.toThrow('예상 못 한 오류');
  });

  it('D-8 읽기만 한다: items · stock_logs · purchases 조회뿐(쓰기 · rpc 없음), 이력은 7일 · 실판매출고만', async () => {
    const { client, calls, rpcCalls } = fakeSupabase({ items: ITEMS, stock_logs: [], purchases: [] });
    await createPoDraft(client, { now: NOW, generateText: llmReply('문안'), provider: 'ollama' });
    expect(calls.map((c) => c.table).sort()).toEqual(['items', 'purchases', 'stock_logs']);
    expect(rpcCalls).toEqual([]);
    const logs = calls.find((c) => c.table === 'stock_logs')?.ops ?? [];
    expect(logs).toContainEqual(['eq', 'reason', '실판매출고']);
    expect(logs).toContainEqual(['gte', 'created_at', '2026-11-16T12:00:00.000Z']);
  });

  it('D-9 DB 조회가 실패하면 PF_INTERNAL(원문은 응답에 없다)', async () => {
    const { client } = fakeSupabase({}, { tableError: { message: 'relation "items" does not exist' } });
    await expect(createPoDraft(client, { now: NOW, generateText: llmReply('문안'), provider: 'ollama' })).rejects.toMatchObject({
      code: 'PF_INTERNAL',
    });
  });

  it('D-10 provider는 계약(04 3.8)의 gemini · ollama만 — fake는 ollama로 적는다(시험 전용)', async () => {
    const { client } = fakeSupabase({ items: ITEMS, stock_logs: [], purchases: [] });
    const fromFake = await createPoDraft(client, { now: NOW, generateText: llmReply('문안', 'fake'), provider: 'ollama' });
    const fromGemini = await createPoDraft(client, { now: NOW, generateText: llmReply('문안', 'gemini'), provider: 'ollama' });
    expect(fromFake.provider).toBe('ollama');
    expect(fromGemini.provider).toBe('gemini');
  });
});

const LINES = [
  { sku_id: 'PRD-003', supplier: '가나물산', order_qty: 6, purchase_cost: 72000 },
  { sku_id: 'PRD-002', supplier: '다라무역', order_qty: 20, purchase_cost: 40000 },
];
const purchaseRow = (n: number, line: (typeof LINES)[number]) => ({
  id: `uuid-${n}`,
  purchase_id: `P-${100 + n}`,
  ...line,
  status: '발주완료',
  source: 'agent',
});

describe('C: 발주서 확정 (confirmPoLines)', () => {
  it('C-1 줄마다 pf_create_purchase를 source "agent" · 송장 null로 부르고, 만들어진 구매를 순서대로 돌려준다', async () => {
    const { client, rpcCalls } = fakeSupabase(
      { items: ITEMS },
      { rpc: [{ data: purchaseRow(5, LINES[0]!) }, { data: purchaseRow(6, LINES[1]!) }] },
    );
    const result = await confirmPoLines(client, LINES);
    expect(rpcCalls).toEqual([
      {
        fn: 'pf_create_purchase',
        args: { p_sku_id: 'PRD-003', p_supplier: '가나물산', p_order_qty: 6, p_purchase_cost: 72000, p_invoice_no: null, p_source: 'agent' },
      },
      {
        fn: 'pf_create_purchase',
        args: { p_sku_id: 'PRD-002', p_supplier: '다라무역', p_order_qty: 20, p_purchase_cost: 40000, p_invoice_no: null, p_source: 'agent' },
      },
    ]);
    expect(result.purchases.map((p) => p.purchase_id)).toEqual(['P-105', 'P-106']);
  });

  it('C-2 (실패해야 함) 남의 품목이 한 줄이라도 있으면 PF_NOT_FOUND, 다른 줄도 저장하지 않는다', async () => {
    // B 계정: items 조회(RLS)에는 PRD-003만 보인다. PRD-001은 A의 것
    const { client, rpcCalls } = fakeSupabase({ items: [ITEMS[2]] });
    await expect(
      confirmPoLines(client, [LINES[0]!, { sku_id: 'PRD-001', supplier: '가나물산', order_qty: 5, purchase_cost: 40000 }]),
    ).rejects.toMatchObject({ code: 'PF_NOT_FOUND' });
    expect(rpcCalls).toEqual([]);
  });

  it('C-3 중간 줄이 DB에서 거부되면 그 오류를 던진다(앞 줄은 이미 저장됨 — 호출 수로 확인)', async () => {
    const { client, rpcCalls } = fakeSupabase(
      { items: ITEMS },
      { rpc: [{ data: purchaseRow(5, LINES[0]!) }, { error: { message: 'PF_NOT_FOUND' } }] },
    );
    await expect(confirmPoLines(client, LINES)).rejects.toMatchObject({ code: 'PF_NOT_FOUND' });
    expect(rpcCalls).toHaveLength(2);
  });

  it('C-5 (실패해야 함) 수량 0 · 금액 음수는 DB에 가기 전에 PF_VALIDATION, 아무것도 저장하지 않는다', async () => {
    const { client, rpcCalls } = fakeSupabase({ items: ITEMS });
    await expect(confirmPoLines(client, [{ ...LINES[0]!, order_qty: 0 }])).rejects.toMatchObject({
      code: 'PF_VALIDATION',
      detail: { field: 'order_qty', reason: 'out_of_range', min: 1, max: 100000 },
    });
    await expect(confirmPoLines(client, [{ ...LINES[0]!, purchase_cost: -1 }])).rejects.toMatchObject({
      code: 'PF_VALIDATION',
      detail: { field: 'purchase_cost' },
    });
    await expect(confirmPoLines(client, [{ ...LINES[0]!, order_qty: 1.5 }])).rejects.toMatchObject({ code: 'PF_VALIDATION' });
    expect(rpcCalls).toEqual([]);
  });

  it('C-4 같은 품목 두 줄도 그대로 두 건으로 등록하고, 품목 조회는 중복 없이 한 번이다', async () => {
    const twice = [LINES[0]!, { ...LINES[0]!, order_qty: 2, purchase_cost: 24000 }];
    const { client, rpcCalls, calls } = fakeSupabase(
      { items: [ITEMS[2]] },
      { rpc: [{ data: purchaseRow(5, twice[0]!) }, { data: purchaseRow(6, twice[1]!) }] },
    );
    const result = await confirmPoLines(client, twice);
    expect(result.purchases).toHaveLength(2);
    expect(rpcCalls).toHaveLength(2);
    const itemsOps = calls.find((c) => c.table === 'items')?.ops ?? [];
    expect(itemsOps).toContainEqual(['in', 'sku_id', ['PRD-003']]);
  });
});
