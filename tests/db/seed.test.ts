/**
 * 시드 초기화 뒤 재고 원장과 품목별 정답을 검증한다 (WU-22).
 * 구역: sorek-charlie
 * 2026-11-23  sorek-charlie  처음 작성 (WU-22)
 */
import { expect, it } from 'vitest';
import { parseSeed } from '@/lib/seed';
import demo from '@/lib/seed/demo.json';
import small from '@/lib/seed/small.json';
import large from '@/lib/seed/large.json';
import { assertInvariants, resetAndSeed, signIn } from './helpers';

it.each([['demo', demo], ['small', small], ['large', large]] as const)(
  'T-S4-1 %s 시드의 재고·원장이 정답과 일치한다',
  async (name, fixture) => {
    const seed = parseSeed(fixture, name);
    const expected = seed.expected;
    if (!expected?.stock || !expected.kpi) throw new Error(`${name}: expected 정답표가 필요합니다`);

    const client = await signIn('A');
    const result = await resetAndSeed(client, seed);
    expect(result.items).toBe(seed.items.length);
    if (name === 'small') expect(result.logs).toBe(20);
    if (name === 'large') expect(result.logs).toBe(50);
    await assertInvariants(client);

    const { data, error } = await client.from('items').select('sku_id, stock_qty');
    expect(error).toBeNull();
    expect(Object.fromEntries((data ?? []).map((row) => [row.sku_id, row.stock_qty]))).toEqual(expected.stock);
  },
);
