/**
 * 품목 목록 · 등록 API 라우트.
 *
 * 하는 일
 * 1. 등록(POST)의 본문은 itemCreate 스키마로 검사한다(잘못되면 400 PF_VALIDATION).
 * 2. 목록(GET)은 실제 조회다(listItems: 품목코드 순 + below_safety, RLS로 내 품목만).
 * 3. 등록(POST)은 DB 함수 pf_create_item을 래퍼(createItem)로 부른다(201). 재고 0으로 만든다.
 *
 * 근거: docs/04-api-contract.md 3.2 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/items stub (WU-04)
 * 2026-11-23  eple  stub → 실제 조회 (WU-41)
 * 2026-11-23  eple  POST stub → createItem 실제 처리 (WU-41)
 */
import { createHandler } from '@/lib/api/handler';
import { createItem } from '@/lib/inventory';
import { listItems } from '@/lib/queries/lists';
import { itemCreate } from '@/lib/validation/schemas';

// GET /api/items — 품목 목록. 오류: PF_UNAUTHENTICATED(401) · PF_INTERNAL(500)
export const GET = createHandler({
  run: async ({ supabase }) => ({ data: await listItems(supabase) }),
});

// POST /api/items — 품목 등록(201). 오류: PF_VALIDATION(400) · PF_DUPLICATE_SKU(409) · PF_NOT_IMPLEMENTED(501, DB 함수가 stub일 때)
export const POST = createHandler({
  schema: itemCreate,
  run: async ({ supabase, body }) => ({ data: await createItem(supabase, body), status: 201 }),
});
