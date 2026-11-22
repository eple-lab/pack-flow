/**
 * 성공 알림 토스트 — Provider · hook · 표시를 이 파일 하나에 둔다.
 *
 * 하는 일
 * 1. ToastProvider가 메시지 하나를 들고 있다. 우하단에 role="status"로 보여 준다.
 * 2. 3초 뒤 자동으로 사라진다. 새 메시지가 오면 이전 타이머를 지우고 교체한다.
 * 3. Provider 밖에서 useToast를 부르면 아무 일도 하지 않는 show를 돌려준다(오류를 던지지 않는다).
 * 4. 메시지 형식은 호출하는 쪽이 정한다. 예: "PRD-001 재고 10 → 4"
 *
 * 근거: docs/04-api-contract.md 4.6 · docs/wireframes.html 8절 · WU-05
 * 구역: eple (docs/06-work-plan.md 1절 '앱 뼈대')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — ToastProvider · useToast · 표시 (WU-05)
 */
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Toast.module.css';

/** 토스트가 떠 있는 시간(밀리초). 4.6절 기준 3초. */
const TOAST_DURATION_MS = 3000;

export interface ToastApi {
  /** 메시지를 띄운다. 이미 떠 있으면 교체하고 3초를 다시 잰다. */
  show: (message: string) => void;
}

interface ToastState {
  text: string;
}

const ToastContext = createContext<ToastApi | null>(null);

// Provider 밖에서 쓰였을 때 돌려주는 빈 구현. 오류를 던지지 않는다.
const NOOP_TOAST: ToastApi = { show: () => {} };

/**
 * 토스트 표시 영역을 감싼다. 앱 루트 또는 필요한 화면에 한 번 둔다.
 * testid: toast(표시 중일 때만 DOM에 있다)
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  // 객체로 들고 있어야 같은 글자라도 새 메시지마다 상태가 바뀌어 타이머가 다시 돈다.
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((message: string) => {
    setToast({ text: message });
  }, []);

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    // 새 메시지가 오거나 언마운트되면 이전 타이머를 지운다.
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <div role="status" aria-live="polite" data-testid="toast" className={styles.toast}>
          {toast.text}
        </div>
      )}
    </ToastContext.Provider>
  );
}

/**
 * 토스트를 띄우는 함수를 돌려준다.
 * 사용: const toast = useToast(); toast.show('저장했어요');
 * Provider 밖이면 아무 일도 하지 않는다(오류 없음).
 */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP_TOAST;
}
