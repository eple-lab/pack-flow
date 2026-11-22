/**
 * 대시보드 요약 API 라우트.
 *
 * 하는 일
 * 1. 입력 스키마는 없다(조회만 한다).
 * 2. 지금은 stub이다: 501 PF_NOT_IMPLEMENTED. 실제 처리는 라우트 주인이 채운다.
 *
 * 근거: docs/04-api-contract.md 3.5 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/dashboard stub (WU-04)
 */
import { createHandler } from '@/lib/api/handler';
import { stubRun } from '@/lib/api/stub';

// GET /api/dashboard — 대시보드 요약. 오류: PF_NOT_IMPLEMENTED(501)
export const GET = createHandler({
  run: stubRun(),
});
