/**
 * 판매 상태 변경 API 라우트.
 *
 * 하는 일
 * 1. 경로의 id는 uuid 형식을 검사한다(틀리면 400 PF_VALIDATION, field "id").
 * 2. 본문 to는 saleStatusChange 스키마로 검사한다(출고대기 · 주문취소).
 * 3. 지금은 stub이다: 501 PF_NOT_IMPLEMENTED. 실제 처리는 라우트 주인이 채운다.
 *
 * 근거: docs/04-api-contract.md 3.4 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/sales/[id]/status stub (WU-04)
 */
import { createHandler } from '@/lib/api/handler';
import { stubRun } from '@/lib/api/stub';
import { saleStatusChange } from '@/lib/validation/schemas';

// POST /api/sales/{id}/status — 판매 상태 변경. 오류: PF_VALIDATION(400) · PF_NOT_IMPLEMENTED(501)
export const POST = createHandler({
  schema: saleStatusChange,
  run: stubRun('id'),
});
