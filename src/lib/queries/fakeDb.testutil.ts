/**
 * 쿼리 · 라우트 단위 시험용 가짜 Supabase (메모리 표 위에서 eq · gte · lt · order · limit · count를 흉내 낸다).
 *
 * 하는 일
 * 1. 표(table 이름 → 행 배열)를 받아 select 체인을 실제로 걸러 주므로, 경계(KST 자정)나 정렬 시험이 진짜 비교가 된다.
 * 2. 호출 기록(calls)을 남겨 "status가 eq로 전달됐나", "DB를 안 불렀나"를 확인할 수 있다.
 * 3. failTables에 든 표는 오류(message에 원문)를 돌려준다 — 원문이 응답에 안 새는지 시험하려는 것.
 * 4. 시험 전용이다(파일 이름이 *.test.ts가 아니라 시험으로 돌지 않는다). 서비스 키 · 실제 연결과 무관하다.
 *
 * 근거: docs/07-test-strategy.md, WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 가짜 Supabase 메모리 표 (WU-41)
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type Row = Record<string, unknown>;
type Op = { op: 'select' | 'eq' | 'gte' | 'lt' | 'order' | 'limit'; args: unknown[] };

/** 어떤 표에 어떤 연산이 불렸는가. */
export type Call = { table: string; ops: Op[] };

/** 값 비교: 둘 다 ISO 시각이면 시각으로, 아니면 그대로 비교한다. */
function cmp(a: unknown, b: unknown): number {
  if (typeof a === 'string' && typeof b === 'string') {
    const ta = Date.parse(a);
    const tb = Date.parse(b);
    if (!Number.isNaN(ta) && !Number.isNaN(tb) && /^\d{4}-\d{2}-\d{2}T/.test(a)) return ta - tb;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return (a as number) - (b as number);
}

/**
 * 가짜 Supabase를 만든다.
 * @param tables 표 이름 → 행
 * @param options.failTables 이 표를 읽으면 `{ message: '원문 …' }` 오류를 돌려준다
 * @param options.claims 로그인 상태(null이면 미로그인)
 */
export function fakeDb(
  tables: Record<string, Row[]>,
  options: { failTables?: string[]; claims?: { sub: string; email?: string } | null } = {},
) {
  const calls: Call[] = [];
  const claims = options.claims === undefined ? { sub: '00000000-0000-4000-8000-000000000001' } : options.claims;

  function from(table: string) {
    const ops: Op[] = [];
    let head = false;
    let counted = false;
    const builder = {
      select(columns: string, opts?: { count?: string; head?: boolean }) {
        ops.push({ op: 'select', args: [columns, opts] });
        head = opts?.head === true;
        counted = opts?.count === 'exact';
        return builder;
      },
      eq(col: string, val: unknown) {
        ops.push({ op: 'eq', args: [col, val] });
        return builder;
      },
      gte(col: string, val: unknown) {
        ops.push({ op: 'gte', args: [col, val] });
        return builder;
      },
      lt(col: string, val: unknown) {
        ops.push({ op: 'lt', args: [col, val] });
        return builder;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        ops.push({ op: 'order', args: [col, opts] });
        return builder;
      },
      limit(n: number) {
        ops.push({ op: 'limit', args: [n] });
        return builder;
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        calls.push({ table, ops: [...ops] });
        let result: { data: Row[] | null; count: number | null; error: unknown };
        if (options.failTables?.includes(table)) {
          result = { data: null, count: null, error: { message: `원문 DB 오류 ${table} secret-detail`, code: 'XX000' } };
        } else {
          let rows = [...(tables[table] ?? [])];
          for (const { op, args } of ops) {
            if (op === 'eq') rows = rows.filter((r) => r[args[0] as string] === args[1]);
            if (op === 'gte') rows = rows.filter((r) => r[args[0] as string] != null && cmp(r[args[0] as string], args[1]) >= 0);
            if (op === 'lt') rows = rows.filter((r) => r[args[0] as string] != null && cmp(r[args[0] as string], args[1]) < 0);
          }
          for (const { op, args } of [...ops].reverse()) {
            if (op !== 'order') continue;
            const col = args[0] as string;
            const asc = (args[1] as { ascending?: boolean } | undefined)?.ascending !== false;
            rows.sort((a, b) => (asc ? 1 : -1) * cmp(a[col], b[col]));
          }
          const lim = ops.find((o) => o.op === 'limit');
          if (lim) rows = rows.slice(0, lim.args[0] as number);
          result = { data: head ? null : rows, count: counted ? rows.length : null, error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return builder;
  }

  const client = {
    from,
    auth: { getClaims: async () => ({ data: claims ? { claims } : null, error: null }) },
  } as unknown as SupabaseClient;
  return { client, calls };
}
