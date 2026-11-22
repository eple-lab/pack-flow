/**
 * Playwright 설정 — E2E 시험(tests/e2e).
 *
 * 하는 일
 * 1. 대상 주소는 환경변수 E2E_BASE_URL, 비우면 http://localhost:3000. 서버는 직접 띄워 둔다(npm run dev 또는 배포 주소).
 * 2. 브라우저는 chromium 하나, 시험은 파일 안에서 순서대로(초기화 데이터가 서로 겹치지 않게 workers 1).
 * 3. 브라우저 설치(npx playwright install)는 각자 PC에서 따로 한다 — 이 파일은 설치하지 않는다.
 *
 * 근거: docs/07-test-strategy.md, docs/work-units/WU-00-skeleton.md WU-08 1번
 * 구역: eple (docs/06-work-plan.md 1절 '테스트 기반')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — E2E_BASE_URL · chromium · workers 1 (WU-08)
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // helpers.ts는 시험 파일이 아니다 — *.spec.ts만 시험으로 본다
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
