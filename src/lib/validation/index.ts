/**
 * 입력 검증 진입점 — 화면 · 서버가 `@/lib/validation`만 가져다 쓰게 모은다.
 *
 * 근거: docs/04-api-contract.md 4절 · WU-03 8번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 재내보내기 (WU-03)
 */
export * from './detail';
export * from './fields';
export * from './schemas';
