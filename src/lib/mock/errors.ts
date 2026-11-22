/**
 * 오류 응답 목 — 화면이 오류 문구 · 칸 아래 표시를 개발할 때 쓴다.
 *
 * 하는 일
 * 1. 화면 개발용 목이다. NEXT_PUBLIC_USE_MOCK=1일 때만 쓴다(실서버 응답이 아니다).
 * 2. 문구는 messageFor()로 만든다. 문구를 여기서 새로 짓지 않는다(04 4.4 원본: src/lib/api/errors.ts).
 *
 * 근거: docs/04-api-contract.md 3절 · 2절 · 4.3 · WU-04
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 재고 부족 · 입력 오류 응답 목 (WU-04)
 */
import { messageFor } from '@/lib/api/errors';
import type { ApiErrorBody } from '@/types/erp';

/** 재고 부족(409) 응답 예시. PRD-003에 3개 있는데 5개를 출고하려는 경우. */
export const mockInsufficientStockError: ApiErrorBody = {
  error: {
    code: 'PF_INSUFFICIENT_STOCK',
    message: messageFor('PF_INSUFFICIENT_STOCK', { sku_id: 'PRD-003', stock_qty: 3, requested: 5 }),
    detail: { sku_id: 'PRD-003', stock_qty: 3, requested: 5 },
  },
};

/** 입력 검사 실패(400) 응답 예시. 주문 수량이 허용 범위(1~100000)를 벗어남. */
export const mockValidationError: ApiErrorBody = {
  error: {
    code: 'PF_VALIDATION',
    message: messageFor('PF_VALIDATION'),
    detail: { field: 'order_qty', reason: 'out_of_range', min: 1, max: 100000 },
  },
};
