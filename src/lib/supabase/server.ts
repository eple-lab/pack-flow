/**
 * 서버용 Supabase 클라이언트 — 요청 쿠키의 세션(사용자 JWT)으로 만든다.
 *
 * 하는 일
 * 1. 라우트 · 서버 컴포넌트에서 `await createServerSupabase()`로 사용자 권한 클라이언트를 얻는다.
 *    DB 권한은 RLS · 함수가 이 사용자 기준으로 판정한다(원칙 3).
 * 2. 서비스 키는 쓰지 않는다. 이 파일 · `src/` 어디에도 서비스 키를 읽는 코드를 두지 않는다(AGENTS.md 3절).
 * 3. 쿠키 쓰기(setAll)는 서버 컴포넌트에서는 막혀 있어 조용히 넘긴다 — 세션 갱신은 src/proxy.ts가 한다.
 *
 * 근거: docs/05-security.md 3절 · D-30, WU-03 3번, @supabase/ssr README
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 쿠키 기반 사용자 JWT 서버 클라이언트 (WU-03)
 */
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicEnv } from '@/lib/env';

/**
 * 현재 요청의 사용자로 동작하는 Supabase 클라이언트를 만든다.
 * 부작용: 세션이 갱신되면 응답 쿠키를 쓴다(쓸 수 없는 자리면 무시).
 * @throws EnvError 공개 환경변수가 비었을 때
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. proxy가 세션을 갱신하므로 괜찮다.
        }
      },
    },
  });
}
