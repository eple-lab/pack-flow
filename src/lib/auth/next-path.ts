/**
 * 로그인 뒤 돌아갈 경로(`next`) 검사 — 같은 사이트의 경로만 허용한다(열린 리다이렉트 방지).
 *
 * 하는 일
 * 1. `/trades`, `/items?x=1`처럼 한 개의 `/`로 시작하는 경로만 통과시킨다.
 * 2. `//evil.example`(프로토콜 상대), 백슬래시, `https://…`, `javascript:…`, 제어문자 포함 값은
 *    모두 버리고 기본 경로(`/`)를 쓴다. `/login` 자신도 기본 경로로 바꿔 로그인 반복을 막는다.
 * 3. 최종 판정은 URL 파서로 한 번 더 한다(파서가 다른 호스트로 해석하면 거부).
 *
 * 근거: docs/04-api-contract.md 4.4(PF_UNAUTHENTICATED → /login?next=), docs/05-security.md, WU-03 5번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 열린 리다이렉트 방지 next 검사 (WU-03)
 */

const DEFAULT_PATH = '/';

/**
 * `next` 값을 안전한 같은 사이트 경로로 바꾼다.
 * @param value 쿼리에서 읽은 값(없거나 배열일 수 있다)
 * @returns 안전한 경로(`/`로 시작) — 위험하면 `/`
 */
export function safeNextPath(value: string | string[] | null | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || raw === '') return DEFAULT_PATH;
  if (raw.length > 500) return DEFAULT_PATH;
  if (!raw.startsWith('/') || raw.startsWith('//')) return DEFAULT_PATH;
  // 제어문자 · 줄바꿈 · 백슬래시는 브라우저가 슬래시로 바꿔 다른 호스트가 될 수 있다
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return DEFAULT_PATH;
  try {
    const parsed = new URL(raw, 'http://self.invalid');
    if (parsed.origin !== 'http://self.invalid') return DEFAULT_PATH;
    if (parsed.pathname === '/login' || parsed.pathname.startsWith('/login/')) return DEFAULT_PATH;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_PATH;
  }
}

/**
 * 미로그인 사용자를 보낼 `/login?next=<지금 경로>` 주소를 만든다(proxy가 쓴다). 홈(`/`)이면 next를 붙이지 않는다.
 * @param pathname 요청 경로
 * @param search `?a=b` 형태의 쿼리(없으면 빈 문자열)
 */
export function loginUrlFor(pathname: string, search = ''): string {
  const target = safeNextPath(`${pathname}${search}`);
  return target === DEFAULT_PATH ? '/login' : `/login?next=${encodeURIComponent(target)}`;
}
