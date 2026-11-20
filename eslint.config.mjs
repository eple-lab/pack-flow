/**
 * ESLint 설정 (Next 기본 + 팀 규칙 두 가지).
 *
 * 하는 일
 * 1. Next.js 권장 규칙(core-web-vitals · typescript)을 쓴다.
 * 2. 브라우저 기본 alert · confirm · prompt 금지 (no-alert) — 공통 조각을 쓴다(AGENTS.md 3절, D-24).
 * 3. dangerouslySetInnerHTML 금지 (react/no-danger) — LLM 응답 · 사용자 입력은 글자로만(05 4절).
 *
 * 근거: WU-01 · AGENTS.md 3절
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  처음 작성 — Next 기본 + no-alert · no-danger (WU-01)
 */
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'no-alert': 'error',
      'react/no-danger': 'error',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
  ]),
]);

export default eslintConfig;
