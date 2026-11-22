/**
 * POST /api/auth/logout — 세션을 끝낸다(쿠키 삭제).
 *
 * 하는 일
 * 1. CSRF(X-PF · Origin)는 createHandler가 검사한다. 로그인하지 않아도 부를 수 있어 requireUser: false.
 * 2. Supabase signOut이 세션 쿠키를 지운다. 버튼은 5단계 레이아웃에서 이 라우트를 부른다.
 *
 * 근거: docs/04-api-contract.md 1 · 3.1, WU-03 5번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 로그아웃 라우트 (WU-03)
 */
import { createHandler } from '@/lib/api/handler';

export const POST = createHandler({
  requireUser: false,
  run: async ({ supabase }) => {
    await supabase.auth.signOut();
    return { data: { ok: true } };
  },
});
