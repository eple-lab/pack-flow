/**
 * 변경 라우트 단위 시험용 가짜 Supabase — rpc 호출 기록 + items update · purchases select 체인.
 *
 * 하는 일
 * 1. rpc(fn, args)를 기록하고, 시험이 정한 응답({data} 또는 {error})을 돌려준다. 기록(rpcCalls)으로
 *    "래퍼가 p_… 인자 이름 · 값을 제대로 넘겼나", "rpc를 한 번도 안 불렀나"를 확인한다.
 * 2. from(table)은 select(칸) · update(값) · eq · maybeSingle 체인만 흉내 낸다(PATCH items, 구매 order_qty 조회용).
 *    select에 적은 칸만 돌려주므로 user_id를 요청하지 않으면 응답에도 없다.
 * 3. 시험 전용이다(*.test.ts가 아니라 시험으로 돌지 않는다). 서비스 키 · 실제 연결과 무관하다.
 *
 * 근거: docs/07-test-strategy.md, WU-41 4단계
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — rpc 기록 · update/maybeSingle 가짜 Supabase (WU-41)
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type Row = Record<string, unknown>;
export type RpcReply = { data?: unknown; error?: { message?: string; details?: string; code?: string } | null };
export type TableCall = { table: string; kind: 'select' | 'update'; columns: string; values?: Row; eq: Array<[string, unknown]> };

/**
 * @param options.rpc fn · args를 받아 응답을 돌려주는 함수(기본: `{ data: null }`)
 * @param options.tables 표 이름 → 행(update는 이 배열의 행을 실제로 바꾼다)
 * @param options.claims 로그인 상태(null이면 미로그인)
 * @param options.failTables 이 표를 읽으면 원문이 든 DB 오류를 돌려준다
 */
export function fakeRpcDb(
  options: {
    rpc?: (fn: string, args: Record<string, unknown>) => RpcReply;
    tables?: Record<string, Row[]>;
    claims?: { sub: string } | null;
    failTables?: string[];
  } = {},
) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const tableCalls: TableCall[] = [];
  const tables = options.tables ?? {};
  const claims = options.claims === undefined ? { sub: '00000000-0000-4000-8000-000000000001' } : options.claims;

  function from(table: string) {
    const call: TableCall = { table, kind: 'select', columns: '', eq: [] };
    const builder = {
      select(columns: string) {
        call.columns = columns;
        return builder;
      },
      update(values: Row) {
        call.kind = 'update';
        call.values = values;
        return builder;
      },
      eq(col: string, val: unknown) {
        call.eq.push([col, val]);
        return builder;
      },
      async maybeSingle() {
        tableCalls.push({ ...call, eq: [...call.eq] });
        if (options.failTables?.includes(table)) {
          return { data: null, error: { message: `원문 DB 오류 ${table} secret-detail`, code: 'XX000' } };
        }
        const row = (tables[table] ?? []).find((r) => call.eq.every(([c, v]) => r[c] === v));
        if (!row) return { data: null, error: null };
        if (call.kind === 'update') Object.assign(row, call.values);
        const picked: Row = {};
        for (const c of call.columns.split(',').map((x) => x.trim())) picked[c] = row[c];
        return { data: picked, error: null };
      },
    };
    return builder;
  }

  const client = {
    from,
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      rpcCalls.push({ fn, args });
      const reply = options.rpc?.(fn, args) ?? { data: null };
      return { data: reply.data ?? null, error: reply.error ?? null };
    },
    auth: { getClaims: async () => ({ data: claims ? { claims } : null, error: null }) },
  } as unknown as SupabaseClient;

  return { client, rpcCalls, tableCalls, tables };
}
