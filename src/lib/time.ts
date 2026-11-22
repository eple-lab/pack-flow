/**
 * 한국 시간(Asia/Seoul) 기준 '오늘' 계산.
 *
 * 하는 일
 * 1. 한국은 일광절약시간이 없어 UTC+9 고정이다. 날짜 경계를 Intl 없이 산술로 구해 서버 · 테스트 어디서나 같다.
 * 2. todayRangeKst(): 오늘 00:00(포함) ~ 내일 00:00(미포함)을 돌려준다. 대시보드 today_in · today_out과
 *    pf_llm_take의 '오늘'(03 2절)이 같은 날 경계를 쓰게 하려는 것이다.
 * 3. 화면 표시용 서식(11/24 14:05)은 src/lib/format.ts가 맡는다. 여기는 경계 계산만 한다.
 *
 * 근거: docs/03-data-model.md 2절, docs/04-api-contract.md 1절 · 4.6, WU-03 7번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 한국 시간 오늘 범위 · 날짜 문자열 (WU-03)
 */

/** 한국 시간대 이름(DB의 `at time zone` 값과 같다). */
export const KST_TIME_ZONE = 'Asia/Seoul';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 한국 시간 하루의 경계. start 포함, end 미포함. */
export type KstRange = {
  /** 'YYYY-MM-DD' (한국 날짜) */
  date: string;
  start: Date;
  end: Date;
  /** ISO 8601(UTC, Z) — API 쿼리 · DB 비교용 */
  startIso: string;
  endIso: string;
};

/**
 * 주어진 시각이 속한 한국 날짜의 시작(00:00 KST)을 구한다.
 * @param now 기준 시각(기본: 지금)
 */
export function startOfKstDay(now: Date = new Date()): Date {
  const shifted = now.getTime() + KST_OFFSET_MS;
  const dayStartShifted = Math.floor(shifted / DAY_MS) * DAY_MS;
  return new Date(dayStartShifted - KST_OFFSET_MS);
}

/**
 * 한국 날짜 문자열 'YYYY-MM-DD'.
 * @param now 기준 시각(기본: 지금)
 */
export function kstDateString(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 한국 시간 '오늘'의 범위. 14:59:59Z(23:59:59 KST)는 아직 그날, 15:00:00Z(00:00:00 KST)부터 다음 날이다.
 * @param now 기준 시각(기본: 지금) — 테스트에서 고정값을 넣는다
 */
export function todayRangeKst(now: Date = new Date()): KstRange {
  const start = startOfKstDay(now);
  const end = new Date(start.getTime() + DAY_MS);
  return { date: kstDateString(now), start, end, startIso: start.toISOString(), endIso: end.toISOString() };
}

/**
 * 어떤 시각이 한국 시간 '오늘'에 속하는가.
 * @param value ISO 문자열 또는 Date
 */
export function isTodayKst(value: string | Date, now: Date = new Date()): boolean {
  const t = (value instanceof Date ? value : new Date(value)).getTime();
  if (Number.isNaN(t)) return false;
  const { start, end } = todayRangeKst(now);
  return t >= start.getTime() && t < end.getTime();
}
