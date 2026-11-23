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
import {
  buildConfirmLines,
  confirmMessage,
  doneMessage,
  estimateCost,
  mergePartial,
  partialSaveMessage,
  partialSaveOf,
  remainingRows,
  rowsFromDraft,
} from './draft-po-form';

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

describe('S: 확정 중간 실패(일부 저장) — 중복 발주 방지', () => {
  const LINE_B: PoDraftLine = { ...LINE, sku_id: 'PRD-002', item_name: 'USB-C 케이블', unit_cost: 2000, recommended_qty: 20 };
  const LINE_C: PoDraftLine = { ...LINE, sku_id: 'PRD-001', item_name: '무선 마우스', unit_cost: 8000, recommended_qty: 5 };

  it('S-1 서버 오류의 detail에서 저장된 건수와 번호를 읽는다', () => {
    expect(partialSaveOf({ saved_count: 2, saved: ['P-105', 'P-106'] })).toEqual({ count: 2, ids: ['P-105', 'P-106'] });
    // 원래 오류의 detail이 같이 있어도 읽는다
    expect(partialSaveOf({ invoice_no: 'X-1', saved_count: 1, saved: ['P-105'] })).toEqual({ count: 1, ids: ['P-105'] });
  });

  it('S-2 (실패해야 함) 저장된 것이 없거나 모양이 틀리면 null — 그때는 표를 그대로 둔다', () => {
    expect(partialSaveOf(null)).toBeNull();
    expect(partialSaveOf(undefined)).toBeNull();
    expect(partialSaveOf({})).toBeNull();
    expect(partialSaveOf({ saved_count: 0, saved: [] })).toBeNull();
    expect(partialSaveOf({ saved_count: -1, saved: [] })).toBeNull();
    expect(partialSaveOf({ saved_count: 1.5, saved: ['P-105'] })).toBeNull();
    expect(partialSaveOf({ saved_count: '2', saved: ['P-105'] })).toBeNull();
    expect(partialSaveOf({ field: 'order_qty', reason: 'out_of_range' })).toBeNull(); // 일반 PF_VALIDATION
  });

  it('S-3 번호 목록이 이상해도 건수는 믿고, 글자가 아닌 번호만 버린다', () => {
    expect(partialSaveOf({ saved_count: 2, saved: ['P-105', 7, null] })).toEqual({ count: 2, ids: ['P-105'] });
    expect(partialSaveOf({ saved_count: 2 })).toEqual({ count: 2, ids: [] });
  });

  it('S-4 저장된 앞 줄을 표에서 빼고 남은 줄은 그대로(수정한 값 유지)', () => {
    const rows = rowsFromDraft([LINE, LINE_B, LINE_C]).map((row, index) => (index === 2 ? { ...row, qty: '7' } : row));
    const left = remainingRows(rows, 2);
    expect(left.map((row) => row.sku_id)).toEqual(['PRD-001']);
    expect(left[0]?.qty).toBe('7');
  });

  it('S-5 (실패해야 함) 건수가 줄 수보다 많거나 0 이하여도 안전하게 자른다', () => {
    const rows = rowsFromDraft([LINE, LINE_B]);
    expect(remainingRows(rows, 0).map((row) => row.sku_id)).toEqual(['PRD-003', 'PRD-002']);
    expect(remainingRows(rows, 5)).toEqual([]);
  });

  it('S-6 안내 문구: 저장된 번호 · 남은 건수 · 다시 누르면 남은 줄만 등록됨', () => {
    const text = partialSaveMessage({ count: 2, ids: ['P-105', 'P-106'] }, 1);
    expect(text).toContain('P-105 · P-106');
    expect(text).toContain('2건');
    expect(text).toContain('남은 1건');
    expect(text).toContain('남은 줄만');
  });

  it('S-7 번호를 모를 때도 건수만으로 문구를 만든다', () => {
    const text = partialSaveMessage({ count: 1, ids: [] }, 2);
    expect(text).toContain('앞 1건');
    expect(text).toContain('남은 2건');
    expect(text).not.toContain('()');
  });

  it('S-8 다시 눌렀는데 또 일부만 저장되면 건수 · 번호를 합쳐 이미 저장된 전체를 알려 준다', () => {
    const first = { count: 1, ids: ['P-105'] };
    expect(mergePartial(null, first)).toEqual(first);
    expect(mergePartial(first, { count: 2, ids: ['P-106', 'P-107'] })).toEqual({ count: 3, ids: ['P-105', 'P-106', 'P-107'] });
  });

  it('S-9 일부 저장된 뒤 남은 줄이 성공하면 알림에 앞서 저장된 건수를 함께 적는다', () => {
    const p = (n: number) => ({ purchase_id: `P-${100 + n}` }) as Purchase;
    expect(doneMessage([p(7)], null)).toBe('P-107 발주완료 1건');
    const text = doneMessage([p(7)], { count: 2, ids: ['P-105', 'P-106'] });
    expect(text).toContain('P-107 발주완료 1건');
    expect(text).toContain('앞서 저장된 2건');
    expect(text).toContain('모두 3건');
  });
});
