/**
 * 일괄 등록 반영 API 라우트.
 *
 * 하는 일
 * 1. 본문(rows)은 bulkCommit 스키마로 검사한다(행 최대 500, 행마다 bulkRow 규칙). 잘못되면 400 PF_VALIDATION.
 * 2. 미리보기에서 유효했던 행만 받는다. pf_bulk_apply가 행마다 재고 함수로 한 번 더 검사하며 반영하고,
 *    실패한 행은 건너뛴 사유와 함께 돌려준다(원칙 1 — 재고는 DB 함수만 바꾼다).
 * 3. 응답은 { applied, skipped: [{line, code, message}] }.
 *
 * 근거: docs/04-api-contract.md 3.6 · WU-04 · WU-43
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/bulk/commit stub (WU-04)
 * 2026-11-23  eple  stub → pf_bulk_apply 연결 (WU-43)
 */
import { createHandler } from '@/lib/api/handler';
import { bulkApply } from '@/lib/inventory';
import { bulkCommit } from '@/lib/validation/schemas';

// POST /api/bulk/commit — 일괄 등록 반영. 오류: PF_VALIDATION(400) · PF_UNAUTHENTICATED(401) · PF_CSRF(403)
export const POST = createHandler({
  schema: bulkCommit,
  run: async ({ supabase, body }) => ({ data: await bulkApply(supabase, { rows: body.rows }) }),
});
