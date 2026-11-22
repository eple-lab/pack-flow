/**
 * 로그인 뒤 화면의 틀 — 상단 바 · 내비 · 본문 · 오른쪽 에이전트 패널 자리.
 *
 * 하는 일
 * 1. 서버에서 로그인 사용자를 확인한다(쿠키 세션의 JWT 클레임). 없으면 /login으로 보낸다 —
 *    proxy가 먼저 막지만 여기서도 한 번 더 확인한다(proxy는 낙관적 확인일 뿐, Next 16 안내).
 * 2. 성공 알림(Toast) 공급자를 감싼다. 페이지 내용은 jkspawn 구역이다.
 *
 * 근거: docs/wireframes.html 2절, node_modules/next/dist/docs/01-app/02-guides/authentication.md, WU-05 1번
 * 구역: eple (docs/06-work-plan.md 1절 '앱 뼈대')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — (app) 레이아웃 (WU-05)
 */
import { redirect } from 'next/navigation';
import { AgentSlot } from '@/components/layout/AgentSlot';
import { TopBar } from '@/components/layout/TopBar';
import styles from '@/components/layout/layout.module.css';
import { ToastProvider } from '@/components/common/Toast';
import { createServerSupabase } from '@/lib/supabase/server';

/** 로그인한 사용자 전용 틀. 미로그인이면 /login. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims || typeof claims.sub !== 'string') redirect('/login');

  return (
    <ToastProvider>
      <TopBar email={typeof claims.email === 'string' ? claims.email : null} />
      <div className={styles.body}>
        <main className={styles.main}>{children}</main>
        <AgentSlot />
      </div>
    </ToastProvider>
  );
}
