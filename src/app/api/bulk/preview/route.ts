/**
 * 일괄 등록 미리보기 API 라우트.
 *
 * 하는 일
 * 1. 본문(format · text)은 bulkPreview 스키마로 검사한다(잘못되면 400 PF_VALIDATION).
 * 2. 행 수(최대 500) 검사는 파싱 단계(src/lib/bulk/parse.ts)가 맡는다.
 * 3. 지금은 stub이다: 501 PF_NOT_IMPLEMENTED. 실제 처리는 라우트 주인이 채운다.
 *
 * 근거: docs/04-api-contract.md 3.6 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/bulk/preview stub (WU-04)
 */
import { createHandler } from '@/lib/api/handler';
import { stubRun } from '@/lib/api/stub';
import { bulkPreview } from '@/lib/validation/schemas';

// POST /api/bulk/preview — 일괄 등록 미리보기. 오류: PF_VALIDATION(400) · PF_NOT_IMPLEMENTED(501)
export const POST = createHandler({
  schema: bulkPreview,
  run: stubRun(),
});
