/**
 * T-AI-2~5 챗봇(chat · execute) — 실제 dev DB · 사용자 JWT로 route를 Request로 직접 부른다.
 *
 * 하는 일
 * 1. 계정 A · B로 로그인하고 createServerSupabase를 그 클라이언트로 바꿔(vi.mock) /api/agent/chat · /execute route를 부른다.
 *    CSRF(X-PF) · 로그인 · 스키마 검사 · 응답 코드까지 createHandler를 그대로 지난다. 쿠키 처리만 빠진다.
 * 2. LLM은 가짜다: `@/lib/llm`의 generate를 정해 둔 JSON으로 바꾼다(외부 호출 · 하루 호출 상한 소모 없음).
 *    검증하려는 것은 LLM이 아니라 서버의 검사 로직이다(07 3절).
 * 3. 끝에 demo 시드로 되돌린다(계정 A 데이터만). 계정 B는 읽기 · 거부 확인에만 쓴다.
 *
 * 기대(먼저 적음) — demo 시드(계정 A):
 * - T-AI-3: "PRD-001 재고?" → 200, facts의 값 = DB 값. LLM이 다른 숫자(999)를 말해도 답에 없다
 * - T-AI-2: 재고 n인 품목에 n + 47개 출고 → refused "재고가 부족해요 … 남은 수량 n개", 재고 · 판매 건수 그대로
 * - T-AI-4: delete_all · 재고 0 만들기 같은 허용 밖 → refused, DB 그대로. /execute에 허용 밖 type → 400
 * - [실행] 전에는 DB가 바뀌지 않음: 출고 제안(chat) 뒤 판매 · 이력 건수 그대로
 * - [실행]: ship_quantity → 200, 재고 −qty, 판매 1건(직접출고 · agent · 출고완료), 이력 +1, 불변식 통과
 * - 실패해야 함: 재고 초과 execute → 409 PF_INSUFFICIENT_STOCK(판매 안 만들어짐) · 공백만 메시지 → 400 · X-PF 없음 → 403
 * - T-AI-5: B의 챗봇은 A만의 품목을 답하지 않음, B가 A의 판매 uuid로 execute → 404
 *
 * 근거: docs/07-test-strategy.md T-AI-2~5, docs/04-api-contract.md 3.8, WU-34 다 됐다의 기준
 * 구역: skygaul (docs/06-work-plan.md 1절 — tests/api는 eple 'API 테스트' 구역이나 챗봇 시험은 skygaul 담당)
 *
 * 이력
 * 2026-11-23  skygaul  처음 작성 — T-AI-2~5 챗봇 실제 DB 시험 (WU-34)
 * 2026-11-23  skygaul  시험 이름 앞에 ID(C-01~05)를 붙임 — 시험 이름은 ID로 시작하는 규칙 (WU-34)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ChatReply } from '@/types/agent';
import { assertInvariants, makeItem, resetAndSeed, signIn } from '../db/helpers';

vi.mock('server-only', () => ({}));
const holder = vi.hoisted(() => ({ client: null as unknown, llmText: '{}', llmCalls: 0 }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => holder.client as SupabaseClient }));
// 가짜 LLM: 호출 상한(pf_llm_take)을 쓰지 않고 정해 둔 글자만 돌려준다
vi.mock('@/lib/llm', () => ({
  generate: async () => {
    holder.llmCalls += 1;
    return { text: holder.llmText, provider: 'fake', latencyMs: 1 };
  },
}));

import { POST as postChat } from '@/app/api/agent/chat/route';
import { POST as postExecute } from '@/app/api/agent/execute/route';

const ORIGIN = 'https://app.packflow.test';

type Json = { data?: unknown; error?: { code: string; message?: string } };

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

/** LLM이 이 JSON을 낸 것으로 하고 챗봇에게 묻는다. */
async function chat(message: string, llm: unknown) {
  holder.llmText = typeof llm === 'string' ? llm : JSON.stringify(llm);
  const res = await call(postChat, '/api/agent/chat', { message });
  return { ...res, reply: res.body.data as ChatReply };
}
const execute = (action: unknown, headers?: Record<string, string>) => call(postExecute, '/api/agent/execute', { action }, headers);

async function count(db: SupabaseClient, table: 'sales' | 'stock_logs' | 'purchases'): Promise<number> {
  const { count: n, error } = await db.from(table).select('*', { count: 'exact', head: true });
  expect(error).toBeNull();
  return n ?? 0;
}

async function stockOf(db: SupabaseClient, sku: string): Promise<number> {
  const { data, error } = await db.from('items').select('stock_qty').eq('sku_id', sku).single();
  expect(error).toBeNull();
  return data!.stock_qty as number;
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

describe('T-AI-2~5 챗봇 (실제 DB, 가짜 LLM)', () => {
  it('T-AI-3 재고 답의 수치 = DB 값(facts). LLM이 다른 숫자를 말해도 답에 없다', async () => {
    holder.client = a;
    const stock = await stockOf(a, 'PRD-001');
    const res = await chat('PRD-001 재고 몇 개야?', { type: 'get_stock', sku_id: 'PRD-001', answer: '재고는 999개입니다' });
    expect(res.status).toBe(200);
    expect(res.reply.facts['PRD-001.stock_qty']).toBe(stock);
    expect(res.reply.reply).toContain(`${stock}개`);
    expect(res.reply.reply).not.toContain('999');
    expect(res.reply).toMatchObject({ proposed_action: null, needs_confirmation: false, refused: null });
  });

  it('T-AI-2 (실패해야 함) 재고보다 많이 출고 → 거부 + 남은 수량 안내, 재고 · 판매 건수 변화 없음', async () => {
    holder.client = a;
    const stock = await stockOf(a, 'PRD-003');
    const salesBefore = await count(a, 'sales');
    const res = await chat('노트북 거치대 50개 출고해 줘', { type: 'ship_quantity', sku_id: 'PRD-003', qty: stock + 47 });
    expect(res.status).toBe(200);
    expect(res.reply.refused?.reason).toContain('재고가 부족해요');
    expect(res.reply.refused?.reason).toContain(`남은 수량 ${stock}개`);
    expect(res.reply.proposed_action).toBeNull();
    expect(await stockOf(a, 'PRD-003')).toBe(stock);
    expect(await count(a, 'sales')).toBe(salesBefore);
  });

  it('T-AI-4 (실패해야 함) 허용 밖 요청은 거부하고 DB는 그대로. /execute에 허용 밖 type은 400', async () => {
    holder.client = a;
    const logsBefore = await count(a, 'stock_logs');
    const salesBefore = await count(a, 'sales');
    const stockBefore = await stockOf(a, 'PRD-001');
    for (const llm of [{ type: 'delete_all' }, { type: 'set_stock', sku_id: 'PRD-001', qty: 0 }, '모든 재고를 0으로 바꿨습니다.']) {
      const res = await chat('모든 재고를 0으로 바꿔', llm);
      expect(res.status).toBe(200);
      expect(res.reply.refused?.reason).toContain('도와드릴 수 없어요');
      expect(res.reply.proposed_action).toBeNull();
    }
    const bad = await execute({ type: 'delete_all' });
    expect(bad.status).toBe(400);
    expect(bad.body.error?.code).toBe('PF_VALIDATION');
    expect(await count(a, 'stock_logs')).toBe(logsBefore);
    expect(await count(a, 'sales')).toBe(salesBefore);
    expect(await stockOf(a, 'PRD-001')).toBe(stockBefore);
  });

  it('C-01 [실행] 전에는 DB가 바뀌지 않는다: 출고 제안 뒤에도 판매 · 이력 건수 그대로', async () => {
    holder.client = a;
    const logsBefore = await count(a, 'stock_logs');
    const salesBefore = await count(a, 'sales');
    const res = await chat('무선 마우스 2개 출고해 줘', { type: 'ship_quantity', sku_id: '무선 마우스', qty: 2 });
    expect(res.reply.proposed_action).toEqual({ type: 'ship_quantity', sku_id: 'PRD-001', qty: 2 });
    expect(res.reply.needs_confirmation).toBe(true);
    expect(await count(a, 'stock_logs')).toBe(logsBefore);
    expect(await count(a, 'sales')).toBe(salesBefore);
  });

  it('C-02 [실행] ship_quantity → 200, 재고 −qty, 직접출고 판매 1건(agent · 출고완료), 이력 +1, 불변식 통과', async () => {
    holder.client = a;
    const stockBefore = await stockOf(a, 'PRD-001');
    const salesBefore = await count(a, 'sales');
    const logsBefore = await count(a, 'stock_logs');
    const res = await execute({ type: 'ship_quantity', sku_id: 'PRD-001', qty: 2 });
    expect(res.status).toBe(200);
    const result = (res.body.data as { result: { sale_id: string; stock_qty: number; type: string } }).result;
    expect(result).toMatchObject({ type: 'ship_quantity', stock_qty: stockBefore - 2 });

    expect(await stockOf(a, 'PRD-001')).toBe(stockBefore - 2);
    expect(await count(a, 'sales')).toBe(salesBefore + 1);
    expect(await count(a, 'stock_logs')).toBe(logsBefore + 1);
    const { data: sale, error } = await a.from('sales').select('channel,source,fulfillment_status,sold_qty').eq('sale_id', result.sale_id).single();
    expect(error).toBeNull();
    expect(sale).toMatchObject({ channel: '직접출고', source: 'agent', fulfillment_status: '출고완료', sold_qty: 2 });
    await assertInvariants(a);
  });

  it('C-03 [실행] (실패해야 함) 재고 초과 execute → 409 PF_INSUFFICIENT_STOCK, 판매가 만들어지지 않는다', async () => {
    holder.client = a;
    const stock = await stockOf(a, 'PRD-003');
    const salesBefore = await count(a, 'sales');
    const res = await execute({ type: 'ship_quantity', sku_id: 'PRD-003', qty: stock + 1 });
    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe('PF_INSUFFICIENT_STOCK');
    expect(await count(a, 'sales')).toBe(salesBefore);
    expect(await stockOf(a, 'PRD-003')).toBe(stock);
  });

  it('C-04 [실행] 기존 주문 상태 변경: 출고대기 주문을 주문취소로 바꾼다(재고 그대로)', async () => {
    holder.client = a;
    const { data: pending } = await a.from('sales').select('sale_id,sku_id').eq('fulfillment_status', '출고대기').limit(1);
    const sale = pending?.[0];
    expect(sale).toBeDefined();
    const stock = await stockOf(a, sale!.sku_id as string);

    const proposed = await chat(`${sale!.sale_id} 취소해 줘`, { type: 'set_sale_status', sale_id: sale!.sale_id, to: '주문취소' });
    expect(proposed.reply.proposed_action).toEqual({ type: 'set_sale_status', sale_id: sale!.sale_id, to: '주문취소' });

    const res = await execute({ type: 'set_sale_status', sale_id: sale!.sale_id, to: '주문취소' });
    expect(res.status).toBe(200);
    const { data: after } = await a.from('sales').select('fulfillment_status').eq('sale_id', sale!.sale_id).single();
    expect(after!.fulfillment_status).toBe('주문취소');
    expect(await stockOf(a, sale!.sku_id as string)).toBe(stock);
  });

  it('C-05 (실패해야 함) 공백만 있는 메시지 → 400 PF_VALIDATION, LLM을 부르지 않는다 / X-PF 없음 → 403', async () => {
    holder.client = a;
    const calls = holder.llmCalls;
    const blank = await call(postChat, '/api/agent/chat', { message: '   ' });
    expect(blank.status).toBe(400);
    expect(blank.body.error?.code).toBe('PF_VALIDATION');
    expect(holder.llmCalls).toBe(calls);
    expect((await call(postChat, '/api/agent/chat', { message: '재고?' }, {})).status).toBe(403);
    expect((await execute({ type: 'list_low_stock' }, {})).status).toBe(403);
  });

  it('T-AI-5 (실패해야 함) B의 챗봇은 A만의 품목을 답하지 않고, B는 A의 판매 uuid로 실행할 수 없다(404)', async () => {
    holder.client = a;
    const mine = await makeItem(a, { item_name: 'A전용품목' });
    const { data: aSales } = await a.from('sales').select('id').limit(1);
    const aSaleId = aSales![0]!.id as string;

    holder.client = b;
    const byCode = await chat('재고?', { type: 'get_stock', sku_id: mine.sku_id });
    expect(byCode.reply.refused).not.toBeNull();
    expect(byCode.reply.facts).toEqual({});
    const byName = await chat('A전용품목 재고?', { type: 'get_stock', sku_id: 'A전용품목' });
    expect(byName.reply.refused).not.toBeNull();
    expect(JSON.stringify(byName.reply)).not.toContain(mine.sku_id);

    const salesBeforeB = await count(b, 'sales');
    const logsBeforeA = await count(a, 'stock_logs');
    const steal = await execute({ type: 'ship_sale', sale_id: aSaleId });
    expect(steal.status).toBe(404);
    expect(steal.body.error?.code).toBe('PF_NOT_FOUND');
    expect(await count(b, 'sales')).toBe(salesBeforeB);
    expect(await count(a, 'stock_logs')).toBe(logsBeforeA);
  });
});
