/**
 * 입고 취소 API 라우트.
 *
 * 하는 일
 * 1. 경로의 id는 uuid 형식을 검사한다(틀리면 400 PF_VALIDATION, field "id").
 * 2. 본문 스키마는 없다. 취소는 반대 기록을 추가하는 방식이다(원칙 2).
 * 3. 지금은 stub이다: 501 PF_NOT_IMPLEMENTED. 실제 처리는 라우트 주인이 채운다.
 *
 * 근거: docs/04-api-contract.md 3.3 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/purchases/[id]/cancel-receipt stub (WU-04)
 */
import { createHandler } from '@/lib/api/handler';
import { stubRun } from '@/lib/api/stub';

// POST /api/purchases/{id}/cancel-receipt — 입고 취소. 오류: PF_VALIDATION(400) · PF_NOT_IMPLEMENTED(501)
export const POST = createHandler({
  run: stubRun('id'),
});
