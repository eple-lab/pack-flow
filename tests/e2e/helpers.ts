/**
 * E2E(Playwright) 도우미 — 화면으로 로그인하고, API로 시드를 넣는다.
 *
 * 하는 일
 * 1. loginViaUi: /login 화면에서 테스트 계정 A 또는 B로 로그인한다(data-testid는 WU-07 · 화면 문서 기준).
 * 2. resetViaApi: 로그인된 세션으로 POST /api/seed를 부른다(X-PF · Origin을 붙인다, CSRF 규칙).
 * 3. 주소는 E2E_BASE_URL(없으면 http://localhost:3000)을 쓴다. playwright.config의 baseURL에 기대지 않는다.
 *
 * 근거: docs/work-units/WU-00-skeleton.md WU-08 3번 · docs/04-api-contract.md · docs/05-security.md(CSRF)
 * 구역: eple (docs/06-work-plan.md 1절 '테스트 기반')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 화면 로그인 · API 초기화 도우미 (WU-08)
 */
import type { Page } from '@playwright/test';
import type { SeedDataset, SeedResult } from '@/types/erp';

/** E2E 대상 주소. 비어 있으면 로컬 개발 서버. */
function baseUrl(): string {
  return process.env.E2E_BASE_URL?.trim() || 'http://localhost:3000';
}

/**
 * 테스트 계정 A 또는 B로 화면 로그인을 한다. 로그인 화면을 벗어나면 성공으로 본다.
 * 던지는 오류: Error — TEST_USER_<X>_EMAIL · _PASSWORD 중 빠진 이름을 적는다(값은 없음).
 */
export async function loginViaUi(page: Page, which: 'A' | 'B'): Promise<void> {
  const emailName = `TEST_USER_${which}_EMAIL`;
  const passwordName = `TEST_USER_${which}_PASSWORD`;
  const missing = [emailName, passwordName].filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`환경변수가 비어 있습니다: ${missing.join(', ')}. .env.local을 채우세요(.env.example 참고).`);
  }

  // 절대 주소로 간다(playwright.config의 baseURL과 같은 E2E_BASE_URL 규칙).
  await page.goto(new URL('/login', baseUrl()).toString());
  await page.getByTestId('login-email').fill(process.env[emailName]!.trim());
  await page.getByTestId('login-password').fill(process.env[passwordName]!);
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/**
 * 로그인된 세션으로 POST /api/seed를 불러 데이터를 초기화한다. 성공하면 건수 결과를 돌려준다.
 * 던지는 오류: Error — 상태 코드와 응답의 error.code만 담는다(원문 본문은 싣지 않는다).
 * 주석: page가 아직 about:blank면 Origin을 E2E_BASE_URL로 맞춘다(같은 출처여야 CSRF 검사를 통과한다).
 */
export async function resetViaApi(page: Page, dataset: SeedDataset): Promise<SeedResult> {
  const current = page.url();
  const origin = current && current !== 'about:blank' ? new URL(current).origin : new URL(baseUrl()).origin;

  const response = await page.request.post(new URL('/api/seed', origin).toString(), {
    headers: { 'X-PF': '1', Origin: origin },
    data: { dataset },
  });

  if (!response.ok()) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: unknown } } | null;
    const code = typeof body?.error?.code === 'string' ? body.error.code : 'unknown';
    throw new Error(`초기화 API 실패 (HTTP ${response.status()}, ${code})`);
  }

  const body = (await response.json()) as { data: SeedResult };
  return body.data;
}
