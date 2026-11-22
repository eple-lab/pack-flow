/**
 * 상단 바 — 브랜드 · 내비 · 시연 데이터 초기화 버튼 자리 · 계정(가린 표시) · 로그아웃.
 *
 * 하는 일
 * 1. 계정은 이메일 앞 2글자만 보인다(화면 녹화 · 캡처 대비 — maskEmail).
 * 2. [시연 데이터 초기화]는 jkspawn의 SeedResetButton 자리를 꽂아 둔 곳이다(WU-15).
 *
 * 근거: docs/wireframes.html 2절, WU-05 1번
 * 구역: eple (docs/06-work-plan.md 1절 '앱 뼈대')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 상단 바 (WU-05)
 */
import { SeedResetButton } from '@/components/demo/SeedResetButton';
import { maskEmail } from '@/lib/format';
import { LogoutButton } from './LogoutButton';
import { NavBar } from './NavBar';
import styles from './layout.module.css';

/** 상단 바. props: email(로그인 사용자 이메일 — 화면에는 가려서 보임). testid: topbar, account-label */
export function TopBar({ email }: { email: string | null }) {
  return (
    <header className={styles.topbar} data-testid="topbar">
      <span className={styles.brand}>PackFlow</span>
      <NavBar />
      <span className={styles.grow} />
      <SeedResetButton />
      <span className={styles.account} data-testid="account-label">
        {maskEmail(email)}
      </span>
      <LogoutButton />
    </header>
  );
}
