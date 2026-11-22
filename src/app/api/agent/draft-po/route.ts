/**
 * AI 발주 초안 생성 API 라우트. 자리만 만든 파일이다.
 *
 * 하는 일
 * 1. 본문(sku_ids, 선택)은 draftPoRequest 스키마로 검사한다(잘못되면 400 PF_VALIDATION).
 * 2. 지금은 stub이다: 501 PF_NOT_IMPLEMENTED. 실제 처리(LLM 초안)는 skygaul이 채운다.
 *
 * 근거: docs/04-api-contract.md 3.8 · WU-04
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  자리 생성 (WU-04) — 구현은 skygaul WU-33/34
 */
import { createHandler } from '@/lib/api/handler';
import { stubRun } from '@/lib/api/stub';
import { draftPoRequest } from '@/lib/validation/schemas';

// POST /api/agent/draft-po — 발주 초안 생성. 오류: PF_VALIDATION(400) · PF_NOT_IMPLEMENTED(501)
export const POST = createHandler({
  schema: draftPoRequest,
  run: stubRun(),
});
