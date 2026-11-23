'use client';

/**
 * 품목 등록 폼 — 품목코드 · 이름 · 매입단가 · 판매가 · 안전재고 · 구매처 메모(선택) → POST /api/items.
 *
 * 하는 일
 * 1. 품목코드는 입력하는 동안 대문자로 바꾼다. 보내기 전에 itemCreate 스키마로 검사하고 틀린 칸 아래 FieldError.
 * 2. 숫자 칸의 쉼표 · 공백은 지우고 정수로, 구매처 메모를 비우면 null(04 4.1 — 스키마가 처리).
 * 3. 재고 수량 칸은 없다 — 재고는 이력의 합이고 새 품목은 재고 0으로 시작한다(01 6절, 서버도 stock_qty를 400으로 거부).
 * 4. 서버 칸 오류(PF_DUPLICATE_SKU → 품목코드 칸, PF_VALIDATION의 field)는 같은 칸 아래, 그 밖은 onError로 배너.
 *
 * 근거: docs/04-api-contract.md 3.2 · 4.1~4.4, docs/wireframes.html 5.4절, docs/work-units/WU-16-items.md 2 · 4번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-16
 * 2026-11-23  jkspawn  품목 등록 폼 · 화면 검사 · 칸 아래 오류 구현 (WU-16)
 */
import { useId, useRef, useState } from 'react';
import { FieldError } from '@/components/common/FieldError';
import { SubmitButton } from '@/components/common/SubmitButton';
import { api, ApiError } from '@/lib/api-client';
import { itemCreate, parseWith, toNumberInput, toUpperSku, type ParseResult } from '@/lib/validation';
import type { ItemCreateInput } from '@/lib/validation/schemas';
import type { Item, ValidationDetail } from '@/types/erp';
import styles from './items.module.css';

// ── 칸 오류 (등록 폼 · 수정 창이 같이 쓴다) ─────────────────────────────

/** 칸 아래 오류 하나. detail이면 FieldError가 4.3 문구를, message면 그대로 보인다. */
export type ItemFieldError = {
  field: string;
  detail?: Pick<ValidationDetail, 'reason' | 'min' | 'max'>;
  message?: string;
};

/** 검사 실패 detail → 칸 오류. 폼에 없는 칸(body · 계약 밖 필드)이면 null(배너로). */
export function itemFieldErrorFromDetail(detail: ValidationDetail, fields: readonly string[]): ItemFieldError | null {
  if (detail.reason === 'not_allowed_field' || !fields.includes(detail.field)) return null;
  return { field: detail.field, detail: { reason: detail.reason, min: detail.min, max: detail.max } };
}

/**
 * 서버 오류 → 칸 오류(04 4.4 '어디에' 열). 칸 오류가 아니면 null — 호출부가 ErrorBanner로 보낸다.
 * - PF_DUPLICATE_SKU: 품목코드 칸 아래(서버 문구 그대로, 04 4.4 · wireframes 5.4)
 * - PF_VALIDATION: detail.field가 이 폼의 칸이면 그 칸 아래
 */
export function itemFieldErrorFromApi(error: ApiError, fields: readonly string[]): ItemFieldError | null {
  if (error.code === 'PF_DUPLICATE_SKU' && fields.includes('sku_id')) return { field: 'sku_id', message: error.message };
  if (error.code === 'PF_VALIDATION' && error.detail) {
    const { field, reason, min, max } = error.detail as Partial<ValidationDetail>;
    if (typeof field === 'string' && typeof reason === 'string') {
      return itemFieldErrorFromDetail(
        { field, reason, ...(typeof min === 'number' ? { min } : {}), ...(typeof max === 'number' ? { max } : {}) },
        fields,
      );
    }
  }
  return null;
}

// ── 숫자 칸 ────────────────────────────────────────────────────────────

/** 천 단위 쉼표가 바르게 찍힌 정수(예: 1,000 · 12,000). */
const THOUSANDS = /^-?\d{1,3}(,\d{3})+$/;

/**
 * 숫자 칸 입력을 보낼 값으로 바꾼다. 쉼표는 천 단위 자리에 있을 때만 지운다.
 * `8,5`처럼 천 단위가 아닌 쉼표(소수 뜻)는 글자 그대로 넘겨 스키마가 not_integer로 막게 한다
 * — toNumberInput은 쉼표를 모두 지워 85로 통과시키기 때문이다(WU-16 다 됐다 6번, wireframes 5.4).
 */
export function toIntegerInput(text: string): number | string {
  const compact = text.replace(/\s/g, '');
  if (compact.includes(',') && !THOUSANDS.test(compact)) return text;
  return toNumberInput(text);
}

// ── 등록 폼 ────────────────────────────────────────────────────────────

/** 폼 칸 값(입력 그대로의 글자). 재고 칸은 없다. */
export type ItemFormValues = {
  sku_id: string;
  item_name: string;
  unit_cost: string;
  sale_price: string;
  safety_stock: string;
  source_url: string;
};

/** 등록 폼의 칸 이름. */
export const ITEM_CREATE_FIELDS = ['sku_id', 'item_name', 'unit_cost', 'sale_price', 'safety_stock', 'source_url'] as const;

const EMPTY: ItemFormValues = { sku_id: '', item_name: '', unit_cost: '', sale_price: '', safety_stock: '', source_url: '' };

/**
 * 입력 글자를 보낼 값으로 바꾸고 itemCreate로 검사한다(화면 · 서버 같은 스키마 — 04 4절).
 * 품목코드는 대문자, 숫자는 쉼표 · 공백 제거 후 정수, 구매처 메모 빈 값은 null.
 */
export function buildItemCreateInput(values: ItemFormValues): ParseResult<ItemCreateInput> {
  return parseWith(itemCreate, {
    sku_id: toUpperSku(values.sku_id),
    item_name: values.item_name,
    unit_cost: toIntegerInput(values.unit_cost),
    sale_price: toIntegerInput(values.sale_price),
    safety_stock: toIntegerInput(values.safety_stock),
    source_url: values.source_url,
  });
}

/**
 * 품목 등록 폼.
 *
 * props
 * - onCreated: 등록 성공 뒤 서버가 돌려준 새 품목(재고 0)과 함께 부른다
 * - onError: 칸 오류가 아닌 실패(배너로 보낼 것)
 *
 * testid: form-item, btn-submit-item, field-error-<칸>
 * 부작용: POST /api/items
 */
export function ItemForm({ onCreated, onError }: { onCreated: (item: Item) => void; onError: (error: ApiError) => void }) {
  const id = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<ItemFormValues>(EMPTY);
  const [fieldError, setFieldError] = useState<ItemFieldError | null>(null);

  const set = (key: keyof ItemFormValues) => (event: { target: { value: string } }) => {
    // 품목코드는 입력 중 대문자로(WU-16 입력 처리)
    const value = key === 'sku_id' ? event.target.value.toUpperCase() : event.target.value;
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  async function submit() {
    const parsed = buildItemCreateInput(values);
    if (!parsed.ok) {
      const local = itemFieldErrorFromDetail(parsed.detail, ITEM_CREATE_FIELDS);
      if (local) setFieldError(local);
      else onError(new ApiError('PF_VALIDATION', { ...parsed.detail }));
      return; // 요청을 보내지 않는다
    }
    setFieldError(null);
    try {
      const item = await api.createItem(parsed.data);
      setValues(EMPTY);
      firstRef.current?.focus();
      onCreated(item);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('PF_INTERNAL');
      const onField = itemFieldErrorFromApi(apiError, ITEM_CREATE_FIELDS);
      if (onField) setFieldError(onField);
      else onError(apiError);
    }
  }

  const errorFor = (field: string) =>
    fieldError?.field === field ? <FieldError field={field} detail={fieldError.detail} message={fieldError.message} /> : null;

  const textField = (key: keyof ItemFormValues, label: string, numeric = false, hint?: string) => (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${id}-${key}`}>
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        ref={key === 'sku_id' ? firstRef : undefined}
        className={styles.input}
        inputMode={numeric ? 'numeric' : undefined}
        value={values[key]}
        onChange={set(key)}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
      {errorFor(key)}
    </div>
  );

  return (
    <form className={styles.form} data-testid="form-item" noValidate onSubmit={(event) => event.preventDefault()}>
      <h2 className={styles.sectionTitle}>품목 등록</h2>
      <div className={styles.formGrid}>
        {textField('sku_id', '품목코드', false, '영문 대문자 · 숫자 · 하이픈 (예: PRD-101)')}
        {textField('item_name', '이름')}
        {textField('unit_cost', '매입단가(원)', true)}
        {textField('sale_price', '판매가(원)', true)}
        {textField('safety_stock', '안전재고', true)}
        {textField('source_url', '구매처 메모(선택)')}
      </div>
      <div className={styles.formActions}>
        <SubmitButton testid="btn-submit-item" onClick={submit}>
          등록
        </SubmitButton>
      </div>
    </form>
  );
}
