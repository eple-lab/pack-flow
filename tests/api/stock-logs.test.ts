/**
 * T-S4-2 재고 이력 키셋 페이지네이션 — 실제 dev DB · 사용자 JWT로 GET /api/stock-logs를 부른다.
 *
 * 하는 일
 * 1. 계정 A로 로그인하고 createServerSupabase를 그 클라이언트로 바꿔(vi.mock) route 모듈의 GET을 Request로 직접 부른다.
 * 2. large 규모(품목 10 · 이력 50) 시드를 객체로 만들어 넣는다. large.json(WU-22)이 아직 없어서다 — 생기면 'large'로 바꾼다.
 *    시드는 한 트랜잭션이라 이력 50건의 created_at이 모두 같다 → 페이지 경계가 log_id만으로 갈리는지까지 본다.
 * 3. 끝에 demo 시드로 되돌린다(계정 A 데이터만).
 *
 * 기대(먼저 적음)
 * - 기본 limit(20)으로 세 번: 20 · 20 · 10건, 앞 두 번은 next_cursor 문자열, 마지막은 null
 * - 세 페이지를 이으면 50건, log_id 중복 없음, (created_at, log_id) 내림차순 — DB에서 직접 읽은 순서와 같다
 * - limit=50 한 번이면 50건 · next_cursor null
 * - sku_id 필터: 그 품목 이력만(품목당 5건)
 * - 실패해야 함: limit=0 · 51 → 400 PF_VALIDATION field limit, 깨진 cursor → 400 field cursor
 *
 * 근거: docs/07-test-strategy.md T-S4-2, docs/04-api-contract.md 3.5, WU-41
 * 구역: eple (docs/06-work-plan.md 1절 'API 테스트')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — T-S4-2 실제 DB 시험 (WU-41)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { StockLog, StockLogPage } from '@/types/erp';
import { resetAndSeed, signIn } from '../db/helpers';

vi.mock('server-only', () => ({}));
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => holder.client as SupabaseClient }));

import { GET as getStockLogs } from '@/app/api/stock-logs/route';

const ORIGIN = 'https://app.packflow.test';

async function get(query: string): Promise<{ status: number; body: { data?: StockLogPage; error?: { code: string; detail?: { field?: string } } } }> {
  const response = await getStockLogs(new Request(`${ORIGIN}/api/stock-logs${query}`, { headers: { origin: ORIGIN } }));
  return { status: response.status, body: await response.json() };
}

/**
 * large 규모 시드: 품목 10(초기 재고 → 재고조정 이력 10) + 품목마다 구매 2건 입고(20) + 판매 2건 출고(20) = 이력 50.
 */
function largeLikeSeed() {
  const skus = Array.from({ length: 10 }, (_, i) => `LRG-${String(i + 1).padStart(3, '0')}`);
  return {
    items: skus.map((sku_id, i) => ({ sku_id, item_name: `대량 품목 ${i + 1}`, unit_cost: 1000, sale_price: 2000, initial_qty: 100, safety_stock: 5 })),
    purchases: skus.flatMap((sku_id, i) => [0, 1].map((k) => ({ purchase_id: `P-${100 + i * 2 + k}`, sku_id, supplier: '대량거래처', order_qty: 10, purchase_cost: 10000 }))),
    sales: skus.flatMap((sku_id, i) => [0, 1].map((k) => ({ sale_id: `S-${200 + i * 2 + k}`, sku_id, channel: '쿠팡', sold_qty: 3, sale_amount: 6000, fulfillment_status: '출고대기' }))),
    events: [
      ...skus.flatMap((_, i) => [0, 1].map((k) => ({ op: 'receive', purchase_id: `P-${100 + i * 2 + k}`, received_qty: 10 }))),
      ...skus.flatMap((_, i) => [0, 1].map((k) => ({ op: 'ship', sale_id: `S-${200 + i * 2 + k}` }))),
    ],
  };
}

let client: SupabaseClient;

beforeAll(async () => {
  client = await signIn('A');
  holder.client = client;
  const result = await resetAndSeed(client, largeLikeSeed());
  expect(result.logs).toBe(50);
});

afterAll(async () => {
  await resetAndSeed(client, 'demo');
});

describe('T-S4-2 재고 이력 페이지네이션 (실제 DB)', () => {
  it('T-S4-2a 기본 limit로 20 · 20 · 10건, 마지막 next_cursor null, 이어 붙이면 DB 순서와 같다', async () => {
    const pages: StockLogPage[] = [];
    let query = '';
    for (let i = 0; i < 3; i += 1) {
      const { status, body } = await get(query);
      expect(status).toBe(200);
      pages.push(body.data!);
      query = body.data!.next_cursor ? `?cursor=${encodeURIComponent(body.data!.next_cursor)}` : '';
    }
    expect(pages.map((p) => p.rows.length)).toEqual([20, 20, 10]);
    expect(typeof pages[0].next_cursor).toBe('string');
    expect(typeof pages[1].next_cursor).toBe('string');
    expect(pages[2].next_cursor).toBeNull();

    const joined: StockLog[] = pages.flatMap((p) => p.rows);
    expect(new Set(joined.map((r) => r.log_id)).size).toBe(50);

    const { data: direct, error } = await client
      .from('stock_logs')
      .select('log_id')
      .order('created_at', { ascending: false })
      .order('log_id', { ascending: false });
    expect(error).toBeNull();
    expect(joined.map((r) => r.log_id)).toEqual((direct ?? []).map((r) => r.log_id));
  });

  it('T-S4-2b limit=50 한 번이면 50건, next_cursor null', async () => {
    const { status, body } = await get('?limit=50');
    expect(status).toBe(200);
    expect(body.data!.rows).toHaveLength(50);
    expect(body.data!.next_cursor).toBeNull();
  });

  it('T-S4-2c sku_id 필터는 그 품목 이력 5건만', async () => {
    const { body } = await get('?sku_id=LRG-003');
    expect(body.data!.rows).toHaveLength(5);
    expect(body.data!.rows.every((r) => r.sku_id === 'LRG-003')).toBe(true);
    expect(body.data!.next_cursor).toBeNull();
  });

  it('T-S4-2d (실패해야 함) limit 0 · 51 → 400 field limit, 깨진 cursor → 400 field cursor', async () => {
    for (const q of ['?limit=0', '?limit=51']) {
      const { status, body } = await get(q);
      expect(status).toBe(400);
      expect(body.error?.code).toBe('PF_VALIDATION');
      expect(body.error?.detail?.field).toBe('limit');
    }
    const broken = await get('?cursor=not-a-cursor');
    expect(broken.status).toBe(400);
    expect(broken.body.error?.detail?.field).toBe('cursor');
  });
});
