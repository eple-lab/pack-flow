/**
 * 브라우저용 Supabase 클라이언트 — 로그인 화면이 쓴다.
 *
 * 하는 일
 * 1. 공개 키(anon/publishable)만 쓴다. 브라우저 번들에 실려도 되는 값이고 권한은 RLS가 막는다.
 * 2. 세션은 쿠키에 저장돼 서버(proxy · 라우트)가 같은 세션을 읽는다.
 * 3. 로그인 · 로그아웃 외의 데이터 호출은 화면이 직접 하지 않고 api-client를 거친다(AGENTS.md 3절).
 *
 * 근거: docs/04-api-contract.md 1 · 3.1, WU-03 3번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 로그인 화면용 브라우저 클라이언트 (WU-03)
 */
import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv } from '@/lib/env';

/**
 * 브라우저 Supabase 클라이언트를 만든다(같은 인스턴스를 재사용해도 되는 가벼운 래퍼).
 * @throws EnvError 공개 환경변수가 비었을 때
 */
export function createBrowserSupabase() {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
