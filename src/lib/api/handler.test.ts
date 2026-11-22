/**
 * handler.ts 단위 테스트 — CSRF → 로그인 → JSON → 스키마 → 실행 → 오류 변환(가짜 Supabase).
 *
 * 하는 일: 기대(HTTP · 코드 · 본문)를 먼저 적고, 가짜 Supabase 객체를 주입해 응답과 비교한다.
 *
 * 근거: docs/04-api-contract.md 1 · 2 · 4.1, WU-03 4번 (H 기준)
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — handler 시험 (WU-03)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

// server.ts는 'server-only'와 next/headers를 쓴다 — 단위 시험에서는 가짜 Supabase를 주입하므로 비워 둔다
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));

import { PfError } from './errors';
import { createHandler } from './handler';
import { itemCreate } from '@/lib/validation/schemas';

const ORIGIN = 'https://app.packflow.test';

/** 가짜 Supabase: 로그인 상태를 claims로 정한다. */
function fakeSupabase(claims: { sub?: string; email?: string } | null) {
  const signOut = vi.fn(async () => ({ error: null }));
  const client = {
    auth: { getClaims: async () => ({ data: claims ? { claims } : null, error: null }), signOut },
  } as unknown as SupabaseClient;
  return { client, signOut };
}

const SIGNED_IN = { sub: '00000000-0000-4000-8000-000000000001', email: 'a-a@packflow.test' };

function req(method: string, body?: string, headers: Record<string, string> = {}, path = '/api/items') {
  return new Request(`${ORIGIN}${path}`, {
    method,
    body,
    headers: { origin: ORIGIN, 'x-pf': '1', 'content-type': 'application/json', ...headers },
  });
}

const goodItem = { sku_id: 'PRD-001', item_name: '박스', unit_cost: 1000, sale_price: 2000, safety_stock: 5 };

describe('H: handler', () => {
  afterEach(() => vi.restoreAllMocks());

  it('H-1 미로그인 → 401 PF_UNAUTHENTICATED, run은 불리지 않는다', async () => {
    const run = vi.fn(async () => ({ data: 1 }));
    const handler = createHandler({ run, getSupabase: async () => fakeSupabase(null).client });
    const res = await handler(req('GET'));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('PF_UNAUTHENTICATED');
    expect(run).not.toHaveBeenCalled();
  });

  it('H-2 로그인 상태면 run이 user(id · email)와 함께 불리고 {data}를 200으로 돌려준다', async () => {
    const handler = createHandler({
      run: async ({ user }) => ({ data: { id: user?.id, email: user?.email } }),
      getSupabase: async () => fakeSupabase(SIGNED_IN).client,
    });
    const res = await handler(req('GET'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ data: { id: SIGNED_IN.sub, email: SIGNED_IN.email } });
  });

  it('H-3 status 201을 돌려줄 수 있다', async () => {
    const handler = createHandler({ run: async () => ({ data: { ok: true }, status: 201 }), getSupabase: async () => fakeSupabase(SIGNED_IN).client });
    expect((await handler(req('GET'))).status).toBe(201);
  });

  it('H-4 sub가 비었거나 없으면 미로그인으로 본다', async () => {
    for (const claims of [{}, { sub: '' }, null]) {
      const handler = createHandler({ run: async () => ({ data: 1 }), getSupabase: async () => fakeSupabase(claims).client });
      expect((await handler(req('GET'))).status).toBe(401);
    }
  });

  it('H-5 X-PF 없는 POST → 403 PF_CSRF (로그인 여부보다 먼저, getSupabase도 부르지 않는다)', async () => {
    const getSupabase = vi.fn(async () => fakeSupabase(SIGNED_IN).client);
    const handler = createHandler({ run: async () => ({ data: 1 }), getSupabase });
    const res = await handler(new Request(`${ORIGIN}/api/items`, { method: 'POST', body: '{}', headers: { origin: ORIGIN } }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('PF_CSRF');
    expect(getSupabase).not.toHaveBeenCalled();
  });

  it('H-6 다른 Origin의 POST → 403 PF_CSRF', async () => {
    const handler = createHandler({ run: async () => ({ data: 1 }), getSupabase: async () => fakeSupabase(SIGNED_IN).client });
    const res = await handler(req('POST', '{}', { origin: 'https://evil.packflow.test' }));
    expect(res.status).toBe(403);
  });

  it('H-7 깨진 JSON → 400 PF_VALIDATION {field: body, reason: bad_format}', async () => {
    const handler = createHandler({ schema: itemCreate, run: async () => ({ data: 1 }), getSupabase: async () => fakeSupabase(SIGNED_IN).client });
    const res = await handler(req('POST', '{not json'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('PF_VALIDATION');
    expect(body.error.detail).toEqual({ field: 'body', reason: 'bad_format' });
  });

  it('H-8 빈 본문도 JSON이 아니므로 400', async () => {
    const handler = createHandler({ schema: itemCreate, run: async () => ({ data: 1 }), getSupabase: async () => fakeSupabase(SIGNED_IN).client });
    expect((await handler(req('POST', ''))).status).toBe(400);
  });

  it('H-9 100KB 넘는 본문 → 400 too_long (field body)', async () => {
    const handler = createHandler({ schema: itemCreate, run: async () => ({ data: 1 }), getSupabase: async () => fakeSupabase(SIGNED_IN).client });
    const res = await handler(req('POST', JSON.stringify({ x: 'a'.repeat(102_500) })));
    expect(res.status).toBe(400);
    expect((await res.json()).error.detail).toEqual({ field: 'body', reason: 'too_long', max: 102_400 });
  });

  it('H-10 스키마 실패 → 400 + detail {field, reason, min, max}', async () => {
    const run = vi.fn(async () => ({ data: 1 }));
    const handler = createHandler({ schema: itemCreate, run, getSupabase: async () => fakeSupabase(SIGNED_IN).client });
    const res = await handler(req('POST', JSON.stringify({ ...goodItem, safety_stock: 100_001 })));
    expect(res.status).toBe(400);
    expect((await res.json()).error.detail).toEqual({ field: 'safety_stock', reason: 'out_of_range', min: 0, max: 100_000 });
    expect(run).not.toHaveBeenCalled();
  });

  it('H-11 계약에 없는 필드(user_id) → 400 not_allowed_field', async () => {
    const handler = createHandler({ schema: itemCreate, run: async () => ({ data: 1 }), getSupabase: async () => fakeSupabase(SIGNED_IN).client });
    const res = await handler(req('POST', JSON.stringify({ ...goodItem, user_id: 'someone-else' })));
    expect((await res.json()).error.detail).toEqual({ field: 'user_id', reason: 'not_allowed_field' });
  });

  it('H-12 통과한 본문은 정규화된 값으로 run에 간다("" → null, 공백 제거)', async () => {
    const seen: unknown[] = [];
    const handler = createHandler({
      schema: itemCreate,
      run: async ({ body }) => {
        seen.push(body);
        return { data: body, status: 201 };
      },
      getSupabase: async () => fakeSupabase(SIGNED_IN).client,
    });
    const res = await handler(req('POST', JSON.stringify({ ...goodItem, item_name: '  박스  ', source_url: '' })));
    expect(res.status).toBe(201);
    expect(seen[0]).toEqual({ ...goodItem, item_name: '박스', source_url: null });
  });

  it('H-13 run 안의 PfError → 그 코드의 HTTP와 detail', async () => {
    const handler = createHandler({
      run: async () => {
        throw new PfError('PF_INSUFFICIENT_STOCK', { sku_id: 'PRD-001', stock_qty: 4, requested: 9 });
      },
      getSupabase: async () => fakeSupabase(SIGNED_IN).client,
    });
    const res = await handler(req('GET'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.message).toBe('재고가 부족해요. PRD-001 남은 수량 4개');
    expect(body.error.detail).toEqual({ sku_id: 'PRD-001', stock_qty: 4, requested: 9 });
  });

  it('H-14 run이 던진 Supabase 오류 모양({message: 코드})도 코드로 바뀐다', async () => {
    const handler = createHandler({
      run: async () => {
        throw { message: 'PF_NOT_FOUND', details: null };
      },
      getSupabase: async () => fakeSupabase(SIGNED_IN).client,
    });
    expect((await handler(req('GET'))).status).toBe(404);
  });

  it('H-15 모르는 예외 → 500 PF_INTERNAL, 원문이 응답에 없고 로그에만 있다', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = createHandler({
      run: async () => {
        throw new Error('connect ECONNREFUSED 10.0.0.5:5432 for a-a@packflow.test');
      },
      getSupabase: async () => fakeSupabase(SIGNED_IN).client,
    });
    const res = await handler(req('GET'));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text).error.code).toBe('PF_INTERNAL');
    expect(text).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|packflow\.test/);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).not.toContain('a-a@packflow.test');
  });

  it('H-16 인증 확인 중 예외(getSupabase 실패)도 500 PF_INTERNAL', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = createHandler({
      run: async () => ({ data: 1 }),
      getSupabase: async () => {
        throw new Error('환경변수가 비어 있어요');
      },
    });
    const res = await handler(req('GET'));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('환경변수');
  });

  it('H-17 requireUser: false면 미로그인도 run까지 간다(로그아웃), 그래도 CSRF는 검사한다', async () => {
    const { client, signOut } = fakeSupabase(null);
    const handler = createHandler({
      requireUser: false,
      run: async ({ supabase }) => {
        await supabase.auth.signOut();
        return { data: { ok: true } };
      },
      getSupabase: async () => client,
    });
    expect((await handler(req('POST', undefined, {}, '/api/auth/logout'))).status).toBe(200);
    expect(signOut).toHaveBeenCalledTimes(1);
    const noPf = await handler(new Request(`${ORIGIN}/api/auth/logout`, { method: 'POST', headers: { origin: ORIGIN } }));
    expect(noPf.status).toBe(403);
  });

  it('H-18 경로 파라미터(params Promise)와 쿼리 스키마가 run에 전달된다', async () => {
    const { stockLogsQuery } = await import('@/lib/validation/schemas');
    const handler = createHandler<undefined, { limit: number }, { id: string }>({
      query: stockLogsQuery as never,
      run: async ({ params, query }) => ({ data: { id: params.id, limit: query.limit } }),
      getSupabase: async () => fakeSupabase(SIGNED_IN).client,
    });
    const res = await handler(req('GET', undefined, {}, '/api/x?limit=7'), { params: Promise.resolve({ id: 'abc' }) });
    expect(await res.json()).toEqual({ data: { id: 'abc', limit: 7 } });
    const bad = await handler(req('GET', undefined, {}, '/api/x?limit=99'), { params: Promise.resolve({ id: 'abc' }) });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.detail).toMatchObject({ field: 'limit', reason: 'out_of_range' });
  });
});
