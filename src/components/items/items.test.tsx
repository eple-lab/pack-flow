/**
 * 품목 화면 시험 — 등록 · 수정 입력 검사(보내기 전) · 서버 칸 오류 · 검색 거르기 · 목록 반영 · 표 렌더 · 재고 칸 없음.
 *
 * 하는 일
 * 1. 순수 함수(buildItemCreateInput · buildItemUpdateInput · itemFieldErrorFromApi · filterItems · upsertItem)를
 *    기대값과 비교한다. 실패해야 하는 입력(`8,5` · 음수 · 빈 이름 · 101자)을 넣는다.
 * 2. 폼 · 창 · 표는 react-dom/server renderToString으로 testid · 배지 · "재고 입력 칸 없음"을 본다.
 * 한계: 클릭 · 저장 · 알림 같은 브라우저 동작은 서버 렌더로 못 본다(브라우저 확인).
 *
 * 근거: docs/work-units/WU-16-items.md '다 됐다의 기준', docs/04-api-contract.md 4.2 · 4.3 · 4.4
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  jkspawn  처음 작성 — 품목 화면 시험 (WU-16)
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { createMockApi } from '@/lib/mock';
import { mockItems } from '@/lib/mock/items';
import type { Item } from '@/types/erp';
import { buildItemUpdateInput, editValuesFrom, ItemEditDialog } from './ItemEditDialog';
import { buildItemCreateInput, ITEM_CREATE_FIELDS, ItemForm, itemFieldErrorFromApi, toIntegerInput } from './ItemForm';
import { filterItems, itemHistoryHref, ItemTable } from './ItemTable';
import { upsertItem } from './ItemsView';

const noop = () => {};
const PRD001 = mockItems[0] as Item;
const createValues = {
  sku_id: 'PRD-101',
  item_name: '접이식 박스',
  unit_cost: '8,000',
  sale_price: '15000',
  safety_stock: '5',
  source_url: '',
};

describe('I: 등록 입력 검사 (04 4.2 · 4.3)', () => {
  it('I-01 소문자 품목코드는 대문자로, 쉼표 단가는 정수로, 메모 빈 값은 null', () => {
    expect(buildItemCreateInput({ ...createValues, sku_id: ' prd-101 ' })).toEqual({
      ok: true,
      data: { sku_id: 'PRD-101', item_name: '접이식 박스', unit_cost: 8000, sale_price: 15000, safety_stock: 5, source_url: null },
    });
  });
  it('I-02 (실패해야 함) 단가 `8,5`(소수) → unit_cost not_integer "숫자(정수)로 입력해 주세요"', () => {
    const result = buildItemCreateInput({ ...createValues, unit_cost: '8,5' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toEqual({ field: 'unit_cost', reason: 'not_integer' });
  });
  it('I-03 (실패해야 함) 안전재고 −1 · 빈 이름 · 101자 이름 · 형식 틀린 품목코드', () => {
    const negative = buildItemCreateInput({ ...createValues, safety_stock: '-1' });
    expect(!negative.ok && negative.detail).toEqual({ field: 'safety_stock', reason: 'out_of_range', min: 0, max: 100000 });
    const noName = buildItemCreateInput({ ...createValues, item_name: '  ' });
    expect(!noName.ok && noName.detail).toEqual({ field: 'item_name', reason: 'required' });
    const longName = buildItemCreateInput({ ...createValues, item_name: '가'.repeat(101) });
    expect(!longName.ok && longName.detail).toEqual({ field: 'item_name', reason: 'too_long', max: 100 });
    const badSku = buildItemCreateInput({ ...createValues, sku_id: 'PRD 101' });
    expect(!badSku.ok && badSku.detail).toEqual({ field: 'sku_id', reason: 'bad_format' });
  });
  it('I-04 서버 PF_DUPLICATE_SKU → 품목코드 칸 아래 "이미 있는 품목코드예요 (PRD-001)"', () => {
    const state = itemFieldErrorFromApi(new ApiError('PF_DUPLICATE_SKU', { sku_id: 'PRD-001' }, 409), ITEM_CREATE_FIELDS);
    expect(state).toEqual({ field: 'sku_id', message: '이미 있는 품목코드예요 (PRD-001)' });
  });
  it('I-05 (실패해야 함) 칸 오류가 아닌 서버 오류는 null → 배너', () => {
    expect(itemFieldErrorFromApi(new ApiError('PF_INTERNAL', null, 500), ITEM_CREATE_FIELDS)).toBeNull();
    expect(
      itemFieldErrorFromApi(new ApiError('PF_VALIDATION', { field: 'stock_qty', reason: 'not_allowed_field' }, 400), ITEM_CREATE_FIELDS),
    ).toBeNull();
  });
});

describe('N: 숫자 칸 쉼표 (toIntegerInput)', () => {
  it('N-01 천 단위 쉼표 · 공백은 지워 정수로', () => {
    expect(toIntegerInput('1,000')).toBe(1000);
    expect(toIntegerInput('12,000,000')).toBe(12000000);
    expect(toIntegerInput(' 8 000 ')).toBe(8000);
    expect(toIntegerInput('')).toBe('');
  });
  it('N-02 (실패해야 함) 천 단위가 아닌 쉼표는 글자 그대로(스키마가 not_integer)', () => {
    for (const text of ['8,5', '1,00', '10,0000', ',100']) expect(toIntegerInput(text)).toBe(text);
  });
});

describe('U: 수정 입력 검사', () => {
  it('U-01 지금 값으로 칸을 채우고, 안전재고 5 → 20은 통과(다섯 칸 모두 보냄, 품목코드 · 재고 없음)', () => {
    const values = { ...editValuesFrom(PRD001), safety_stock: '20' };
    const result = buildItemUpdateInput(values);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.safety_stock).toBe(20);
      expect(Object.keys(result.data).sort()).toEqual(['item_name', 'safety_stock', 'sale_price', 'source_url', 'unit_cost']);
    }
  });
  it('U-02 구매처 메모를 비우면 null(지움)', () => {
    const result = buildItemUpdateInput({ ...editValuesFrom(PRD001), source_url: ' ' });
    expect(result.ok && result.data.source_url).toBeNull();
  });
  it('U-03 (실패해야 함) 수정에서도 단가 `8,5` → not_integer, 빈 이름 → required', () => {
    const decimal = buildItemUpdateInput({ ...editValuesFrom(PRD001), sale_price: '8,5' });
    expect(!decimal.ok && decimal.detail).toEqual({ field: 'sale_price', reason: 'not_integer' });
    const noName = buildItemUpdateInput({ ...editValuesFrom(PRD001), item_name: '' });
    expect(!noName.ok && noName.detail).toMatchObject({ field: 'item_name', reason: 'required' });
  });
});

describe('L: 검색 · 목록 반영', () => {
  it('L-01 검색은 코드 · 이름, 대소문자 무시', () => {
    expect(filterItems(mockItems, 'prd-00').map((i) => i.sku_id)).toEqual(['PRD-001', 'PRD-002', 'PRD-003']);
    expect(filterItems(mockItems, '마우스').map((i) => i.sku_id)).toEqual(['PRD-001']);
    expect(filterItems(mockItems, '  ')).toHaveLength(3);
  });
  it('L-02 (실패해야 함) 맞는 품목이 없으면 빈 목록 + EmptyState 문구', () => {
    expect(filterItems(mockItems, 'zzz')).toEqual([]);
    const html = renderToString(<ItemTable items={[]} query="zzz" onEdit={noop} />);
    expect(html).toContain('data-testid="items-empty"');
    expect(html).toContain('&#x27;zzz&#x27;에 맞는 품목이 없어요');
  });
  it('L-03 새 품목은 맨 위에 붙고, 같은 품목코드는 그 자리를 바꾼다', () => {
    const created = { ...PRD001, sku_id: 'PRD-101', stock_qty: 0 };
    expect(upsertItem(mockItems, created).map((i) => i.sku_id)).toEqual(['PRD-101', 'PRD-001', 'PRD-002', 'PRD-003']);
    const edited = { ...PRD001, safety_stock: 20, below_safety: true };
    const after = upsertItem(mockItems, edited);
    expect(after).toHaveLength(3);
    expect(after[0]).toEqual(edited);
  });
  it('L-04 목 등록 응답은 재고 0(새 품목은 재고 0으로 시작)', async () => {
    const parsed = buildItemCreateInput(createValues);
    if (!parsed.ok) throw new Error('입력이 막혔다');
    const item = await createMockApi().createItem(parsed.data);
    expect(item.sku_id).toBe('PRD-101');
    expect(item.stock_qty).toBe(0);
  });
});

describe('R: 렌더 (testid · 배지 · 재고 칸 없음)', () => {
  it('R-01 표: 행 · 재고 칸 값 그대로, PRD-003 미만 배지 · PRD-001 배지 없음(실패해야 함), 수정 · 이력 링크', () => {
    const html = renderToString(<ItemTable items={mockItems} query="" onEdit={noop} />);
    for (const sku of ['PRD-001', 'PRD-002', 'PRD-003']) {
      expect(html).toContain(`data-testid="item-row-${sku}"`);
      expect(html).toContain(`data-testid="btn-edit-item-${sku}"`);
    }
    expect(html).toMatch(/data-testid="item-stock-PRD-002"[^>]*>40</);
    expect(html).toContain('data-testid="item-badge-PRD-003"');
    expect(html).not.toContain('item-badge-PRD-001');
    expect(html).toContain(`href="${itemHistoryHref('PRD-001')}"`);
  });
  it('R-02 구매처 메모는 글자로만 — 링크(href)로 열지 않는다', () => {
    const memo = 'https://example.test/shop?id=1';
    const html = renderToString(<ItemTable items={[{ ...PRD001, source_url: memo }]} query="" onEdit={noop} />);
    expect(html).toContain(memo.replace(/&/g, '&amp;'));
    expect(html).not.toContain(`href="${memo}`);
  });
  it('R-03 등록 폼: testid, 입력 칸 6개(재고 칸 없음)', () => {
    const html = renderToString(<ItemForm onCreated={noop} onError={noop} />);
    expect(html).toContain('data-testid="form-item"');
    expect(html).toContain('data-testid="btn-submit-item"');
    expect(html.match(/<input/g)).toHaveLength(6);
    expect(html).not.toMatch(/재고 수량|stock_qty/);
  });
  it('R-04 수정 창: testid, 품목코드 · 재고는 글자, 입력 칸 5개(품목코드 · 재고 칸 없음). 품목이 없으면 닫힘', () => {
    const html = renderToString(<ItemEditDialog item={PRD001} onClose={noop} onSaved={noop} onError={noop} />);
    expect(html).toContain('data-testid="dialog-edit-item"');
    expect(html).toContain('data-testid="btn-save-item"');
    expect(html.match(/<input/g)).toHaveLength(5);
    expect(html).not.toContain('value="PRD-001"');
    expect(renderToString(<ItemEditDialog item={null} onClose={noop} onSaved={noop} onError={noop} />)).toBe('');
  });
});
