/**
 * 확인 상자 — 취소류 · 초기화 · 발주 확인 전에 한 번 더 묻는다.
 *
 * 하는 일
 * 1. open이 false면 아무것도 그리지 않는다(null).
 * 2. 열리면 [취소]에 자동 포커스한다. Enter를 실수로 눌러도 위험한 쪽이 실행되지 않게 하려는 것이다.
 * 3. Escape는 onCancel을 부른다. pending(요청 중)일 때는 무시한다.
 * 4. 오버레이를 눌러도 닫지 않는다(실수로 닫히지 않게).
 *
 * 근거: docs/04-api-contract.md 4.6 · docs/wireframes.html 8절 · WU-05
 * 구역: eple (docs/06-work-plan.md 1절 '앱 뼈대')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — ConfirmDialog (WU-05)
 */
'use client';

import { useEffect, useId, useRef } from 'react';
import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  /** true면 상자를 연다. false면 아무것도 그리지 않는다. */
  open: boolean;
  /** 결과를 한 문장으로 쓴다. 예: "출고를 취소하면 재고가 6개 돌아오고, 기록은 남아요" */
  message: string;
  /** 확인 버튼 글자. 기본 '확인' */
  confirmLabel?: string;
  /** 취소 버튼 글자. 기본 '취소' */
  cancelLabel?: string;
  /** 요청 중이면 확인 버튼을 잠그고 '처리 중…'을 보인다. Escape도 무시한다. */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 확인 상자 본체.
 * testid: confirm-dialog(상자) · confirm-cancel(취소) · confirm-ok(확인)
 */
export function ConfirmDialog({
  open,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const messageId = useId();

  // 열릴 때 취소 버튼에 포커스를 준다(위험한 쪽 실수 방지).
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // Escape로 닫는다. 요청 중에는 닫히지 않게 무시한다.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onCancel();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div
        role="dialog"
        aria-modal="true"
        aria-describedby={messageId}
        data-testid="confirm-dialog"
        className={styles.box}
      >
        <p id={messageId} className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            data-testid="confirm-cancel"
            className={styles.cancel}
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-testid="confirm-ok"
            className={styles.ok}
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? '처리 중…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
