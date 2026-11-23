'use client';

/**
 * 판매 등록 폼 — 품목(목록에서 선택) · 채널 · 수량 · 금액 · 송장번호(선택) → POST /api/sales.
 *
 * 하는 일
 * 1. 보내기 전에 saleCreate 스키마로 검사하고, 틀린 칸 아래 FieldError(04 4.3). 그때는 요청을 보내지 않는다.
 * 2. 숫자 칸의 쉼표 · 공백은 지우고 정수로, 송장번호를 비우면 null로 보낸다 — null끼리는 중복이 아니다(T-VAL-1).
 * 3. 서버가 칸 오류로 거부해도 같은 칸 아래에, 그 밖은 onError로 배너에.
 * 4. 성공하면 폼을 비우고 첫 칸에 커서, 실패하면 입력값을 그대로 둔다(04 4.6).
 *
 * 근거: docs/04-api-contract.md 3.4 · 4.1~4.6, docs/work-units/WU-12-trades.md 5번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-12
 * 2026-11-23  jkspawn  판매 등록 폼 · 화면 검사 · 칸 아래 오류 구현 (WU-12)
 */
import { useId, useRef, useState } from 'react';
import { FieldError } from '@/components/common/FieldError';
import { SubmitButton } from '@/components/common/SubmitButton';
import { api, ApiError } from '@/lib/api-client';
import { parseWith, saleCreate, toUpperSku, type ParseResult } from '@/lib/validation';
import type { SaleCreateInput } from '@/lib/validation/schemas';
import type { Item, Sale } from '@/types/erp';
import { fieldErrorFromApi, fieldErrorFromDetail, toIntegerInput, type FieldErrorState } from './form-utils';
import styles from './trades.module.css';

/** 폼 칸 값(입력 그대로의 글자). */
export type SaleFormValues = {
  sku_id: string;
  channel: string;
  sold_qty: string;
  sale_amount: string;
  invoice_no: string;
};

/** 이 폼의 칸 이름 — 서버 detail.field가 이 중 하나면 칸 아래에 보인다. */
export const SALE_FIELDS = ['sku_id', 'channel', 'sold_qty', 'sale_amount', 'invoice_no'] as const;

const EMPTY: SaleFormValues = { sku_id: '', channel: '', sold_qty: '', sale_amount: '', invoice_no: '' };

/**
 * 입력 글자를 보낼 값으로 바꾸고 saleCreate로 검사한다(화면 · 서버 같은 스키마 — 04 4절).
 */
export function buildSaleInput(values: SaleFormValues): ParseResult<SaleCreateInput> {
  return parseWith(saleCreate, {
    sku_id: toUpperSku(values.sku_id),
    channel: values.channel,
    sold_qty: toIntegerInput(values.sold_qty),
    sale_amount: toIntegerInput(values.sale_amount),
    invoice_no: values.invoice_no,
  });
}

/**
 * 판매 등록 폼.
 *
 * props
 * - items: 품목 선택 목록(`GET /api/items`)
 * - onCreated: 등록 성공 뒤 새 판매와 함께 부른다
 * - onError: 칸 오류가 아닌 실패(배너로 보낼 것)
 *
 * testid: form-sale, btn-submit-sale, field-error-<칸>
 * 부작용: POST /api/sales
 */
export function SaleForm({
  items,
  onCreated,
  onError,
}: {
  items: Item[];
  onCreated: (sale: Sale) => void;
  onError: (error: ApiError) => void;
}) {
  const id = useId();
  const firstRef = useRef<HTMLSelectElement>(null);
  const [values, setValues] = useState<SaleFormValues>(EMPTY);
  const [fieldError, setFieldError] = useState<FieldErrorState | null>(null);

  const set = (key: keyof SaleFormValues) => (event: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit() {
    const parsed = buildSaleInput(values);
    if (!parsed.ok) {
      const local = fieldErrorFromDetail(parsed.detail, SALE_FIELDS);
      if (local) setFieldError(local);
      else onError(new ApiError('PF_VALIDATION', { ...parsed.detail }));
      return; // 요청을 보내지 않는다
    }
    setFieldError(null);
    try {
      const sale = await api.createSale(parsed.data);
      setValues(EMPTY);
      firstRef.current?.focus();
      onCreated(sale);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('PF_INTERNAL');
      const onField = fieldErrorFromApi(apiError, SALE_FIELDS);
      if (onField) setFieldError(onField);
      else onError(apiError);
    }
  }

  const errorFor = (field: string) =>
    fieldError?.field === field ? <FieldError field={field} detail={fieldError.detail} message={fieldError.message} /> : null;

  return (
    <form className={styles.form} data-testid="form-sale" noValidate onSubmit={(event) => event.preventDefault()}>
      <h2 className={styles.sectionTitle}>판매 등록</h2>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-sku`}>
            품목
          </label>
          <select id={`${id}-sku`} ref={firstRef} className={styles.input} value={values.sku_id} onChange={set('sku_id')}>
            <option value="">품목 선택</option>
            {items.map((item) => (
              <option key={item.sku_id} value={item.sku_id}>
                {item.sku_id} {item.item_name}
              </option>
            ))}
          </select>
          {errorFor('sku_id')}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-channel`}>
            채널
          </label>
          <input id={`${id}-channel`} className={styles.input} value={values.channel} onChange={set('channel')} />
          {errorFor('channel')}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-qty`}>
            수량
          </label>
          <input
            id={`${id}-qty`}
            className={styles.input}
            inputMode="numeric"
            value={values.sold_qty}
            onChange={set('sold_qty')}
          />
          {errorFor('sold_qty')}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-amount`}>
            금액(원)
          </label>
          <input
            id={`${id}-amount`}
            className={styles.input}
            inputMode="numeric"
            value={values.sale_amount}
            onChange={set('sale_amount')}
          />
          {errorFor('sale_amount')}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-invoice`}>
            송장번호(선택)
          </label>
          <input id={`${id}-invoice`} className={styles.input} value={values.invoice_no} onChange={set('invoice_no')} />
          {errorFor('invoice_no')}
        </div>
      </div>
      <div className={styles.formActions}>
        <SubmitButton testid="btn-submit-sale" onClick={submit}>
          판매 등록
        </SubmitButton>
      </div>
    </form>
  );
}
