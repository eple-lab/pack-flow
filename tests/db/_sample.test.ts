/**
 * DB 시험 사용법 예시 — 로그인 → 초기화 → 품목 확인 → 불변식 검산 → 다른 계정 데이터 불변(T-AUTH-7).
 *
 * 하는 일
 * 1. beforeAll에서 계정 A · B로 로그인한다. 환경변수가 없으면 건너뛰지 않고 그대로 실패한다(의도다).
 *    빠진 변수 이름이 오류 메시지에 적힌다. 실패가 "건너뜀"으로 숨지 않게 하려는 것이다.
 * 2. 계정 A로 demo 시드를 넣고, 계정 B의 품목 수가 그대로인지 본다(T-AUTH-7).
 * 3. 두 계정 모두 불변식 검산(T-INV-1~4)을 통과해야 한다.
 *
 * sorek-charlie가 이 파일을 지워도 된다. 실제 시험은 같은 도우미를 쓰면 된다.
 * 실행: npx vitest run --project db tests/db/_sample.test.ts (.env.local 필요, P-17)
 *
 * 근거: docs/work-units/WU-00-skeleton.md WU-08 6번 · docs/07-test-strategy.md · docs/03-data-model.md 6절
 * 구역: eple (docs/06-work-plan.md 1절 '테스트 기반')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — DB 시험 사용법 예시 (WU-08)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { assertInvariants, resetAndSeed, signIn } from './helpers';

describe('T-DB-SAMPLE 로그인 · 초기화 · 검산 예시', () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;

  beforeAll(async () => {
    // 환경변수가 없으면 여기서 Error가 나고 시험이 실패한다. 건너뛰지 않는 것이 의도다.
    clientA = await signIn('A');
    clientB = await signIn('B');
  });

  it('T-DB-SAMPLE-1 A로 demo 초기화 후 A 품목 3개, B 품목 수 불변, 두 계정 불변식 통과', async () => {
    // 초기화 전 B의 품목 수를 기억한다(T-AUTH-7).
    const before = await clientB.from('items').select('sku_id', { count: 'exact', head: true });
    expect(before.error).toBeNull();
    const countBBefore = before.count ?? 0;

    const counts = await resetAndSeed(clientA, 'demo');
    expect(counts).toEqual({ items: 3, purchases: 1, sales: 2, logs: 3 });

    const itemsA = await clientA.from('items').select('sku_id');
    expect(itemsA.error).toBeNull();
    expect((itemsA.data ?? []).map((row) => row.sku_id).sort()).toEqual(['PRD-001', 'PRD-002', 'PRD-003']);

    // 계정 B의 데이터는 A의 초기화로 바뀌지 않아야 한다.
    const after = await clientB.from('items').select('sku_id', { count: 'exact', head: true });
    expect(after.error).toBeNull();
    expect(after.count ?? 0).toBe(countBBefore);

    // 불변식 검산(위반이 있으면 여기서 실패하고 위반 목록이 메시지에 나온다).
    await assertInvariants(clientA);
    await assertInvariants(clientB);
  });
});
