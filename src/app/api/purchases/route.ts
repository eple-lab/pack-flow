/**
 * 구매 목록 · 등록 API 라우트.
 *
 * 하는 일
 * 1. 목록(GET)의 쿼리 status는 purchaseListQuery 스키마로 검사한다(잘못되면 400 PF_VALIDATION).
 * 2. 등록(POST)의 본문은 purchaseCreate 스키마로 검사한다.
 * 3. 지금은 stub이다: 501 PF_NOT_IMPLEMENTED. 실제 처리는 라우트 주인이 채운다.
 *
 * 근거: docs/04-api-contract.md 3.3 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/purchases stub (WU-04)
 */
import { createHandler } from '@/lib/api/handler';
import { stubRun } from '@/lib/api/stub';
import { purchaseCreate, purchaseListQuery } from '@/lib/validation/schemas';

// GET /api/purchases?status= — 구매 목록. 오류: PF_VALIDATION(400) · PF_NOT_IMPLEMENTED(501)
export const GET = createHandler({
  query: purchaseListQuery,
  run: stubRun(),
});

// POST /api/purchases — 구매 등록. 오류: PF_VALIDATION(400) · PF_NOT_IMPLEMENTED(501)
export const POST = createHandler({
  schema: purchaseCreate,
  run: stubRun(),
});
