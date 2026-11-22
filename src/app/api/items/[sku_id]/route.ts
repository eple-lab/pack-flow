/**
 * 품목 수정 API 라우트(품목코드는 경로에서 받는다).
 *
 * 하는 일
 * 1. 경로의 sku_id는 품목코드 형식을 검사한다(틀리면 400 PF_VALIDATION, field "sku_id").
 * 2. 본문은 itemUpdate 스키마로 검사한다. 품목코드·재고 수량은 받지 않는다(not_allowed_field).
 * 3. 지금은 stub이다: 501 PF_NOT_IMPLEMENTED. 실제 처리는 라우트 주인이 채운다.
 *
 * 근거: docs/04-api-contract.md 3.2 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/items/[sku_id] stub (WU-04)
 */
import { createHandler } from '@/lib/api/handler';
import { stubRun } from '@/lib/api/stub';
import { itemUpdate } from '@/lib/validation/schemas';

// PATCH /api/items/{sku_id} — 품목 수정. 오류: PF_VALIDATION(400) · PF_NOT_IMPLEMENTED(501)
export const PATCH = createHandler({
  schema: itemUpdate,
  run: stubRun('sku_id'),
});
