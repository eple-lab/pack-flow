/**
 * AI 채팅 API 라우트 — 사용자 메시지를 허용 액션으로 해석해 답한다. 읽기만 한다.
 *
 * 하는 일
 * 1. 본문(message, 1~500자)은 chatMessage 스키마로 검사한다(잘못되면 400 PF_VALIDATION).
 * 2. 사용자 JWT 클라이언트로 `handleChat`을 부른다. 조회는 DB 값으로 답하고, 변경은 제안만 한다(실행은 /execute).
 *
 * 근거: docs/04-api-contract.md 3.8 · docs/work-units/WU-34-chat.md
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple     자리 생성 (WU-04) — 구현은 skygaul WU-33/34
 * 2026-11-23  skygaul  stub을 대화 처리로 교체 (WU-34)
 */
import { handleChat } from '@/lib/agent/actions';
import { createHandler } from '@/lib/api/handler';
import { chatMessage } from '@/lib/validation/schemas';

// POST /api/agent/chat — 에이전트 채팅. 오류: PF_VALIDATION(400) · PF_UNAUTHENTICATED(401) · PF_QUOTA_EXCEEDED(429) · PF_LLM_UNAVAILABLE(503)
export const POST = createHandler({
  schema: chatMessage,
  run: async ({ supabase, body }) => ({ data: await handleChat(supabase, body.message) }),
});
