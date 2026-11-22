/**
 * Next 16 proxy(옛 middleware) — 세션 갱신과 화면 미로그인 → /login 보내기.
 *
 * 하는 일
 * 1. 요청마다 Supabase 세션 쿠키를 읽어 필요하면 갱신하고, 새 쿠키를 응답에 싣는다(@supabase/ssr 패턴).
 * 2. 로그인하지 않은 *화면* 요청은 `/login?next=<지금 경로>`로 보낸다(04 4.4).
 * 3. `/api/**`는 리다이렉트하지 않고 그대로 통과시킨다 — 401 JSON은 라우트의 createHandler가 만든다(04 1절).
 * 4. 정적 파일 · `/login`은 matcher로 제외한다. 여기 판정은 "낙관적 확인"일 뿐이고 진짜 권한은 DB(RLS · 함수)가 정한다.
 *
 * 근거: docs/04-api-contract.md 1 · 4.4, docs/02-decisions.md D-30, node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md, WU-03 5번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 세션 갱신 · 미로그인 화면 리다이렉트 (WU-03)
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { loginUrlFor } from '@/lib/auth/next-path';
import { getPublicEnv } from '@/lib/env';

/**
 * 모든 (제외 경로 밖) 요청 앞에서 돈다.
 * 부작용: 세션이 갱신되면 Set-Cookie를 응답에 싣는다.
 * @throws EnvError 공개 환경변수가 비었을 때(서버 설정 오류 — 화면에 500)
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // 세션 갱신(토큰 만료 시 새 쿠키를 setAll로 돌려준다). 이 호출과 응답 사이에 다른 코드를 두지 않는다.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  const isApi = pathname === '/api' || pathname.startsWith('/api/');
  if (!signedIn && !isApi) {
    const redirect = NextResponse.redirect(new URL(loginUrlFor(pathname, search), request.url));
    // 갱신 과정에서 정리된 쿠키(만료 세션 삭제 등)가 있으면 리다이렉트 응답에도 옮긴다
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  // 정적 파일 · 이미지 최적화 · 파비콘 · 이미지 확장자 · /login은 건너뛴다
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|login(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
