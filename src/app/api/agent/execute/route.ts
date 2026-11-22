/**
 * AI 액션 실행 API 라우트. 자리만 만든 파일이다.
 *
 * 하는 일
 * 1. 본문(action)은 agentExecute 스키마로 검사한다. 허용 액션 6개 밖의 type은 400 PF_VALIDATION.
 * 2. 실행은 사람이 한다(원칙 4). 이 라우트는 검사된 액션만 DB 함수로 넘긴다.
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
import { agentExecute } from '@/lib/validation/schemas';

// POST /api/agent/execute — 검사된 에이전트 액션 실행. 오류: PF_VALIDATION(400) · PF_NOT_IMPLEMENTED(501)
export const POST = createHandler({
  schema: agentExecute,
  run: stubRun(),
});
