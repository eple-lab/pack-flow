/**
 * 품목 수정 API 라우트(품목코드는 경로에서 받는다).
 *
 * 하는 일
 * 1. 경로의 sku_id는 품목코드 형식을 검사한다(틀리면 400 PF_VALIDATION, field "sku_id").
 * 2. 본문은 itemUpdate 스키마로 검사한다. 품목코드·재고 수량은 받지 않는다(not_allowed_field).
 * 3. 수정은 DB 함수 없이 사용자 JWT로 items를 update한다(updateItem). RLS가 마스터 5칸만 허용하고, 행이 없으면 404 PF_NOT_FOUND.
 *
 * 근거: docs/04-api-contract.md 3.2 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/items/[sku_id] stub (WU-04)
 * 2026-11-23  eple  stub → updateItem 실제 처리 (WU-41)
 */
import { createHandler } from '@/lib/api/handler';
import { updateItem } from '@/lib/queries/items';
import { checkPathParam } from '@/lib/queries/pathParam';
import { itemUpdate } from '@/lib/validation/schemas';

// PATCH /api/items/{sku_id} — 품목 수정. 오류: PF_VALIDATION(400) · PF_NOT_FOUND(404)
export const PATCH = createHandler({
  schema: itemUpdate,
  run: async ({ supabase, body, params }) => {
    const skuId = checkPathParam(params, 'sku_id');
    return { data: await updateItem(supabase, skuId, body) };
  },
});
