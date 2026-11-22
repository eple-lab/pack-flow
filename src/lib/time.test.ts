/**
 * time.ts 단위 테스트 — 한국 시간 자정 경계(UTC 14:59:59 / 15:00:00).
 *
 * 하는 일: 기대(한국 날짜 · 범위)를 먼저 적고 todayRangeKst 결과와 비교한다.
 *
 * 근거: docs/03-data-model.md 2절, WU-03 7번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 자정 경계 시험 (WU-03)
 */
import { describe, expect, it } from 'vitest';
import { isTodayKst, kstDateString, startOfKstDay, todayRangeKst } from './time';

describe('T: time — 한국 시간 오늘', () => {
  it('T-1 UTC 14:59:59는 한국 23:59:59 — 아직 11-23', () => {
    const r = todayRangeKst(new Date('2026-11-23T14:59:59Z'));
    expect(r.date).toBe('2026-11-23');
    expect(r.startIso).toBe('2026-11-22T15:00:00.000Z');
    expect(r.endIso).toBe('2026-11-23T15:00:00.000Z');
  });

  it('T-2 UTC 15:00:00은 한국 00:00:00 — 11-24가 시작된다', () => {
    const r = todayRangeKst(new Date('2026-11-23T15:00:00Z'));
    expect(r.date).toBe('2026-11-24');
    expect(r.startIso).toBe('2026-11-23T15:00:00.000Z');
    expect(r.endIso).toBe('2026-11-24T15:00:00.000Z');
  });

  it('T-3 UTC 자정(한국 09:00)은 같은 날짜, 범위는 전날 15:00Z부터', () => {
    const r = todayRangeKst(new Date('2026-11-23T00:00:00Z'));
    expect(r.date).toBe('2026-11-23');
    expect(r.startIso).toBe('2026-11-22T15:00:00.000Z');
  });

  it('T-4 하루 길이는 정확히 24시간(일광절약 없음)', () => {
    const r = todayRangeKst(new Date('2026-03-08T10:00:00Z'));
    expect(r.end.getTime() - r.start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('T-5 월 · 연 경계: 12-31 23:59:59 KST → 다음 해 1-1', () => {
    expect(kstDateString(new Date('2026-12-31T14:59:59Z'))).toBe('2026-12-31');
    expect(kstDateString(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01');
    expect(kstDateString(new Date('2028-02-28T15:00:00Z'))).toBe('2028-02-29'); // 윤년
  });

  it('T-6 start는 포함, end는 미포함', () => {
    const now = new Date('2026-11-23T05:00:00Z');
    const { start, end } = todayRangeKst(now);
    expect(isTodayKst(start, now)).toBe(true);
    expect(isTodayKst(new Date(start.getTime() - 1), now)).toBe(false);
    expect(isTodayKst(new Date(end.getTime() - 1), now)).toBe(true);
    expect(isTodayKst(end, now)).toBe(false);
  });

  it('T-7 isTodayKst: ISO 문자열 · 잘못된 값', () => {
    const now = new Date('2026-11-23T05:00:00Z');
    expect(isTodayKst('2026-11-23T14:59:59Z', now)).toBe(true);
    expect(isTodayKst('2026-11-23T15:00:00Z', now)).toBe(false);
    expect(isTodayKst('not a date', now)).toBe(false);
  });

  it('T-8 startOfKstDay는 시각을 안 주면 지금 기준(범위 안)', () => {
    const before = Date.now();
    const s = startOfKstDay();
    expect(s.getTime()).toBeLessThanOrEqual(before);
    expect(before - s.getTime()).toBeLessThan(24 * 60 * 60 * 1000);
    expect(todayRangeKst().date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
