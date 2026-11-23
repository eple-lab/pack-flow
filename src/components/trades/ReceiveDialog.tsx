'use client';

/**
 * 입고 확정 창 — 도착 수량(기본 = 주문 수량, 1 ~ 주문 수량)을 받아 POST /api/purchases/{id}/receive.
 *
 * 하는 일
 * 1. purchase가 있을 때만 열린다. 열릴 때 도착 수량 칸에 주문 수량을 채우고 커서를 둔다.
 * 2. 보내기 전에 makeReceive(order_qty)로 검사하고 칸 아래 FieldError(04 4.2 · 4.3). 그때는 요청을 보내지 않는다.
 * 3. 성공하면 onDone(결과) — 재고 · 상태는 서버 응답 값을 쓴다. 칸 오류가 아닌 실패는 onError(배너).
 * 4. Escape · [취소]로 닫는다. 요청 중에는 확인 버튼이 잠긴다(SubmitButton).
 *
 * 근거: docs/04-api-contract.md 3.3 · 4.2 · 4.6, docs/work-units/WU-12-trades.md 4번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-12
 * 2026-11-23  jkspawn  입고 확정 창 · 도착 수량 검사 구현 (WU-12)
 */
import { useEffect, useId, useRef, useState } from 'react';
import { FieldError } from '@/components/common/FieldError';
import { SubmitButton } from '@/components/common/SubmitButton';
import { api, ApiError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { makeReceive, parseWith, toNumberInput, type ParseResult } from '@/lib/validation';
import type { Purchase, PurchaseWithStock } from '@/types/erp';
import { fieldErrorFromApi, fieldErrorFromDetail, type FieldErrorState } from './form-utils';
import styles from './trades.module.css';

const RECEIVE_FIELDS = ['received_qty'] as const;

/** 도착 수량 입력 글자를 검사한다(1 ~ 그 구매의 order_qty, 쉼표 · 공백 제거). */
export function buildReceiveInput(orderQty: number, text: string): ParseResult<{ received_qty: number }> {
  return parseWith(makeReceive(orderQty), { received_qty: toNumberInput(text) });
}

/**
 * 입고 확정 창. 열린 구매마다 새로 그리도록 호출부가 `key={purchase.id}`를 준다.
 *
 * props
 * - purchase: 입고할 구매(없으면 닫힘)
 * - onClose: [취소] · Escape
 * - onDone: 성공 응답(`{ purchase, stock_qty }`)
 * - onError: 칸 오류가 아닌 실패
 *
 * testid: receive-dialog, input-received-qty, btn-receive-confirm, field-error-received_qty
 * 부작용: POST /api/purchases/{id}/receive
 */
export function ReceiveDialog({
  purchase,
  onClose,
  onDone,
  onError,
}: {
  purchase: Purchase | null;
  onClose: () => void;
  onDone: (result: PurchaseWithStock) => void;
  onError: (error: ApiError) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => (purchase ? String(purchase.order_qty) : ''));
  const [fieldError, setFieldError] = useState<FieldErrorState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (purchase) inputRef.current?.focus();
  }, [purchase]);

  useEffect(() => {
    if (!purchase) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [purchase, busy, onClose]);

  if (!purchase) return null;
  const target = purchase;

  async function confirm() {
    const parsed = buildReceiveInput(target.order_qty, text);
    if (!parsed.ok) {
      setFieldError(fieldErrorFromDetail(parsed.detail, RECEIVE_FIELDS));
      return; // 요청을 보내지 않는다
    }
    setFieldError(null);
    setBusy(true);
    try {
      const result = await api.receivePurchase(target.id, parsed.data.received_qty);
      onDone(result);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('PF_INTERNAL');
      const onField = fieldErrorFromApi(apiError, RECEIVE_FIELDS);
      if (onField) setFieldError(onField);
      else onError(apiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className={styles.dialog} data-testid="receive-dialog">
        <h2 id={`${id}-title`} className={styles.sectionTitle}>
          입고 확정 — {target.purchase_id}
        </h2>
        <p className={styles.dialogText}>
          {target.sku_id} · 주문 {formatNumber(target.order_qty)}개
        </p>
        <form noValidate onSubmit={(event) => event.preventDefault()} className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-qty`}>
            도착 수량 (1 ~ {formatNumber(target.order_qty)})
          </label>
          <input
            id={`${id}-qty`}
            ref={inputRef}
            className={styles.input}
            inputMode="numeric"
            data-testid="input-received-qty"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {fieldError && (
            <FieldError field={fieldError.field} detail={fieldError.detail} message={fieldError.message} />
          )}
          <div className={styles.dialogActions}>
            <button type="button" className={styles.secondary} onClick={onClose} disabled={busy}>
              취소
            </button>
            <SubmitButton testid="btn-receive-confirm" onClick={confirm}>
              입고 확정
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
