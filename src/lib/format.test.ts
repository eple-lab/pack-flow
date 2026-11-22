/**
 * format.ts 단위 테스트 — 쉼표 · 증감 부호 · 빈 값 · 한국 시간 날짜(자정 경계) · 계정 가리기.
 *
 * 하는 일: 04 4.5 · 4.6의 표기 기대를 먼저 적고 비교한다.
 *
 * 근거: docs/04-api-contract.md 4.5 · 4.6, WU-05 (F 기준)
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 표시 서식 시험 (WU-05)
 */
import { describe, expect, it } from 'vitest';
import {
  EMPTY_MARK,
  formatDateTime,
  formatDateTimeFull,
  formatEmpty,
  formatKstDate,
  formatNumber,
  formatSigned,
  maskEmail,
  searchEmptyMessage,
} from './format';

describe('F: formatNumber', () => {
  it.each([
    [0, '0'],
    [1, '1'],
    [999, '999'],
    [1000, '1,000'],
    [12000, '12,000'],
    [1_000_000_000, '1,000,000,000'],
    [-6, '−6'],
    [-1500, '−1,500'],
  ])('F-1 %d → %s', (input, expected) => {
    expect(formatNumber(input)).toBe(expected);
  });

  it('F-2 null · undefined · NaN · Infinity는 —', () => {
    for (const v of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) expect(formatNumber(v)).toBe(EMPTY_MARK);
  });
});

describe('F: formatSigned (증감)', () => {
  it('F-3 양수는 +, 음수는 유니코드 마이너스(−, U+2212), 0은 0', () => {
    expect(formatSigned(8)).toBe('+8');
    expect(formatSigned(-6)).toBe('−6');
    expect(formatSigned(0)).toBe('0');
    expect(formatSigned(1500)).toBe('+1,500');
    expect(formatSigned(-1500)).toBe('−1,500');
  });
  it('F-4 마이너스는 하이픈(-)이 아니다', () => {
    expect(formatSigned(-6)).not.toContain('-');
    expect(formatSigned(-6).charCodeAt(0)).toBe(0x2212);
  });
  it('F-5 숫자가 아니면 —', () => {
    expect(formatSigned(null)).toBe('—');
    expect(formatSigned(undefined)).toBe('—');
  });
});

describe('F: formatEmpty (04 4.5)', () => {
  it('F-6 null · undefined · 빈 글자 · 공백은 —', () => {
    for (const v of [null, undefined, '', '   ']) expect(formatEmpty(v)).toBe('—');
  });
  it('F-7 값이 있으면 그대로(0도 값이다)', () => {
    expect(formatEmpty('INV-1')).toBe('INV-1');
    expect(formatEmpty(0)).toBe('0');
  });
});

describe('F: 한국 시간 날짜', () => {
  it('F-8 자정 경계: UTC 14:59:59는 그날, 15:00:00은 다음 날', () => {
    expect(formatKstDate('2026-11-23T14:59:59Z')).toBe('2026-11-23');
    expect(formatKstDate('2026-11-23T15:00:00Z')).toBe('2026-11-24');
  });
  it('F-9 연말 경계', () => {
    expect(formatKstDate('2026-12-31T15:00:00Z')).toBe('2027-01-01');
  });
  it('F-10 잘못된 값 · 빈 값은 —', () => {
    for (const v of ['not a date', '', null, undefined]) expect(formatKstDate(v)).toBe('—');
    expect(formatDateTime('x')).toBe('—');
    expect(formatDateTimeFull(null)).toBe('—');
  });
});

describe('F: 목록 시각 · 전체 시각', () => {
  const now = new Date('2026-11-23T03:00:00Z');
  it('F-11 올해는 `11/24 14:05` (UTC 05:05 → 한국 14:05)', () => {
    expect(formatDateTime('2026-11-24T05:05:09Z', now)).toBe('11/24 14:05');
  });
  it('F-12 올해가 아니면 `2025-11-24`', () => {
    expect(formatDateTime('2025-11-24T05:05:09Z', now)).toBe('2025-11-24');
  });
  it('F-13 올해 판정도 한국 시간 기준: 12-31 15:00Z(한국 1/1)는 다음 해', () => {
    expect(formatDateTime('2026-12-31T15:00:00Z', new Date('2026-06-01T00:00:00Z'))).toBe('2027-01-01');
    expect(formatDateTime('2026-12-31T14:59:59Z', new Date('2026-06-01T00:00:00Z'))).toBe('12/31 23:59');
  });
  it('F-14 전체 시각 `2026-11-24 14:05:09`', () => {
    expect(formatDateTimeFull('2026-11-24T05:05:09Z')).toBe('2026-11-24 14:05:09');
  });
  it('F-15 한국 자정 경계의 시각 표시: 15:00:00Z는 00:00', () => {
    expect(formatDateTime('2026-11-23T15:00:00Z', now)).toBe('11/24 00:00');
    expect(formatDateTimeFull('2026-11-23T14:59:59Z')).toBe('2026-11-23 23:59:59');
  });
});

describe('F: maskEmail · searchEmptyMessage', () => {
  it('F-16 계정은 앞 2글자만', () => {
    expect(maskEmail('a-a@packflow.test')).toBe('a-…');
    expect(maskEmail('abcdef@packflow.test')).toBe('ab…');
    expect(maskEmail('a@packflow.test')).toBe('a…');
  });
  it('F-17 빈 값은 —', () => {
    for (const v of [null, undefined, '', '@packflow.test']) expect(maskEmail(v)).toBe('—');
  });
  it('F-18 검색 결과 없음 문구(04 4.5)', () => {
    expect(searchEmptyMessage(' 마우스 ')).toBe("'마우스'에 맞는 품목이 없어요");
  });
});
