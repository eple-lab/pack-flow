/**
 * POST /api/seed 단위 시험 — 가짜 rpc로 라우트 → 시드 로더 → pf_reset_and_seed 흐름을 본다.
 *
 * 기대(먼저 적음)
 * - C-60 dataset "demo" → rpc pf_reset_and_seed 한 번, p_data = 검사를 통과한 demo 시드, 200 + 건수 그대로
 * - C-61 (실패해야 함) dataset "xyz" · 빈 본문 · user_id 같이 보냄 → 400 PF_VALIDATION, rpc 0회
 * - C-62 small · large → 요청한 시드로 rpc 한 번, 200 + 건수 그대로
 * - C-63 (실패해야 함) 미로그인 401 · X-PF 없음 403, rpc 0회
 * - C-64 DB가 PF_VALIDATION을 돌려주면 400 그대로, 모르는 오류는 500 PF_INTERNAL(원문 없음)
 * - C-65 (실패해야 함) 시드를 못 읽거나 형식이 깨져 SeedError가 나면(loadSeed를 가짜로 바꿔 일으킨다)
 *        demo · small · large 모두 400 PF_VALIDATION field "dataset", 응답에 파일 경로 없음, rpc 0회
 *
 * 근거: docs/04-api-contract.md 3.7, WU-43
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/seed 단위 시험 (WU-43)
 * 2026-11-23  eple  C-65 SeedError → 400 실패 시험 복원 — #40에서 small · large가 생기며 옛 C-62와 함께 빠졌음 (WU-43)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { fakeRpcDb } from '@/lib/queries/fakeRpc.testutil';
import demo from '@/lib/seed/demo.json';
import small from '@/lib/seed/small.json';
import large from '@/lib/seed/large.json';

vi.mock('server-only', () => ({}));
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => holder.client as SupabaseClient }));

// C-65용: failLoad가 켜져 있으면 loadSeed가 파일 경로가 든 SeedError를 던진다. 꺼져 있으면 진짜 로더.
const loader = vi.hoisted(() => ({ failLoad: false }));
vi.mock('@/lib/seed', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/seed')>();
  return {
    ...actual,
    loadSeed: (name: string) =>
      loader.failLoad ? Promise.reject(new actual.SeedError(`${name} 형식 오류 — src/lib/seed/${name}.json items`)) : actual.loadSeed(name),
  };
});

import { POST as postSeed } from './route';

const ORIGIN = 'https://app.packflow.test';
const COUNTS = { items: 8, purchases: 4, sales: 6, logs: 8 };

function call(body: unknown, opts: { csrf?: boolean } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', origin: ORIGIN };
  if (opts.csrf !== false) headers['x-pf'] = '1';
  return postSeed(new Request(`${ORIGIN}/api/seed`, { method: 'POST', headers, body: JSON.stringify(body) }));
}

describe('POST /api/seed', () => {
  it('C-60 demo → pf_reset_and_seed 한 번(검사한 demo 시드), 200 + 건수', async () => {
    const db = fakeRpcDb({ rpc: () => ({ data: COUNTS }) });
    holder.client = db.client;
    const res = await call({ dataset: 'demo' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: COUNTS });
    expect(db.rpcCalls).toHaveLength(1);
    expect(db.rpcCalls[0].fn).toBe('pf_reset_and_seed');
    expect(db.rpcCalls[0].args.p_data).toEqual(demo);
  });

  it('C-61 (실패해야 함) 모르는 dataset · 빈 본문 · user_id → 400, rpc 0회', async () => {
    for (const body of [{ dataset: 'xyz' }, {}, { dataset: 'demo', user_id: '00000000-0000-4000-8000-000000000002' }]) {
      const db = fakeRpcDb();
      holder.client = db.client;
      const res = await call(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('PF_VALIDATION');
      expect(db.rpcCalls).toHaveLength(0);
    }
  });

  it.each([
    ['small', small, { items: 5, purchases: 10, sales: 5, logs: 20 }],
    ['large', large, { items: 10, purchases: 20, sales: 20, logs: 50 }],
  ] as const)('C-62 %s → 해당 시드 적재 및 건수 반환', async (dataset, seed, counts) => {
    const db = fakeRpcDb({ rpc: () => ({ data: counts }) });
    holder.client = db.client;
    const res = await call({ dataset });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: counts });
    expect(db.rpcCalls).toHaveLength(1);
    expect(db.rpcCalls[0]).toMatchObject({ fn: 'pf_reset_and_seed', args: { p_data: seed } });
  });

  it('C-63 (실패해야 함) 미로그인 401 · X-PF 없음 403, rpc 0회', async () => {
    const anon = fakeRpcDb({ claims: null });
    holder.client = anon.client;
    expect((await call({ dataset: 'demo' })).status).toBe(401);
    expect(anon.rpcCalls).toHaveLength(0);

    const db = fakeRpcDb();
    holder.client = db.client;
    const res = await call({ dataset: 'demo' }, { csrf: false });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('PF_CSRF');
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('C-64 DB의 PF_VALIDATION은 400 그대로, 모르는 오류는 500 PF_INTERNAL(원문 없음)', async () => {
    holder.client = fakeRpcDb({ rpc: () => ({ error: { message: 'PF_VALIDATION', details: JSON.stringify({ field: 'items', reason: 'bad_format' }) } }) }).client;
    const bad = await call({ dataset: 'demo' });
    expect(bad.status).toBe(400);

    holder.client = fakeRpcDb({ rpc: () => ({ error: { message: 'relation "secret_table" does not exist', code: '42P01' } }) }).client;
    const res = await call({ dataset: 'demo' });
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe('PF_INTERNAL');
    expect(text).not.toContain('secret_table');
  });

  it('C-65 (실패해야 함) SeedError → 400 field dataset, 경로 미노출, rpc 0회', async () => {
    loader.failLoad = true;
    try {
      for (const dataset of ['demo', 'small', 'large']) {
        const db = fakeRpcDb();
        holder.client = db.client;
        const res = await call({ dataset });
        const text = await res.text();
        expect(res.status).toBe(400);
        expect(JSON.parse(text).error).toMatchObject({ code: 'PF_VALIDATION', detail: { field: 'dataset' } });
        expect(text).not.toContain('src/lib/seed');
        expect(db.rpcCalls).toHaveLength(0);
      }
    } finally {
      loader.failLoad = false;
    }
  });
});
