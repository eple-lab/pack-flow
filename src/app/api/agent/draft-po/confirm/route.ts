/**
 * AI 발주 초안 확정 API 라우트. 자리만 만든 파일이다.
 *
 * 하는 일
 * 1. 본문(lines, 사용자가 고친 값)은 poConfirm 스키마로 검사한다(잘못되면 400 PF_VALIDATION).
 * 2. 받은 내용은 처음부터 다시 검증한다(04 3.8). LLM 응답으로 DB를 바로 바꾸지 않는다(원칙 4).
 * 3. 지금은 stub이다: 501 PF_NOT_IMPLEMENTED. 실제 처리는 skygaul이 채운다.
 *
 * 근거: docs/04-api-contract.md 3.8 · WU-04
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  자리 생성 (WU-04) — 구현은 skygaul WU-33/34
 */
import { createHandler } from '@/lib/api/handler';
import { stubRun } from '@/lib/api/stub';
import { poConfirm } from '@/lib/validation/schemas';

// POST /api/agent/draft-po/confirm — 발주 초안 확정. 오류: PF_VALIDATION(400) · PF_NOT_IMPLEMENTED(501)
export const POST = createHandler({
  schema: poConfirm,
  run: stubRun(),
});
