/**
 * 구매 목록 · 등록 API 라우트.
 *
 * 하는 일
 * 1. 목록(GET)의 쿼리 status는 purchaseListQuery 스키마로 검사한다(잘못되면 400 PF_VALIDATION).
 * 2. 등록(POST)의 본문은 purchaseCreate 스키마로 검사한다.
 * 3. 목록(GET)은 실제 조회다(listPurchases: status 필터, 최근순). 등록(POST)은 DB 함수 pf_create_purchase를 래퍼로 부른다(source 'form', 201).
 *
 * 근거: docs/04-api-contract.md 3.3 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/purchases stub (WU-04)
 * 2026-11-23  eple  stub → 실제 조회 (WU-41)
 * 2026-11-23  eple  POST stub → createPurchase 실제 처리 (WU-41)
 */
import { createHandler } from '@/lib/api/handler';
import { createPurchase } from '@/lib/inventory';
import { listPurchases } from '@/lib/queries/lists';
import { purchaseCreate, purchaseListQuery } from '@/lib/validation/schemas';

// GET /api/purchases?status= — 구매 목록. 오류: PF_VALIDATION(400) · PF_UNAUTHENTICATED(401) · PF_INTERNAL(500)
export const GET = createHandler({
  query: purchaseListQuery,
  run: async ({ supabase, query }) => ({ data: await listPurchases(supabase, query.status) }),
});

// POST /api/purchases — 구매 등록(201). 오류: PF_VALIDATION(400) · PF_NOT_FOUND(품목) · PF_DUPLICATE_INVOICE(409) · PF_NOT_IMPLEMENTED(501, DB 함수가 stub일 때)
export const POST = createHandler({
  schema: purchaseCreate,
  run: async ({ supabase, body }) => ({ data: await createPurchase(supabase, { ...body, source: 'form' }), status: 201 }),
});
