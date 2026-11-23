/**
 * draft-po-form.ts 단위 테스트 — 발주서 줄의 수정 칸을 확정 요청으로 바꾸는 순수 함수.
 *
 * 하는 일
 * 1. 기대 결과(보낼 값 · 칸 오류 · 알림 문구)를 먼저 적고 비교한다(D-34).
 * 2. 일부러 실패해야 하는 경우(수량 0 · 소수 · 쉼표 소수 · 10만 초과 · 빈 거래처)를 넣는다.
 *
 * 근거: docs/work-units/WU-33-draft-po.md 3 · 4번 · docs/04-api-contract.md 4.2 · 4.3
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  skygaul  처음 작성 — 수정 칸 검사 · 확정 알림 문구 시험 (WU-33)
 */
import { describe, expect, it } from 'vitest';
import type { PoDraftLine } from '@/types/agent';
import type { Purchase } from '@/types/erp';
import { buildConfirmLines, confirmMessage, estimateCost, rowsFromDraft } from './draft-po-form';

const LINE: PoDraftLine = {
  sku_id: 'PRD-003',
  item_name: '노트북 거치대',
  stock_qty: 3,
  safety_stock: 4,
  recommended_qty: 6,
  unit_cost: 12000,
  supplier: '가나물산',
  basis: '최근 7일 출고 12개(하루 1.7개), 입고 예정 0개, 안전재고 4개 기준',
};

describe('F: 수정 칸 → 확정 줄', () => {
  it('F-1 처음 값은 표 그대로: 수량 = 추천 수량, 거래처 = 계산된 거래처', () => {
    expect(rowsFromDraft([LINE])).toEqual([
      { sku_id: 'PRD-003', item_name: '노트북 거치대', unit_cost: 12000, qty: '6', supplier: '가나물산' },
    ]);
  });

  it('F-2 고치지 않으면 추천 수량 · 단가 × 수량 금액으로 보낸다', () => {
    const result = buildConfirmLines(rowsFromDraft([LINE]));
    expect(result).toEqual({
      ok: true,
      lines: [{ sku_id: 'PRD-003', supplier: '가나물산', order_qty: 6, purchase_cost: 72000 }],
    });
  });

  it('F-3 수량 · 거래처를 고친 값으로 보낸다(쉼표 천 단위 · 앞뒤 공백 정리)', () => {
    const rows = rowsFromDraft([LINE]).map((r) => ({ ...r, qty: ' 1,000 ', supplier: '  다라무역 ' }));
    expect(buildConfirmLines(rows)).toEqual({
      ok: true,
      lines: [{ sku_id: 'PRD-003', supplier: '다라무역', order_qty: 1000, purchase_cost: 12_000_000 }],
    });
  });

  it('F-4 (실패해야 함) 수량 0은 칸 아래 범위 오류(1 ~ 100,000), 요청에 들어가지 않는다', () => {
    const rows = rowsFromDraft([LINE]).map((r) => ({ ...r, qty: '0' }));
    expect(buildConfirmLines(rows)).toEqual({
      ok: false,
      errors: { 'PRD-003': { field: 'order_qty', detail: { reason: 'out_of_range', min: 1, max: 100000 } } },
    });
  });

  it('F-5 (실패해야 함) 소수 `1.5` · 쉼표 소수 `8,5` · 글자는 정수 오류', () => {
    for (const qty of ['1.5', '8,5', 'abc']) {
      const rows = rowsFromDraft([LINE]).map((r) => ({ ...r, qty }));
      const result = buildConfirmLines(rows);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors['PRD-003']).toMatchObject({ field: 'order_qty', detail: { reason: 'not_integer' } });
    }
  });

  it('F-6 (실패해야 함) 빈 수량은 필수, 10만 초과는 범위 오류', () => {
    const empty = buildConfirmLines(rowsFromDraft([LINE]).map((r) => ({ ...r, qty: '  ' })));
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.errors['PRD-003']?.field).toBe('order_qty');

    const big = buildConfirmLines(rowsFromDraft([LINE]).map((r) => ({ ...r, qty: '100001' })));
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.errors['PRD-003']).toMatchObject({ field: 'order_qty', detail: { reason: 'out_of_range' } });
  });

  it('F-7 (실패해야 함) 금액이 10억을 넘는 수량은 수량 칸 아래 범위 오류', () => {
    const rows = rowsFromDraft([{ ...LINE, unit_cost: 1_000_000_000 }]).map((r) => ({ ...r, qty: '2' }));
    const result = buildConfirmLines(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors['PRD-003']?.field).toBe('order_qty');
  });

  it('F-8 (실패해야 함) 빈 거래처는 거래처 칸 아래 필수 오류', () => {
    const rows = rowsFromDraft([LINE]).map((r) => ({ ...r, supplier: '   ' }));
    const result = buildConfirmLines(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors['PRD-003']).toMatchObject({ field: 'supplier', detail: { reason: 'required' } });
  });

  it('F-9 한 줄만 틀려도 전체를 막고, 틀린 줄의 오류만 돌려준다', () => {
    const other = { ...LINE, sku_id: 'PRD-002', item_name: 'USB-C 케이블', unit_cost: 2000, recommended_qty: 20 };
    const rows = rowsFromDraft([LINE, other]);
    rows[1] = { ...rows[1]!, qty: '0' };
    const result = buildConfirmLines(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(['PRD-002']);
  });
});

describe('M: 금액 · 알림 문구', () => {
  it('M-1 예상 금액은 정수 수량일 때만 단가 × 수량, 아니면 null', () => {
    expect(estimateCost(12000, '6')).toBe(72000);
    expect(estimateCost(12000, '1,000')).toBe(12_000_000);
    expect(estimateCost(12000, '1.5')).toBeNull();
    expect(estimateCost(12000, '')).toBeNull();
  });

  it('M-2 확정 알림: 한 건이면 "P-105 발주완료 1건", 여러 건이면 번호를 모두 적는다', () => {
    const p = (n: number) => ({ purchase_id: `P-${100 + n}` }) as Purchase;
    expect(confirmMessage([p(5)])).toBe('P-105 발주완료 1건');
    expect(confirmMessage([p(5), p(6)])).toBe('P-105 · P-106 발주완료 2건');
  });
});
