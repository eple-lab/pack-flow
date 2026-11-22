/**
 * 화면 표시 서식 — 천 단위 쉼표, 증감 부호, 한국 시간 날짜 · 시각, 빈 값, 계정 가리기.
 *
 * 하는 일
 * 1. 숫자 `12,000`, 증감 `+8` · `−6`(유니코드 마이너스 U+2212), 0은 `0`(04 4.6).
 * 2. 시각은 한국 시간(Asia/Seoul, UTC+9 고정). 목록 `11/24 14:05`, 올해가 아니면 `2025-11-24`, 마우스를 올리면 전체 `2026-11-24 14:05:09`.
 * 3. 빈 값(null · undefined · 빈 문자열)은 `—`(04 4.5). 잘못된 날짜도 `—`.
 * 4. 화면은 숫자를 계산하지 않고 API 값을 그대로 보인다 — 여기는 보여 주는 모양만 만든다(T-S1-3).
 *
 * 근거: docs/04-api-contract.md 4.5 · 4.6, docs/wireframes.html 2절(계정 가리기), WU-05 2번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 표시 서식 (WU-05)
 */
import { kstDateString } from './time';

/** 빈 값을 보이는 글자(04 4.5). */
export const EMPTY_MARK = '—';

/** 증감에 쓰는 마이너스 기호(하이픈이 아니라 U+2212). */
const MINUS = '−';

/**
 * 천 단위 쉼표 숫자. 12000 → "12,000". 숫자가 아니면 `—`.
 */
export function formatNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY_MARK;
  return value.toLocaleString('en-US', { maximumFractionDigits: 20 }).replace('-', MINUS);
}

/**
 * 증감 표시. 8 → "+8", −6 → "−6"(U+2212), 0 → "0".
 */
export function formatSigned(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY_MARK;
  if (value > 0) return `+${formatNumber(value)}`;
  return formatNumber(value);
}

/**
 * 빈 값 표시. null · undefined · 공백뿐인 글자는 `—`, 그 밖은 글자로.
 */
export function formatEmpty(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY_MARK;
  const text = String(value);
  return text.trim() === '' ? EMPTY_MARK : text;
}

/** 한국 시간 각 칸(연 · 월 · 일 · 시 · 분 · 초)을 두 자리 글자로. 잘못된 값이면 null. */
function kstParts(value: string | Date | null | undefined) {
  if (value === null || value === undefined) return null;
  const time = (value instanceof Date ? value : new Date(value)).getTime();
  if (Number.isNaN(time)) return null;
  const iso = new Date(time + 9 * 60 * 60 * 1000).toISOString(); // 2026-11-24T14:05:09.000Z (한국 시계 값)
  return {
    year: iso.slice(0, 4),
    month: iso.slice(5, 7),
    day: iso.slice(8, 10),
    hour: iso.slice(11, 13),
    minute: iso.slice(14, 16),
    second: iso.slice(17, 19),
  };
}

/**
 * 한국 시간 날짜 'YYYY-MM-DD'. UTC 14:59:59 → 그날, 15:00:00 → 다음 날.
 */
export function formatKstDate(value: string | Date | null | undefined): string {
  return kstParts(value) ? kstDateString(value instanceof Date ? value : new Date(value as string)) : EMPTY_MARK;
}

/**
 * 목록용 시각. 올해면 `11/24 14:05`, 올해가 아니면 `2025-11-24`.
 * @param now 기준 시각(올해 판정용, 기본 지금) — 시험에서 고정값을 넣는다
 */
export function formatDateTime(value: string | Date | null | undefined, now: Date = new Date()): string {
  const parts = kstParts(value);
  if (!parts) return EMPTY_MARK;
  const thisYear = kstParts(now)?.year;
  if (parts.year !== thisYear) return `${parts.year}-${parts.month}-${parts.day}`;
  return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

/**
 * 전체 시각 `2026-11-24 14:05:09`(마우스를 올렸을 때 보이는 title 값).
 */
export function formatDateTimeFull(value: string | Date | null | undefined): string {
  const parts = kstParts(value);
  if (!parts) return EMPTY_MARK;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * 계정 표시를 가린다(화면 녹화 · 캡처 대비): 앞 2글자만 보이고 나머지는 `…`. 빈 값이면 `—`.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return EMPTY_MARK;
  const local = email.split('@')[0] ?? '';
  if (local === '') return EMPTY_MARK;
  return `${Array.from(local).slice(0, 2).join('')}…`;
}

/**
 * 검색 결과가 없을 때의 문구(04 4.5): `'{검색어}'에 맞는 품목이 없어요`.
 */
export function searchEmptyMessage(query: string): string {
  return `'${query.trim()}'에 맞는 품목이 없어요`;
}
