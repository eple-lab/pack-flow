/**
 * 일괄 등록 반영 API 라우트.
 *
 * 하는 일
 * 1. 본문(rows)은 bulkCommit 스키마로 검사한다(행 최대 500, 행마다 bulkRow 규칙). 잘못되면 400 PF_VALIDATION.
 * 2. 미리보기에서 유효했던 행만 받는다. 서버는 DB 함수에서 한 번 더 검사한다.
 * 3. 지금은 stub이다: 501 PF_NOT_IMPLEMENTED. 실제 처리는 라우트 주인이 채운다.
 *
 * 근거: docs/04-api-contract.md 3.6 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/bulk/commit stub (WU-04)
 */
import { createHandler } from '@/lib/api/handler';
import { stubRun } from '@/lib/api/stub';
import { bulkCommit } from '@/lib/validation/schemas';

// POST /api/bulk/commit — 일괄 등록 반영. 오류: PF_VALIDATION(400) · PF_NOT_IMPLEMENTED(501)
export const POST = createHandler({
  schema: bulkCommit,
  run: stubRun(),
});
