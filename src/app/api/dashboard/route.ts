/**
 * 대시보드 요약 API 라우트.
 *
 * 하는 일
 * 1. 입력 스키마는 없다(조회만 한다).
 * 2. getDashboard(src/lib/queries/dashboard.ts)가 KPI · 파이프라인 · 품절 임박 · 최근 변동을 만든다.
 *
 * 근거: docs/04-api-contract.md 3.5 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/dashboard stub (WU-04)
 * 2026-11-23  eple  stub → 실제 조회 (WU-41)
 */
import { createHandler } from '@/lib/api/handler';
import { getDashboard } from '@/lib/queries/dashboard';

// GET /api/dashboard — 대시보드 요약. 오류: PF_UNAUTHENTICATED(401) · PF_INTERNAL(500)
export const GET = createHandler({
  run: async ({ supabase }) => ({ data: await getDashboard(supabase) }),
});
