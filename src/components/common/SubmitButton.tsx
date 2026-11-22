/**
 * 저장 · 실행 버튼 — 요청 중에는 잠그고 '처리 중…'을 보여 두 번 눌러도 한 번만 실행되게 한다.
 *
 * 하는 일
 * 1. pending이거나 요청이 아직 끝나지 않았으면 disabled + aria-busy로 바꾸고 글자를 pendingText로 바꾼다.
 * 2. onClick이 Promise를 돌려주면 끝날 때까지 두 번째 클릭을 무시한다(pending prop이 늦게 바뀌어도 막힌다).
 * 3. type이 submit이고 onClick이 있으면 폼 제출은 막고 onClick만 실행한다(이중 실행 방지).
 *    onClick이 없으면 폼 제출은 브라우저에 맡긴다.
 *
 * 근거: docs/04-api-contract.md 4.6 · docs/wireframes.html 8절 · WU-05
 * 구역: eple (docs/06-work-plan.md 1절 '앱 뼈대')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — SubmitButton (WU-05)
 */
'use client';

import { useRef, useState } from 'react';
import type React from 'react';
import styles from './SubmitButton.module.css';

export interface SubmitButtonProps {
  /** 서버 요청 중이면 true. 버튼을 잠그고 pendingText를 보인다. */
  pending?: boolean;
  children: React.ReactNode;
  /** 요청 중 글자. 기본 '처리 중…' */
  pendingText?: string;
  /** 기본 'submit' */
  type?: 'submit' | 'button';
  /** Promise를 돌려주면 끝날 때까지 다시 눌리지 않는다. */
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  /** data-testid */
  testid?: string;
}

/**
 * 저장 · 실행 버튼.
 * testid: props.testid 그대로 달린다(화면마다 WU 문서의 testid를 넘긴다).
 */
export function SubmitButton({
  pending = false,
  children,
  pendingText = '처리 중…',
  type = 'submit',
  onClick,
  disabled = false,
  testid,
}: SubmitButtonProps) {
  // 상태 대신 ref로 잠근다. 같은 클릭 순간에 두 번째 클릭이 와도 막히기 때문이다.
  const lockRef = useRef(false);
  // 화면 표시용 상태. ref 잠금이 걸리면 버튼도 잠가 보이게 한다.
  const [running, setRunning] = useState(false);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!onClick) return;
    if (type === 'submit') event.preventDefault();
    if (lockRef.current) return;

    const result = onClick();
    if (result instanceof Promise) {
      lockRef.current = true;
      setRunning(true);
      // 성공이든 실패든 잠금을 푼다. 실패는 onClick 안에서 ErrorBanner 등으로 처리해야 한다(여기서는 삼킨다 —
      // 그렇지 않으면 처리되지 않은 Promise 거부가 된다).
      const release = () => {
        lockRef.current = false;
        setRunning(false);
      };
      result.then(release, release);
    }
  }

  const busy = pending || running;

  return (
    <button
      type={type}
      data-testid={testid}
      className={styles.button}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      onClick={handleClick}
    >
      {busy ? pendingText : children}
    </button>
  );
}
