/**
 * T-AUTH-4~6 RLS 시험 — 화면 · API를 거치지 않고 사용자 JWT로 Supabase REST(PostgREST)를 직접 부른다.
 *
 * 하는 일
 * 1. 테스트 계정 A · B로 로그인한 supabase-js 클라이언트(= REST 호출)로 테이블을 직접 읽고 쓴다.
 * 2. "화면 숨김이 아니라 DB가 직접 막는다"(05 3절)의 증거다. 서비스 키는 쓰지 않는다.
 * 3. A · B 둘 다 demo 시드로 시작하고 끝낸다.
 *
 * 기대(먼저 적음)
 * - T-AUTH-4 B의 JWT로 items · purchases · sales · stock_logs 전체 select → 모든 행의 user_id가 B, A의 행 id는 하나도 없다
 * - T-AUTH-5 B가 자기 품목에 update stock_qty = 999 → 권한 오류(열 권한에 stock_qty 없음), 재고 그대로.
 *            (덧붙임) user_id를 A로 바꾸는 update도 권한 오류
 * - T-AUTH-6 B가 delete from stock_logs → 권한 오류 또는 0행, 이력 건수 그대로. items · purchases · sales delete도 같다
 * - (덧붙임) B가 items에 직접 insert → 권한 오류(등록은 pf_create_item만)
 *
 * 근거: docs/05-security.md 3절 T-AUTH-4~6, supabase/migrations/20261120100400_rls.sql
 * 구역: eple (docs/06-work-plan.md 1절 'API 테스트')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — T-AUTH-4 · 5 · 6 (WU-42)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetAndSeed, signIn } from '../db/helpers';

const TABLES = ['items', 'purchases', 'sales', 'stock_logs'] as const;

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let userB: string;

async function countB(table: (typeof TABLES)[number]) {
  const { count, error } = await clientB.from(table).select('*', { count: 'exact', head: true });
  expect(error).toBeNull();
  return count ?? 0;
}

beforeAll(async () => {
  clientA = await signIn('A');
  clientB = await signIn('B');
  await resetAndSeed(clientA, 'demo');
  await resetAndSeed(clientB, 'demo');
  const { data } = await clientB.auth.getUser();
  userB = data.user!.id;
});

afterAll(async () => {
  await resetAndSeed(clientA, 'demo');
  await resetAndSeed(clientB, 'demo');
});

describe('T-AUTH RLS (Supabase REST 직접, 실제 dev DB)', () => {
  it('T-AUTH-4 B의 JWT로 네 테이블 전체 select → B의 행만, A의 행 id 없음', async () => {
    for (const table of TABLES) {
      const idColumn = table === 'stock_logs' ? 'log_id' : 'id';
      const [b, a] = await Promise.all([
        clientB.from(table).select(`${idColumn}, user_id`),
        clientA.from(table).select(idColumn),
      ]);
      expect(b.error).toBeNull();
      expect(a.error).toBeNull();
      const bRows = (b.data ?? []) as unknown as Record<string, unknown>[];
      const aIds = new Set(((a.data ?? []) as unknown as Record<string, unknown>[]).map((r) => r[idColumn]));
      expect(bRows.length).toBeGreaterThan(0);
      expect(bRows.every((r) => r.user_id === userB)).toBe(true);
      expect(bRows.filter((r) => aIds.has(r[idColumn]))).toEqual([]);
    }
  });

  it('T-AUTH-5 B가 REST로 stock_qty = 999 update → 권한 오류, 재고 그대로 (user_id 바꾸기도 거부)', async () => {
    const read = () => clientB.from('items').select('stock_qty').eq('sku_id', 'PRD-001').single();
    const before = await read();
    expect(before.error).toBeNull();

    const stock = await clientB.from('items').update({ stock_qty: 999 }).eq('sku_id', 'PRD-001').select();
    expect(stock.error).not.toBeNull();

    const { data: aUser } = await clientA.auth.getUser();
    const owner = await clientB.from('items').update({ user_id: aUser.user!.id }).eq('sku_id', 'PRD-001').select();
    expect(owner.error).not.toBeNull();

    const after = await read();
    expect(after.data).toEqual(before.data);
  });

  it('T-AUTH-6 B가 REST로 delete → 권한 오류 또는 0행, 네 테이블 건수 그대로', async () => {
    for (const table of TABLES) {
      const before = await countB(table);
      const idColumn = table === 'stock_logs' ? 'log_id' : 'id';
      const res = await clientB.from(table).delete().not(idColumn, 'is', null).select();
      // 권한 오류이거나, 오류가 없다면 지워진 행이 0이어야 한다
      if (!res.error) expect(res.data ?? []).toEqual([]);
      expect(await countB(table)).toBe(before);
    }
  });

  it('T-AUTH-6b B가 REST로 items에 직접 insert → 권한 오류 (등록은 pf_create_item만)', async () => {
    const before = await countB('items');
    const res = await clientB
      .from('items')
      .insert({ user_id: userB, sku_id: 'RAW-001', item_name: '직접 넣기', unit_cost: 1, sale_price: 1, safety_stock: 0 })
      .select();
    expect(res.error).not.toBeNull();
    expect(await countB('items')).toBe(before);
  });
});
