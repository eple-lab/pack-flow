/**
 * Vitest 설정 — 테스트를 unit · db 두 묶음으로 나눈다.
 *
 * 하는 일
 * 1. unit: DB 없이 도는 테스트. 각 구역 파일 옆 *.test.ts. Actions에서도 돈다(P-11).
 * 2. db: tests/db/** — .env.local의 dev 프로젝트와 본인 테스트 계정이 필요하다(P-17). 로컬에서만.
 * 3. 경로 별칭 @/ → src/ 를 tsconfig와 같게 맞춘다.
 *
 * 근거: docs/07-test-strategy.md 1절 · WU-01 · WU-08
 * 구역: eple (docs/06-work-plan.md 1절 '테스트 기반')
 *
 * 이력
 * 2026-11-20  eple  처음 작성 — unit · db 두 프로젝트 (WU-01)
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    // 골격 단계에서 테스트가 하나도 없을 때 test:unit이 실패하지 않게 한다. 테스트가 생기면 영향 없음.
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          include: ['tests/db/**/*.test.ts'],
          environment: 'node',
          // DB 테스트는 계정 데이터를 초기화하므로 파일끼리 동시에 돌리지 않는다.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
