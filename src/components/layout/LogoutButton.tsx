'use client';
/**
 * 로그아웃 버튼 — /api/auth/logout(POST, CSRF 적용)을 부르고 로그인 화면으로 보낸다.
 *
 * 하는 일: api.logout() 성공 또는 이미 로그아웃된 상태(401)면 /login으로 이동. 요청 중에는 잠근다.
 *          실패(연결 · 시간 초과)하면 그 자리에서 문구를 보인다(alert 금지).
 *
 * 근거: docs/04-api-contract.md 3.1 · 4.6, WU-03 5번 · WU-05 1번
 * 구역: eple (docs/06-work-plan.md 1절 '앱 뼈대')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 로그아웃 버튼 (WU-05)
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { ApiError } from '@/lib/api/client-error';
import styles from './layout.module.css';

/** 로그아웃 버튼. testid: btn-logout, logout-error */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await api.logout();
      router.replace('/login');
      router.refresh();
    } catch (e) {
      // 401은 api-client가 이미 로그인 화면으로 보낸다. 그 밖의 오류만 보인다
      if (!(e instanceof ApiError) || e.code !== 'PF_UNAUTHENTICATED') {
        setError(e instanceof ApiError ? e.message : '잠시 문제가 생겼어요. 다시 시도해 주세요');
        setPending(false);
      }
    }
  }

  return (
    <>
      <button type="button" className={styles.ghostButton} onClick={onClick} disabled={pending} data-testid="btn-logout">
        {pending ? '처리 중…' : '로그아웃'}
      </button>
      {error && (
        <span role="alert" className={styles.account} data-testid="logout-error">
          {error}
        </span>
      )}
    </>
  );
}
