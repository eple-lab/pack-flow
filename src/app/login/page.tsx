/**
 * 로그인 페이지(서버 컴포넌트) — `next` 쿼리를 안전한 경로로 걸러 폼에 넘긴다.
 *
 * 하는 일
 * 1. `/login?next=/trades`의 next를 safeNextPath로 검사한다(열린 리다이렉트 방지).
 * 2. 폼(이메일 · 비밀번호)은 클라이언트 컴포넌트 LoginForm이 맡는다. 로그아웃 버튼은 5단계 레이아웃.
 *
 * 근거: docs/04-api-contract.md 3.1 · 4.4, WU-03 5번
 * 구역: eple (docs/06-work-plan.md 1절 '로그인')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 로그인 페이지 (WU-03)
 */
import { safeNextPath } from '@/lib/auth/next-path';
import { LoginForm } from './LoginForm';
import styles from './login.module.css';

export const metadata = { title: '로그인 · PackFlow' };

/** 로그인 화면. testid: login-page */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return (
    <main className={styles.page} data-testid="login-page">
      <h1 className={styles.title}>PackFlow</h1>
      <LoginForm next={safeNextPath(next)} />
    </main>
  );
}
