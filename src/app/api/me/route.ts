/**
 * GET /api/me — 로그인한 사용자의 id와 이메일만 돌려준다.
 *
 * 하는 일
 * 1. 로그인 확인은 createHandler가 한다(미로그인 401 PF_UNAUTHENTICATED).
 * 2. 응답은 `{ email, user_id }`뿐이다(04 3.1). 다른 계정 정보는 싣지 않는다.
 *
 * 근거: docs/04-api-contract.md 3.1, WU-03
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/me (WU-03)
 */
import { createHandler } from '@/lib/api/handler';

export const GET = createHandler({
  run: async ({ user }) => ({ data: { email: user?.email ?? null, user_id: user?.id ?? null } }),
});
