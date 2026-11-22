/**
 * tests/db/helpers.ts 의 순수 시험 — DB · 환경변수 없이 돈다.
 *
 * 하는 일
 * 1. checkInvariants: 정상 스냅샷은 [], T-INV-1~4 각 위반이 규칙 번호와 대상 번호와 함께 잡히는지 본다.
 * 2. signIn: 환경변수가 비면 빠진 이름 전부를 적은 Error를 던지고, 값은 메시지에 없는지 본다.
 *
 * 근거: docs/03-data-model.md 6절 · docs/07-test-strategy.md · WU-08
 * 구역: eple (docs/06-work-plan.md 1절 '테스트 기반')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 불변식 검산 · 로그인 오류 시험 (WU-08)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkInvariants, signIn, type InvariantSnapshot } from './helpers';

/** 정상 스냅샷: PRD-001 재고 5 = 구매입고 10 - 실판매출고 5. P-101 입고완료, S-201 출고완료, P-102 · S-202는 기록 없음. */
function validSnapshot(): InvariantSnapshot {
  return {
    items: [{ sku_id: 'PRD-001', stock_qty: 5 }],
    stock_logs: [
      { sku_id: 'PRD-001', change_qty: 10, reason: '구매입고', ref_id: 'P-101' },
      { sku_id: 'PRD-001', change_qty: -5, reason: '실판매출고', ref_id: 'S-201' },
    ],
    purchases: [
      { purchase_id: 'P-101', status: '입고완료' },
      { purchase_id: 'P-102', status: '발주완료' },
    ],
    sales: [
      { sale_id: 'S-201', fulfillment_status: '출고완료' },
      { sale_id: 'S-202', fulfillment_status: '주문접수' },
    ],
  };
}

describe('T-DBH checkInvariants 불변식 검산', () => {
  it('T-DBH-1 정상 스냅샷은 위반 없이 []를 돌려준다', () => {
    expect(checkInvariants(validSnapshot())).toEqual([]);
  });

  it('T-DBH-2 T-INV-1: 재고와 이력 합이 다르면 규칙 번호와 품목 번호가 든 위반이 나온다', () => {
    const snap = validSnapshot();
    snap.items[0].stock_qty = 6; // 이력 합은 5
    const violations = checkInvariants(snap);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('T-INV-1');
    expect(violations[0]).toContain('PRD-001');
  });

  it('T-DBH-3 T-INV-2: 재고가 음수면 위반이 나온다(이력 합과 같을 때는 T-INV-1 위반이 없다)', () => {
    const snap: InvariantSnapshot = {
      items: [{ sku_id: 'PRD-009', stock_qty: -1 }],
      stock_logs: [{ sku_id: 'PRD-009', change_qty: -1, reason: '재고조정', ref_id: null }],
      purchases: [],
      sales: [],
    };
    const violations = checkInvariants(snap);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('T-INV-2');
    expect(violations[0]).toContain('PRD-009');
  });

  it('T-DBH-4 T-INV-3: 입고완료인데 구매입고 기록이 없으면 위반이 나온다', () => {
    const snap = validSnapshot();
    snap.stock_logs = snap.stock_logs.filter((log) => log.reason !== '구매입고');
    // 재고를 이력 합(-5)에 맞춰 T-INV-1은 피한다. 음수라 T-INV-2도 함께 잡히므로 T-INV-3 위반이 있는지만 본다.
    snap.items[0].stock_qty = -5;
    const violations = checkInvariants(snap);
    expect(violations.some((v) => v.includes('T-INV-3') && v.includes('P-101'))).toBe(true);
  });

  it('T-DBH-5 T-INV-3: 입고완료인데 구매입고 기록이 2개면 위반이 나온다', () => {
    const snap = validSnapshot();
    snap.stock_logs.push({ sku_id: 'PRD-001', change_qty: 10, reason: '구매입고', ref_id: 'P-101' });
    snap.items[0].stock_qty = 15; // 이력 합 = 15, T-INV-1은 맞춤
    const violations = checkInvariants(snap);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('T-INV-3');
    expect(violations[0]).toContain('P-101');
  });

  it('T-DBH-6 T-INV-3: 입고취소인데 입고취소 기록이 없으면 위반이 나온다', () => {
    const snap: InvariantSnapshot = {
      items: [{ sku_id: 'PRD-001', stock_qty: 10 }],
      stock_logs: [{ sku_id: 'PRD-001', change_qty: 10, reason: '구매입고', ref_id: 'P-101' }],
      purchases: [{ purchase_id: 'P-101', status: '입고취소' }],
      sales: [],
    };
    const violations = checkInvariants(snap);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('T-INV-3');
    expect(violations[0]).toContain('P-101');
  });

  it('T-DBH-7 T-INV-3: 발주완료인데 구매입고 기록이 있으면 위반이 나온다', () => {
    const snap: InvariantSnapshot = {
      items: [{ sku_id: 'PRD-001', stock_qty: 10 }],
      stock_logs: [{ sku_id: 'PRD-001', change_qty: 10, reason: '구매입고', ref_id: 'P-102' }],
      purchases: [{ purchase_id: 'P-102', status: '발주완료' }],
      sales: [],
    };
    const violations = checkInvariants(snap);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('T-INV-3');
    expect(violations[0]).toContain('P-102');
  });

  it('T-DBH-8 T-INV-4: 출고완료인데 실판매출고 기록이 없으면 위반이 나온다', () => {
    const snap: InvariantSnapshot = {
      items: [{ sku_id: 'PRD-001', stock_qty: 0 }],
      stock_logs: [],
      purchases: [],
      sales: [{ sale_id: 'S-201', fulfillment_status: '출고완료' }],
    };
    const violations = checkInvariants(snap);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('T-INV-4');
    expect(violations[0]).toContain('S-201');
  });

  it('T-DBH-9 T-INV-4: 출고취소인데 출고취소 기록이 없으면 위반이 나온다', () => {
    const snap: InvariantSnapshot = {
      items: [{ sku_id: 'PRD-001', stock_qty: 0 }],
      stock_logs: [
        { sku_id: 'PRD-001', change_qty: 5, reason: '재고조정', ref_id: null },
        { sku_id: 'PRD-001', change_qty: -5, reason: '실판매출고', ref_id: 'S-201' },
      ],
      purchases: [],
      sales: [{ sale_id: 'S-201', fulfillment_status: '출고취소' }],
    };
    const violations = checkInvariants(snap);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('T-INV-4');
    expect(violations[0]).toContain('S-201');
  });

  it('T-DBH-10 T-INV-4: 주문접수인데 실판매출고 기록이 있으면 위반이 나온다', () => {
    const snap: InvariantSnapshot = {
      items: [{ sku_id: 'PRD-001', stock_qty: 0 }],
      stock_logs: [
        { sku_id: 'PRD-001', change_qty: 5, reason: '재고조정', ref_id: null },
        { sku_id: 'PRD-001', change_qty: -5, reason: '실판매출고', ref_id: 'S-202' },
      ],
      purchases: [],
      sales: [{ sale_id: 'S-202', fulfillment_status: '주문접수' }],
    };
    const violations = checkInvariants(snap);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('T-INV-4');
    expect(violations[0]).toContain('S-202');
  });
});

describe('T-DBH signIn 환경변수 오류', () => {
  const NAMES = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'TEST_USER_A_EMAIL',
    'TEST_USER_A_PASSWORD',
  ] as const;

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('T-DBH-11 환경변수가 모두 비면 빠진 이름 네 개가 전부 적힌 Error를 던진다', async () => {
    // 빈 문자열로 명시해 두면 .env.local이 있어도 loadEnvFile이 덮어쓰지 않는다.
    for (const name of NAMES) vi.stubEnv(name, '');

    const error = await signIn('A').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    for (const name of NAMES) {
      expect(message).toContain(name);
    }
    expect(message).toContain('.env.local');
  });

  it('T-DBH-12 빠진 이름만 적히고, 채워진 값은 메시지에 들어가지 않는다', async () => {
    const FAKE_ANON = 'fake-anon-value-do-not-print';
    const FAKE_EMAIL = 'fake-a@packflow.test';
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fake-project.invalid');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', FAKE_ANON);
    vi.stubEnv('TEST_USER_A_EMAIL', FAKE_EMAIL);
    vi.stubEnv('TEST_USER_A_PASSWORD', '');

    const error = await signIn('A').catch((e: unknown) => e);
    const message = (error as Error).message;
    expect(message).toContain('TEST_USER_A_PASSWORD');
    expect(message).not.toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(message).not.toContain(FAKE_ANON);
    expect(message).not.toContain(FAKE_EMAIL);
    expect(message).not.toContain('fake-project.invalid');
  });
});
