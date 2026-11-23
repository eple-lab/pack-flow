/**
 * stockLogs.ts 단위 테스트 — 커서 왕복 · 잘못된 커서 · 키셋 페이지 이동(메모리 가짜 Supabase).
 *
 * 하는 일: 기대를 먼저 적고 실제와 비교한다. 가짜 Supabase는 eq · or · order · limit을 실제로 해석해
 * 정렬 · 필터를 하므로 listStockLogs가 만든 or 필터 문자열이 틀리면 중복 · 누락으로 드러난다.
 *
 * 근거: docs/04-api-contract.md 3.5 · 4.3, docs/07-test-strategy.md (T-S4-2 단위 쪽), WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 재고 이력 키셋 시험 (WU-41)
 * 2026-11-23  eple  C-31g 기대를 throwIfDbError 통일(PfError 변환)에 맞춤 (WU-41)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { PfError } from '@/lib/api/errors';
import type { StockLog } from '@/types/erp';
import { decodeCursor, encodeCursor, listStockLogs } from './stockLogs';

/** PostgREST처럼 마이크로초 + `+00:00` 모양의 시각(같은 시각이 5건씩 겹친다). log_id가 클수록 최근. */
function makeLogs(n: number): StockLog[] {
  return Array.from({ length: n }, (_, i) => ({
    log_id: i + 1,
    sku_id: i % 2 === 0 ? 'PRD-001' : 'PRD-002',
    change_qty: 1,
    reason: '재고조정' as const,
    ref_type: 'seed' as const,
    ref_id: 'seed',
    created_at: `2026-11-23T01:00:${String(Math.floor(i / 5)).padStart(2, '0')}.123456+00:00`,
  }));
}

const norm = (v: string) => v.replace('+00:00', 'Z');

/** or 문자열 `created_at.lt.X,and(created_at.eq.X,log_id.lt.Y)`을 해석하는 메모리 가짜 Supabase. */
function fakeDb(rows: StockLog[], opts: { error?: unknown } = {}) {
  const calls = { eq: [] as Array<[string, unknown]>, or: [] as string[], limit: [] as number[] };
  const client = {
    from() {
      let data = [...rows];
      const orders: Array<['created_at' | 'log_id', number]> = [];
      let limitN = Infinity;
      // 여러 order는 앞 키가 우선(SQL 의미)
      const sorted = () =>
        [...data].sort((a, c) => {
          for (const [col, sign] of orders) {
            const x = col === 'created_at' ? norm(a.created_at) : a.log_id;
            const y = col === 'created_at' ? norm(c.created_at) : c.log_id;
            if (x !== y) return x < y ? -sign : sign;
          }
          return 0;
        });
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (col: string, val: unknown) => {
          calls.eq.push([col, val]);
          data = data.filter((r) => (r as Record<string, unknown>)[col] === val);
          return b;
        },
        or: (expr: string) => {
          calls.or.push(expr);
          const m = /^created_at\.lt\.(.+?),and\(created_at\.eq\.(.+?),log_id\.lt\.(\d+)\)$/.exec(expr);
          if (!m) throw new Error(`or 모양 틀림: ${expr}`);
          const [, t1, t2, id] = m;
          data = data.filter((r) => norm(r.created_at) < t1 || (norm(r.created_at) === t2 && r.log_id < Number(id)));
          return b;
        },
        order: (col: 'created_at' | 'log_id', o: { ascending: boolean }) => {
          orders.push([col, o.ascending ? 1 : -1]);
          return b;
        },
        limit: (n: number) => {
          calls.limit.push(n);
          limitN = n;
          return b;
        },
        then: (resolve: (v: unknown) => unknown) =>
          resolve(opts.error ? { data: null, error: opts.error } : { data: sorted().slice(0, limitN), error: null }),
      };
      return b;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

// ── 커서 ───────────────────────────────────────────────────────────────

describe('C-30 커서 인코드 · 디코드', () => {
  it('C-30a 기대: encode→decode가 같은 값(마이크로초 보존, +00:00은 Z로 통일), 문자열은 url-safe', () => {
    const c = encodeCursor({ created_at: '2026-11-23T01:00:02.123456+00:00', log_id: 42 });
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(c)).toEqual({ created_at: '2026-11-23T01:00:02.123456Z', log_id: 42 });
  });

  const b64 = (v: unknown) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
  const bad: Array<[string, string]> = [
    ['무작위 글자', '!!!not base64!!!'],
    ['base64지만 JSON 아님', b64('hello world')],
    ['필드 빠짐', b64({ created_at: '2026-11-23T01:00:00Z' })],
    ['날짜 아님', b64({ created_at: 'yesterday', log_id: 3 })],
    ['없는 날짜', b64({ created_at: '2026-02-31T01:00:00Z', log_id: 3 })],
    ['log_id 음수', b64({ created_at: '2026-11-23T01:00:00Z', log_id: -3 })],
    ['log_id 소수', b64({ created_at: '2026-11-23T01:00:00Z', log_id: 1.5 })],
    ['log_id 문자열', b64({ created_at: '2026-11-23T01:00:00Z', log_id: '3' })],
    ['주입 시도 시각', b64({ created_at: '2026-11-23T01:00:00Z),log_id.gt.0', log_id: 3 })],
    ['배열', b64([1, 2])],
  ];
  it.each(bad)('C-30b 기대: %s → PfError PF_VALIDATION field cursor', (_name, cursor) => {
    let thrown: unknown;
    try {
      decodeCursor(cursor);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(PfError);
    expect((thrown as PfError).code).toBe('PF_VALIDATION');
    expect((thrown as PfError).detail).toMatchObject({ field: 'cursor', reason: 'bad_format' });
  });
});

// ── 키셋 페이지 이동 ───────────────────────────────────────────────────

describe('C-31 listStockLogs 키셋', () => {
  it('C-31a 기대: 50건(같은 시각 5건씩 겹침)을 limit 20으로 20 · 20 · 10건, 마지막 next_cursor null, 중복 · 누락 없음, 최근순', async () => {
    const { client, calls } = fakeDb(makeLogs(50));
    const seen: number[] = [];
    const sizes: number[] = [];
    let cursor: string | undefined;
    let last: string | null = 'unset';
    for (let i = 0; i < 5; i++) {
      const page = await listStockLogs(client, { limit: 20, cursor });
      sizes.push(page.rows.length);
      seen.push(...page.rows.map((r) => r.log_id));
      last = page.next_cursor;
      if (!page.next_cursor) break;
      cursor = page.next_cursor;
    }
    expect(sizes).toEqual([20, 20, 10]);
    expect(last).toBeNull();
    expect(new Set(seen).size).toBe(50);
    expect(seen).toEqual(Array.from({ length: 50 }, (_, i) => 50 - i));
    expect(calls.limit).toEqual([21, 21, 21]);
  });

  it('C-31b 기대: 정확히 limit건이면 next_cursor null, limit+1건이면 마지막 행(log_id 2)으로 만든 커서', async () => {
    const exact = await listStockLogs(fakeDb(makeLogs(20)).client, { limit: 20 });
    expect(exact.rows).toHaveLength(20);
    expect(exact.next_cursor).toBeNull();
    const more = await listStockLogs(fakeDb(makeLogs(21)).client, { limit: 20 });
    expect(more.rows).toHaveLength(20);
    expect(decodeCursor(more.next_cursor ?? '')).toMatchObject({ log_id: 2 });
  });

  it('C-31c 기대: 모두 같은 시각 12건을 5건씩 3쪽 → log_id만으로 가른다, 중복 · 누락 없음', async () => {
    const rows = makeLogs(12).map((r) => ({ ...r, created_at: '2026-11-23T01:00:00.000001+00:00' }));
    const { client } = fakeDb(rows);
    const ids: number[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const page = await listStockLogs(client, { limit: 5, cursor });
      ids.push(...page.rows.map((r) => r.log_id));
      if (!page.next_cursor) break;
      cursor = page.next_cursor;
    }
    expect(ids).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('C-31d 기대: sku_id가 있으면 eq로 전달되어 그 품목만(25건), 없으면 eq 호출 없음', async () => {
    const f = fakeDb(makeLogs(50));
    const page = await listStockLogs(f.client, { sku_id: 'PRD-001', limit: 50 });
    expect(f.calls.eq).toEqual([['sku_id', 'PRD-001']]);
    expect(page.rows).toHaveLength(25);
    expect(page.rows.every((r) => r.sku_id === 'PRD-001')).toBe(true);
    const g = fakeDb(makeLogs(3));
    await listStockLogs(g.client, { limit: 20 });
    expect(g.calls.eq).toEqual([]);
  });

  it('C-31e 기대: 잘못된 커서면 DB를 부르기 전에 PF_VALIDATION(cursor)', async () => {
    const f = fakeDb(makeLogs(3));
    await expect(listStockLogs(f.client, { limit: 20, cursor: 'zzz***' })).rejects.toMatchObject({
      code: 'PF_VALIDATION',
      detail: { field: 'cursor' },
    });
    expect(f.calls.limit).toEqual([]);
  });

  it('C-31f 기대: 빈 결과는 rows [] · next_cursor null', async () => {
    expect(await listStockLogs(fakeDb([]).client, { limit: 20 })).toEqual({ rows: [], next_cursor: null });
  });

  it('C-31g 기대: 모르는 Supabase 오류는 PfError PF_INTERNAL로 바뀌어 던져진다(원문 없음)', async () => {
    const err = { message: 'boom', code: '42P01' };
    await expect(listStockLogs(fakeDb([], { error: err }).client, { limit: 20 })).rejects.toMatchObject({ name: 'PfError', code: 'PF_INTERNAL' });
  });
});
