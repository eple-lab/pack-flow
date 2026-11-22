/**
 * 재고 이력 조회 API 라우트.
 *
 * 하는 일
 * 1. 쿼리 sku_id · limit · cursor는 stockLogsQuery 스키마로 검사한다(limit 1~50, 빈 값이면 20).
 * 2. 지금은 stub이다: 501 PF_NOT_IMPLEMENTED. 실제 처리는 라우트 주인이 채운다.
 *
 * 근거: docs/04-api-contract.md 3.5 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/stock-logs stub (WU-04)
 */
import { createHandler } from '@/lib/api/handler';
import { stubRun } from '@/lib/api/stub';
import { stockLogsQuery } from '@/lib/validation/schemas';

// GET /api/stock-logs?sku_id=&limit=&cursor= — 재고 이력. 오류: PF_VALIDATION(400) · PF_NOT_IMPLEMENTED(501)
export const GET = createHandler({
  query: stockLogsQuery,
  run: stubRun(),
});
