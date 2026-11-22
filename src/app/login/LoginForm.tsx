'use client';
/**
 * 로그인 폼 — 이메일 · 비밀번호를 loginInput 스키마로 검사하고 Supabase Auth로 로그인한다.
 *
 * 하는 일
 * 1. 같은 스키마(loginInput)로 보내기 전에 검사하고, 실패는 칸 아래에 04 4.3 문구로 보인다(alert 금지).
 * 2. 로그인 성공하면 `next`(서버가 이미 걸러 준 같은 사이트 경로)로 이동하고 서버 컴포넌트를 새로 읽는다.
 * 3. 로그인 실패 문구는 이메일이 틀렸는지 비밀번호가 틀렸는지 알려 주지 않는다(계정 존재 노출 방지).
 * 4. 요청 중에는 버튼을 잠근다(두 번 눌러도 한 번).
 *
 * 근거: docs/04-api-contract.md 4.2 · 4.3 · 4.6, docs/05-security.md, WU-03 5번
 * 구역: eple (docs/06-work-plan.md 1절 '로그인')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 로그인 폼 (WU-03)
 */
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { parseWith } from '@/lib/validation/detail';
import { fieldMessage } from '@/lib/validation/messages';
import { loginInput } from '@/lib/validation/schemas';
import styles from './login.module.css';

type FieldErrors = { email?: string; password?: string };

/**
 * 로그인 폼. props: next(로그인 뒤 이동할 같은 사이트 경로).
 * testid: login-email, login-password, login-submit, login-error, login-email-error, login-password-error
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const checked = parseWith(loginInput, { email: form.get('email'), password: form.get('password') });
    if (!checked.ok) {
      const key = checked.detail.field === 'password' ? 'password' : 'email';
      setFieldErrors({ [key]: fieldMessage(checked.detail) });
      return;
    }
    setFieldErrors({});

    setPending(true);
    try {
      const { error } = await createBrowserSupabase().auth.signInWithPassword(checked.data);
      if (error) {
        setFormError('이메일 또는 비밀번호를 확인해 주세요');
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      // 연결 실패 등 — 서버 문구 표(04 4.4)의 PF_NETWORK 문구와 같다
      setFormError('서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <label className={styles.label} htmlFor="login-email">
        이메일
      </label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="username"
        className={styles.input}
        data-testid="login-email"
        aria-invalid={Boolean(fieldErrors.email)}
      />
      {fieldErrors.email && (
        <p className={styles.fieldError} data-testid="login-email-error">
          {fieldErrors.email}
        </p>
      )}

      <label className={styles.label} htmlFor="login-password">
        비밀번호
      </label>
      <input
        id="login-password"
        name="password"
        type="password"
        autoComplete="current-password"
        className={styles.input}
        data-testid="login-password"
        aria-invalid={Boolean(fieldErrors.password)}
      />
      {fieldErrors.password && (
        <p className={styles.fieldError} data-testid="login-password-error">
          {fieldErrors.password}
        </p>
      )}

      {formError && (
        <p className={styles.banner} role="alert" data-testid="login-error">
          {formError}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={pending} data-testid="login-submit">
        {pending ? '처리 중…' : '로그인'}
      </button>
    </form>
  );
}
