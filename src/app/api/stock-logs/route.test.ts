/**
 * GET /api/stock-logs 라우트 시험 — 검증 · 인증 · 오류 변환 · 쿼리 전달(가짜 Supabase 주입).
 *
 * 하는 일: 라우트의 createHandler는 getSupabase를 주입할 수 없으므로 '@/lib/supabase/server'를 가짜로 바꿔
 * 실제 GET 핸들러를 그대로 부른다. 기대(상태 · 코드)를 먼저 적고 응답과 비교한다.
 *
 * 근거: docs/04-api-contract.md 3.5 · 4.3, WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — stock-logs 라우트 시험 (WU-41)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));

const state = vi.hoisted(() => ({
  claims: { sub: 'u-1' } as { sub?: string } | null,
  result: { data: [] as unknown[] | null, error: null as unknown },
  calls: { eq: [] as unknown[][], limit: [] as number[] },
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: { getClaims: async () => ({ data: state.claims ? { claims: state.claims } : null, error: null }) },
    from: () => {
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (...a: unknown[]) => (state.calls.eq.push(a), b),
        or: () => b,
        order: () => b,
        limit: (n: number) => (state.calls.limit.push(n), b),
        then: (resolve: (v: unknown) => unknown) => resolve(state.result),
      };
      return b;
    },
  }),
}));

import { GET } from './route';

const ORIGIN = 'https://app.packflow.test';
const call = (qs = '') => GET(new Request(`${ORIGIN}/api/stock-logs${qs}`, { headers: { origin: ORIGIN, 'x-pf': '1' } }));

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    log_id: n - i,
    sku_id: 'PRD-001',
    change_qty: 1,
    reason: '재고조정',
    ref_type: 'seed',
    ref_id: 'seed',
    created_at: '2026-11-23T01:00:00.000000+00:00',
  }));

describe('C-32 GET /api/stock-logs', () => {
  beforeEach(() => {
    state.claims = { sub: 'u-1' };
    state.result = { data: [], error: null };
    state.calls = { eq: [], limit: [] };
  });

  it.each([['limit=0'], ['limit=51'], ['limit=abc']])('C-32a 기대: ?%s → 400 PF_VALIDATION field limit', async (qs) => {
    const res = await call(`?${qs}`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('PF_VALIDATION');
    expect(body.error.detail.field).toBe('limit');
  });

  it('C-32b 기대: 잘못된 cursor → 400 PF_VALIDATION field cursor, DB 조회 없음', async () => {
    const res = await call('?cursor=%21%21%21');
    expect(res.status).toBe(400);
    expect((await res.json()).error.detail).toMatchObject({ field: 'cursor', reason: 'bad_format' });
    expect(state.calls.limit).toEqual([]);
  });

  it('C-32c 기대: limit=50 → DB에는 51건 요청, 51건이 돌아오면 50건 + next_cursor', async () => {
    state.result = { data: rows(51), error: null };
    const res = await call('?limit=50');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(state.calls.limit).toEqual([51]);
    expect(data.rows).toHaveLength(50);
    expect(typeof data.next_cursor).toBe('string');
  });

  it('C-32d 기대: limit 없으면 기본 20(DB에 21), 3건이면 next_cursor null', async () => {
    state.result = { data: rows(3), error: null };
    const { data } = await (await call()).json();
    expect(state.calls.limit).toEqual([21]);
    expect(data.next_cursor).toBeNull();
    expect(data.rows).toHaveLength(3);
  });

  it('C-32e 기대: sku_id=PRD-001이 eq로 전달된다. 형식이 틀린 sku_id는 400', async () => {
    await call('?sku_id=PRD-001');
    expect(state.calls.eq).toEqual([['sku_id', 'PRD-001']]);
    const res = await call('?sku_id=bad%20sku');
    expect(res.status).toBe(400);
    expect((await res.json()).error.detail.field).toBe('sku_id');
  });

  it('C-32f 기대: 로그인 안 함 → 401 PF_UNAUTHENTICATED, DB 조회 없음', async () => {
    state.claims = null;
    const res = await call();
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('PF_UNAUTHENTICATED');
    expect(state.calls.limit).toEqual([]);
  });

  it('C-32g 기대: Supabase 오류 → 500 PF_INTERNAL, 원문은 응답에 없다', async () => {
    state.result = { data: null, error: { message: 'relation secret_table broken', code: '42P01' } };
    const res = await call();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain('PF_INTERNAL');
    expect(text).not.toContain('secret_table');
  });
});
