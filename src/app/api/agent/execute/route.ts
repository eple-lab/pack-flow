/**
 * AI 액션 실행 API 라우트 — 사람이 [실행]을 누른 뒤에만 불린다. 받은 액션을 처음부터 다시 검증한다.
 *
 * 하는 일
 * 1. 본문(action)은 agentExecute 스키마로 검사한다. 허용 액션 6개 밖의 type은 400 PF_VALIDATION.
 * 2. 사용자 JWT 클라이언트로 `executeAction`을 부른다(소유 · 재고를 다시 확인하고 재고 함수만 부른다 — 원칙 4).
 *
 * 근거: docs/04-api-contract.md 3.8 · docs/work-units/WU-34-chat.md
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple     자리 생성 (WU-04) — 구현은 skygaul WU-33/34
 * 2026-11-23  skygaul  stub을 액션 실행으로 교체 (WU-34)
 */
import { executeAction } from '@/lib/agent/actions';
import { createHandler } from '@/lib/api/handler';
import { agentExecute } from '@/lib/validation/schemas';

// POST /api/agent/execute — 검사된 에이전트 액션 실행. 오류: PF_VALIDATION(400) · PF_UNAUTHENTICATED(401) · PF_NOT_FOUND(404) · 재고 함수의 코드
export const POST = createHandler({
  schema: agentExecute,
  run: async ({ supabase, body }) => ({ data: await executeAction(supabase, body.action) }),
});
