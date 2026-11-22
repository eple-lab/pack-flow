/**
 * 시연 데이터 적재 API 라우트.
 *
 * 하는 일
 * 1. 본문(dataset)은 seedRequest 스키마로 검사한다(잘못되면 400 PF_VALIDATION).
 * 2. 지금은 stub이다: 501 PF_NOT_IMPLEMENTED. 실제 처리는 라우트 주인이 채운다.
 *
 * 근거: docs/04-api-contract.md 3.7 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/seed stub (WU-04)
 */
import { createHandler } from '@/lib/api/handler';
import { stubRun } from '@/lib/api/stub';
import { seedRequest } from '@/lib/validation/schemas';

// POST /api/seed — 시연 데이터 적재. 오류: PF_VALIDATION(400) · PF_NOT_IMPLEMENTED(501)
export const POST = createHandler({
  schema: seedRequest,
  run: stubRun(),
});
