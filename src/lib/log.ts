/**
 * 서버 로그 함수 — 사건 이름과 숫자 · 코드만 남기고 비밀 · 개인정보 · 프롬프트 전문은 남기지 않는다.
 *
 * 하는 일
 * 1. log.info / warn / error(event, fields)가 JSON 한 줄을 console에 쓴다.
 * 2. 키 이름이 비밀 · 이메일 · 프롬프트 · 본문 계열이면 값을 [redacted]로 바꾼다(문자열은 길이만 남김).
 * 3. 그 밖의 문자열도 이메일 · 키 · 토큰 모양이면 가리고, 200자를 넘으면 자른다. 중첩은 3단계까지.
 * 4. 남겨도 되는 것: 오류 코드 · 상태 · 지연(ms) · 길이 · 건수 (WU-03 7번).
 *
 * 근거: docs/05-security.md 로그 규칙, AGENTS.md 3절, WU-03 7번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 가림 처리 로그 (WU-03)
 */

export type LogLevel = 'info' | 'warn' | 'error';

const MAX_STRING = 200;
const MAX_DEPTH = 3;

/** 이 이름이 키에 들어 있으면 값을 남기지 않는다. */
const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|api[-_]?key|authorization|cookie|session|credential|e[-_]?mail|prompt|messages?$|^body$|^text$|^content$|jwt/i;

/** 값이 이런 모양이면 키 이름과 상관없이 가린다. */
const VALUE_PATTERNS: Array<[RegExp, string]> = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(\.[A-Za-z0-9_-]*)?/g, '[jwt]'],
  [/sb_(secret|publishable)_[A-Za-z0-9_-]{10,}/g, '[key]'],
  [/AIza[0-9A-Za-z_-]{30,}/g, '[key]'],
  [/(ghp_|gho_|ghu_|ghs_|github_pat_)[A-Za-z0-9_]{16,}/g, '[key]'],
  [/sk-[A-Za-z0-9_-]{20,}/g, '[key]'],
  [/xox[abpr]-[A-Za-z0-9-]{10,}/g, '[key]'],
  [/AKIA[0-9A-Z]{16}/g, '[key]'],
  [/Bearer\s+[A-Za-z0-9._~+/=-]{10,}/gi, 'Bearer [key]'],
  // 길게 이어진 영숫자 · 기호 덩어리(키일 가능성) — 32자 이상
  [/[A-Za-z0-9_-]{32,}/g, '[key]'],
];

/**
 * 문자열에서 이메일 · 키 · 토큰 모양을 가리고 200자로 자른다.
 */
export function redactString(value: string): string {
  let out = value;
  for (const [pattern, replacement] of VALUE_PATTERNS) out = out.replace(pattern, replacement);
  return out.length > MAX_STRING ? `${out.slice(0, MAX_STRING)}…` : out;
}

/**
 * 로그에 넣을 값 하나를 안전하게 바꾼다. 숫자 · 불리언 · null은 그대로, 문자열은 가림, 객체는 키를 보고 가린다.
 * @param key 이 값의 키 이름(민감 키면 값 대신 길이만 남김)
 */
export function sanitizeValue(value: unknown, key = '', depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) {
    // promptLen · tokenCount 같은 "길이 · 건수" 숫자는 남긴다(WU-03: 길이 · 코드 · 지연만 남김)
    if (typeof value === 'number' && /(len|length|count|bytes|ms)$/i.test(key)) return value;
    if (typeof value === 'string') return `[redacted len=${value.length}]`;
    if (value === null || value === undefined) return value;
    return '[redacted]';
  }
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return redactString(value);
  if (value instanceof Error) return { name: value.name, message: redactString(value.message) };
  if (depth >= MAX_DEPTH) return '[nested]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeValue(v, key, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeValue(v, k, depth + 1);
    }
    return out;
  }
  return '[unsupported]';
}

/**
 * 로그 한 줄(JSON 문자열)을 만든다. 시각은 넣지 않는다(Render가 붙인다).
 */
export function formatLog(level: LogLevel, event: string, fields: Record<string, unknown> = {}): string {
  return JSON.stringify({
    level,
    event: redactString(event),
    ...(sanitizeValue(fields) as Record<string, unknown>),
  });
}

function write(level: LogLevel, event: string, fields?: Record<string, unknown>) {
  const line = formatLog(level, event, fields);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * 서버 로그. 예: `log.error('api.internal', { code: 'PF_INTERNAL', ms: 12, cause: err })`.
 * 부작용: console에 한 줄 출력. 키 · 비밀번호 · 이메일 · 프롬프트 전문은 넘기지 않는다(넘겨도 가려진다).
 */
export const log = {
  info: (event: string, fields?: Record<string, unknown>) => write('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write('error', event, fields),
};
