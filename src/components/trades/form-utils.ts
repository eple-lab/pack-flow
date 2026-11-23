/**
 * 입출고 폼 · 버튼이 같이 쓰는 순수 함수 — 칸 오류 고르기 · 재고 변화 알림 문구 · 오류 나눔.
 *
 * 하는 일
 * 1. 화면 검사(parseWith) 실패나 서버 PF_VALIDATION · PF_DUPLICATE_INVOICE를 "어느 칸 아래에 무슨 문구"로 바꾼다(04 4.4).
 *    폼에 없는 칸이면 null을 돌려 배너로 보내게 한다.
 * 2. 성공 알림 "PRD-001 재고 10 → 4" 문구를 만든다. 숫자는 목록 값(전)과 서버 응답 stock_qty(후)를 그대로 쓴다.
 * 3. 'use client'가 없다 — 단위 시험에서 바로 부른다.
 *
 * 근거: docs/04-api-contract.md 4.3 · 4.4 · 4.6, docs/work-units/WU-12-trades.md 6 · 7번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  jkspawn  처음 작성 — 칸 오류 · 재고 변화 문구 (WU-12)
 */
import type { ApiError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import type { ValidationDetail } from '@/types/erp';

/** 칸 아래 오류 하나. detail이면 FieldError가 4.3 문구를 만들고, message면 그대로 보인다. */
export type FieldErrorState =
  | { field: string; detail: Pick<ValidationDetail, 'reason' | 'min' | 'max'>; message?: undefined }
  | { field: string; message: string; detail?: undefined };

/** 화면 검사 실패 detail → 칸 오류. 폼에 없는 칸(body · 계약 밖 필드)이면 null(배너로). */
export function fieldErrorFromDetail(detail: ValidationDetail, fields: readonly string[]): FieldErrorState | null {
  if (detail.reason === 'not_allowed_field' || !fields.includes(detail.field)) return null;
  return { field: detail.field, detail: { reason: detail.reason, min: detail.min, max: detail.max } };
}

/**
 * 서버 오류 → 칸 오류(04 4.4 '어디에' 열). 칸 오류가 아니면 null — 호출부가 ErrorBanner로 보낸다.
 * - PF_VALIDATION: detail.field가 이 폼의 칸이면 그 칸 아래(4.3 문구)
 * - PF_DUPLICATE_INVOICE: 송장번호 칸 아래(서버 문구 그대로)
 */
export function fieldErrorFromApi(error: ApiError, fields: readonly string[]): FieldErrorState | null {
  if (error.code === 'PF_DUPLICATE_INVOICE' && fields.includes('invoice_no')) {
    return { field: 'invoice_no', message: error.message };
  }
  if (error.code === 'PF_VALIDATION' && error.detail) {
    const { field, reason, min, max } = error.detail as Partial<ValidationDetail>;
    if (typeof field === 'string' && typeof reason === 'string') {
      return fieldErrorFromDetail(
        {
          field,
          reason,
          ...(typeof min === 'number' ? { min } : {}),
          ...(typeof max === 'number' ? { max } : {}),
        },
        fields,
      );
    }
  }
  return null;
}

/**
 * 재고가 바뀐 작업의 알림 문구. 예: "S-201 출고 — PRD-001 재고 10 → 4".
 * @param before 작업 전 목록의 stock_qty (모르면 null — 그때는 "재고 4"만)
 * @param after 서버 응답의 stock_qty
 */
export function stockChangeMessage(action: string, sku_id: string, before: number | null, after: number): string {
  const stock = before === null ? `재고 ${formatNumber(after)}` : `재고 ${formatNumber(before)} → ${formatNumber(after)}`;
  return `${action} — ${sku_id} ${stock}`;
}
