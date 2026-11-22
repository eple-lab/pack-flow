/**
 * CSRF 방어 — GET 외 요청은 `X-PF: 1` 헤더와 같은 사이트 Origin이 있어야 한다.
 *
 * 하는 일
 * 1. GET · HEAD · OPTIONS는 통과시킨다(상태를 바꾸지 않는다).
 * 2. 그 밖의 메서드는 `X-PF` 값이 정확히 "1"이고, `Origin` 헤더의 호스트가 이 서버의 호스트와 같을 때만 통과.
 *    Origin이 없어도 거부한다(브라우저는 POST에 Origin을 붙인다 — 다른 사이트의 form 전송을 막는 핵심).
 * 3. 서버의 호스트는 배포 프록시(Render)를 고려해 `x-forwarded-host` → `host` → 요청 URL 순서로 모은 것 전부와 비교한다.
 *    (브라우저는 다른 사이트에서 이 헤더들을 바꿀 수 없다.)
 *
 * 근거: docs/04-api-contract.md 1절 · P-18, docs/05-security.md, WU-03 4번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — X-PF · Origin 검사 (WU-03)
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/**
 * 변경 요청이 같은 사이트에서 왔는지 검사한다.
 * @returns 통과면 true, 막아야 하면 false (호출한 쪽이 403 PF_CSRF로 바꾼다)
 */
export function checkCsrf(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  if (request.headers.get('x-pf') !== '1') return false;

  const originHost = hostOf(request.headers.get('origin'));
  if (!originHost) return false;

  const own = new Set<string>();
  const forwarded = request.headers.get('x-forwarded-host');
  if (forwarded) for (const h of forwarded.split(',')) own.add(h.trim());
  const host = request.headers.get('host');
  if (host) own.add(host.trim());
  const urlHost = hostOf(request.url);
  if (urlHost) own.add(urlHost);

  return own.has(originHost);
}
