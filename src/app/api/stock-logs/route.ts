/**
 * 재고 이력 조회 API 라우트.
 *
 * 하는 일
 * 1. 쿼리 sku_id · limit · cursor는 stockLogsQuery 스키마로 검사한다(limit 1~50, 빈 값이면 20).
 * 2. listStockLogs(src/lib/queries/stockLogs.ts)가 키셋 페이지네이션으로 읽는다. 커서가 틀리면 400 PF_VALIDATION field "cursor".
 *
 * 근거: docs/04-api-contract.md 3.5 · WU-04, WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/stock-logs stub (WU-04)
 * 2026-11-23  eple  stub → 키셋 페이지네이션 (WU-41)
 */
import { createHandler } from '@/lib/api/handler';
import { listStockLogs } from '@/lib/queries/stockLogs';
import { stockLogsQuery } from '@/lib/validation/schemas';

// GET /api/stock-logs?sku_id=&limit=&cursor= — 재고 이력(최근순). 오류: PF_UNAUTHENTICATED(401) · PF_VALIDATION(400) · PF_INTERNAL(500)
export const GET = createHandler({
  query: stockLogsQuery,
  run: async ({ supabase, query }) => ({
    data: await listStockLogs(supabase, { sku_id: query.sku_id ?? undefined, limit: query.limit, cursor: query.cursor ?? undefined }),
  }),
});
