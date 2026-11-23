'use client';

/**
 * 품목 수정 창 — 이름 · 매입단가 · 판매가 · 안전재고 · 구매처 메모만 → PATCH /api/items/{sku_id}.
 *
 * 하는 일
 * 1. item이 있을 때만 열린다. 품목코드와 현재 재고는 읽기 전용 글자로만 보인다(입력 칸 없음 — 재고는 이력의 합).
 * 2. 보내기 전에 itemUpdate 스키마로 검사하고 틀린 칸 아래 FieldError. 구매처 메모를 비우면 null(지움).
 * 3. 성공하면 onSaved(서버가 돌려준 품목). 칸 오류가 아닌 실패는 onError(배너).
 * 4. Escape · [취소]로 닫는다. 저장 버튼은 SubmitButton(요청 중 잠금).
 *
 * 근거: docs/04-api-contract.md 3.2 · 4.1~4.4, docs/wireframes.html 5.4절, docs/work-units/WU-16-items.md 3번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-16
 * 2026-11-23  jkspawn  품목 수정 창 · 화면 검사 구현 (WU-16)
 */
import { useEffect, useId, useRef, useState } from 'react';
import { FieldError } from '@/components/common/FieldError';
import { SubmitButton } from '@/components/common/SubmitButton';
import { api, ApiError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { itemUpdate, parseWith, type ParseResult } from '@/lib/validation';
import type { ItemUpdateInput } from '@/lib/validation/schemas';
import type { Item } from '@/types/erp';
import { itemFieldErrorFromApi, itemFieldErrorFromDetail, toIntegerInput, type ItemFieldError } from './ItemForm';
import styles from './items.module.css';

/** 수정 창 칸 값(입력 그대로의 글자). 품목코드 · 재고는 없다. */
export type ItemEditValues = {
  item_name: string;
  unit_cost: string;
  sale_price: string;
  safety_stock: string;
  source_url: string;
};

/** 수정 창의 칸 이름. */
export const ITEM_EDIT_FIELDS = ['item_name', 'unit_cost', 'sale_price', 'safety_stock', 'source_url'] as const;

/** 품목의 지금 값으로 칸을 채운다. */
export function editValuesFrom(item: Item): ItemEditValues {
  return {
    item_name: item.item_name,
    unit_cost: String(item.unit_cost),
    sale_price: String(item.sale_price),
    safety_stock: String(item.safety_stock),
    source_url: item.source_url ?? '',
  };
}

/**
 * 입력 글자를 PATCH 본문으로 바꾸고 itemUpdate로 검사한다. 다섯 칸을 모두 보낸다(바꾼 칸만 고르지 않음).
 * 구매처 메모 빈 값은 null(지움).
 */
export function buildItemUpdateInput(values: ItemEditValues): ParseResult<ItemUpdateInput> {
  return parseWith(itemUpdate, {
    item_name: values.item_name,
    unit_cost: toIntegerInput(values.unit_cost),
    sale_price: toIntegerInput(values.sale_price),
    safety_stock: toIntegerInput(values.safety_stock),
    source_url: values.source_url,
  });
}

/**
 * 품목 수정 창. 열린 품목마다 새로 그리도록 호출부가 `key={item.sku_id}`를 준다.
 *
 * props
 * - item: 고칠 품목(없으면 닫힘)
 * - onClose: [취소] · Escape
 * - onSaved: 서버가 돌려준 고친 품목
 * - onError: 칸 오류가 아닌 실패
 *
 * testid: dialog-edit-item, btn-save-item, field-error-<칸>
 * 부작용: PATCH /api/items/{sku_id}
 */
export function ItemEditDialog({
  item,
  onClose,
  onSaved,
  onError,
}: {
  item: Item | null;
  onClose: () => void;
  onSaved: (item: Item) => void;
  onError: (error: ApiError) => void;
}) {
  const id = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<ItemEditValues | null>(() => (item ? editValuesFrom(item) : null));
  const [fieldError, setFieldError] = useState<ItemFieldError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) firstRef.current?.focus();
  }, [item]);

  useEffect(() => {
    if (!item) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, busy, onClose]);

  if (!item || !values) return null;
  const target = item;
  const current = values;

  const set = (key: keyof ItemEditValues) => (event: { target: { value: string } }) =>
    setValues((prev) => (prev ? { ...prev, [key]: event.target.value } : prev));

  async function save() {
    const parsed = buildItemUpdateInput(current);
    if (!parsed.ok) {
      const local = itemFieldErrorFromDetail(parsed.detail, ITEM_EDIT_FIELDS);
      if (local) setFieldError(local);
      else onError(new ApiError('PF_VALIDATION', { ...parsed.detail }));
      return; // 요청을 보내지 않는다
    }
    setFieldError(null);
    setBusy(true);
    try {
      onSaved(await api.updateItem(target.sku_id, parsed.data));
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('PF_INTERNAL');
      const onField = itemFieldErrorFromApi(apiError, ITEM_EDIT_FIELDS);
      if (onField) setFieldError(onField);
      else onError(apiError);
    } finally {
      setBusy(false);
    }
  }

  const textField = (key: keyof ItemEditValues, label: string, numeric = false) => (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${id}-${key}`}>
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        ref={key === 'item_name' ? firstRef : undefined}
        className={styles.input}
        inputMode={numeric ? 'numeric' : undefined}
        value={current[key]}
        onChange={set(key)}
      />
      {fieldError?.field === key && <FieldError field={key} detail={fieldError.detail} message={fieldError.message} />}
    </div>
  );

  return (
    <div className={styles.overlay}>
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className={styles.dialog} data-testid="dialog-edit-item">
        <h2 id={`${id}-title`} className={styles.sectionTitle}>
          품목 수정
        </h2>
        <form noValidate onSubmit={(event) => event.preventDefault()} className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <span className={styles.label}>품목코드 (바꿀 수 없음)</span>
              <span className={styles.readonly}>{target.sku_id}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.label}>현재 재고 (입출고로만 바뀜)</span>
              <span className={styles.readonly}>{formatNumber(target.stock_qty)}</span>
            </div>
            {textField('item_name', '이름')}
            {textField('unit_cost', '매입단가(원)', true)}
            {textField('sale_price', '판매가(원)', true)}
            {textField('safety_stock', '안전재고', true)}
            {textField('source_url', '구매처 메모(선택)')}
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondary} onClick={onClose} disabled={busy}>
              취소
            </button>
            <SubmitButton testid="btn-save-item" onClick={save}>
              저장
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
