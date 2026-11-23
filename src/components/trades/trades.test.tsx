/**
 * 입출고 화면 시험 — 쿼리 읽기 · 폼 검사(보내기 전) · 칸 오류 · 알림 문구 · 표 렌더(testid · 버튼 · 배지).
 *
 * 하는 일
 * 1. 순수 함수(parseTradesQuery · buildPurchaseInput · buildSaleInput · buildReceiveInput · fieldErrorFromApi ·
 *    stockChangeMessage)를 기대값과 비교한다. 실패해야 하는 입력(0 · 소수 · 10만 초과 · 탭에 안 맞는 상태)을 넣는다.
 * 2. 표 · 폼 · 입고 확정 창은 react-dom/server renderToString으로 testid · 버튼 표시 · '부분 입고' 배지를 본다.
 * 한계: 클릭 · 요청 · 알림 같은 브라우저 동작은 서버 렌더로 못 본다(브라우저 확인 · E2E step1.spec.ts).
 *
 * 근거: docs/work-units/WU-12-trades.md '다 됐다의 기준', docs/04-api-contract.md 4.2 · 4.3 · 4.4
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  jkspawn  처음 작성 — 입출고 화면 시험 (WU-12)
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FieldError } from '@/components/common/FieldError';
import { ApiError } from '@/lib/api-client';
import { mockItems } from '@/lib/mock/items';
import { mockPurchases } from '@/lib/mock/purchases';
import { mockSales } from '@/lib/mock/sales';
import type { Purchase } from '@/types/erp';
import { fieldErrorFromApi, fieldErrorFromDetail, stockChangeMessage } from './form-utils';
import { buildPurchaseInput, PURCHASE_FIELDS, PurchaseForm } from './PurchaseForm';
import { PurchaseTable } from './PurchaseTable';
import { parseTradesQuery, tradesUrl } from './query';
import { buildReceiveInput, ReceiveDialog } from './ReceiveDialog';
import { buildSaleInput, SaleForm } from './SaleForm';
import { SaleTable } from './SaleTable';

const noop = () => {};
const noopAsync = async () => {};
const names = new Map(mockItems.map((i) => [i.sku_id, i.item_name]));
const P101 = mockPurchases[0] as Purchase;

const purchaseValues = { sku_id: 'PRD-001', supplier: '가나물산', order_qty: '10', purchase_cost: '80000', invoice_no: '' };
const saleValues = { sku_id: 'PRD-001', channel: '스마트스토어', sold_qty: '6', sale_amount: '90000', invoice_no: '' };

/** 검사 실패 detail을 FieldError로 그린 글자(칸 아래 문구 · testid 확인용). */
function fieldErrorHtml(result: ReturnType<typeof buildPurchaseInput>): string {
  if (result.ok) return '';
  const state = fieldErrorFromDetail(result.detail, PURCHASE_FIELDS);
  return state ? renderToString(<FieldError field={state.field} detail={state.detail} message={state.message} />) : '';
}

describe('Q: 주소 쿼리 (WU-12 1번)', () => {
  it('Q-01 대시보드가 보낸 ?status=이동·통관중 → 구매 탭 + 필터', () => {
    expect(parseTradesQuery({ status: '이동·통관중' })).toEqual({ tab: 'purchase', status: '이동·통관중' });
  });
  it('Q-02 ?status=출고대기 → 판매 탭 + 필터', () => {
    expect(parseTradesQuery({ status: '출고대기' })).toEqual({ tab: 'sale', status: '출고대기' });
  });
  it('Q-03 (실패해야 함) 탭에 안 맞는 상태 · 없는 상태는 버린다', () => {
    expect(parseTradesQuery({ tab: 'sale', status: '발주완료' })).toEqual({ tab: 'sale', status: null });
    expect(parseTradesQuery({ status: 'shipped' })).toEqual({ tab: 'purchase', status: null });
    expect(parseTradesQuery({ tab: 'hack' })).toEqual({ tab: 'purchase', status: null });
  });
  it('Q-04 쿼리가 없으면 구매 탭, 주소 만들기는 한글 상태를 인코딩', () => {
    expect(parseTradesQuery({})).toEqual({ tab: 'purchase', status: null });
    expect(tradesUrl('sale', '출고대기')).toBe(`/trades?tab=sale&status=${encodeURIComponent('출고대기')}`);
    expect(tradesUrl('purchase')).toBe('/trades?tab=purchase');
  });
});

describe('F: 폼 검사 — 요청 전에 막는다 (04 4.2 · 4.3)', () => {
  it('F-01 (실패해야 함) 수량 0 → order_qty 칸 아래 "1 ~ 100,000 사이로 입력해 주세요"', () => {
    const result = buildPurchaseInput({ ...purchaseValues, order_qty: '0' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toEqual({ field: 'order_qty', reason: 'out_of_range', min: 1, max: 100000 });
    const html = fieldErrorHtml(result);
    expect(html).toContain('data-testid="field-error-order_qty"');
    expect(html).toContain('1 ~ 100,000 사이로 입력해 주세요');
  });
  it('F-02 (실패해야 함) 수량 1.5 → "숫자(정수)로 입력해 주세요"', () => {
    const result = buildPurchaseInput({ ...purchaseValues, order_qty: '1.5' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail.reason).toBe('not_integer');
    expect(fieldErrorHtml(result)).toContain('숫자(정수)로 입력해 주세요');
  });
  it('F-03 (실패해야 함) 수량 100,001 → 범위 밖', () => {
    const result = buildPurchaseInput({ ...purchaseValues, order_qty: '100,001' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toMatchObject({ field: 'order_qty', reason: 'out_of_range' });
  });
  it('F-04 쉼표 · 공백은 지우고 정수로, 품목코드는 대문자, 송장번호 빈 값은 null', () => {
    const result = buildPurchaseInput({ ...purchaseValues, sku_id: ' prd-001 ', purchase_cost: '80,000', invoice_no: '  ' });
    expect(result).toEqual({
      ok: true,
      data: { sku_id: 'PRD-001', supplier: '가나물산', order_qty: 10, purchase_cost: 80000, invoice_no: null },
    });
  });
  it('F-05 (실패해야 함) 품목을 고르지 않으면 sku_id required', () => {
    const result = buildPurchaseInput({ ...purchaseValues, sku_id: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toEqual({ field: 'sku_id', reason: 'required' });
  });
  it('F-06 T-VAL-1 화면 쪽: 송장번호를 비운 판매 두 건이 모두 통과하고 invoice_no는 null', () => {
    const first = buildSaleInput(saleValues);
    const second = buildSaleInput({ ...saleValues, sold_qty: '1' });
    expect(first.ok && first.data.invoice_no).toBeNull();
    expect(second.ok && second.data.invoice_no).toBeNull();
  });
  it('F-07 (실패해야 함) 판매 수량 0 · 채널 빈 값', () => {
    const zero = buildSaleInput({ ...saleValues, sold_qty: '0' });
    if (!zero.ok) expect(zero.detail).toMatchObject({ field: 'sold_qty', reason: 'out_of_range' });
    else throw new Error('수량 0이 통과했다');
    const noChannel = buildSaleInput({ ...saleValues, channel: ' ' });
    if (!noChannel.ok) expect(noChannel.detail).toEqual({ field: 'channel', reason: 'required' });
    else throw new Error('빈 채널이 통과했다');
  });
  it('F-09 (실패해야 함) 금액 · 수량 `8,5`(소수 뜻 쉼표) → not_integer, 천 단위 쉼표 `1,000`은 통과', () => {
    const cost = buildPurchaseInput({ ...purchaseValues, purchase_cost: '8,5' });
    expect(!cost.ok && cost.detail).toEqual({ field: 'purchase_cost', reason: 'not_integer' });
    const qty = buildSaleInput({ ...saleValues, sold_qty: '1,5' });
    expect(!qty.ok && qty.detail).toEqual({ field: 'sold_qty', reason: 'not_integer' });
    const received = buildReceiveInput(10, '8,5');
    expect(!received.ok && received.detail).toEqual({ field: 'received_qty', reason: 'not_integer' });
    const thousands = buildSaleInput({ ...saleValues, sale_amount: '1,000' });
    expect(thousands.ok && thousands.data.sale_amount).toBe(1000);
  });
  it('F-08 도착 수량은 1 ~ 주문 수량: 8은 통과, 0 · 11은 범위 밖(실패해야 함)', () => {
    expect(buildReceiveInput(10, '8')).toEqual({ ok: true, data: { received_qty: 8 } });
    for (const text of ['0', '11']) {
      const result = buildReceiveInput(10, text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.detail).toEqual({ field: 'received_qty', reason: 'out_of_range', min: 1, max: 10 });
    }
  });
});

describe('E: 서버 오류 → 칸 아래 / 배너 (04 4.4)', () => {
  it('E-01 송장번호 중복은 invoice_no 칸 아래 서버 문구', () => {
    const state = fieldErrorFromApi(new ApiError('PF_DUPLICATE_INVOICE', { invoice_no: 'INV-1' }, 409), PURCHASE_FIELDS);
    expect(state).toEqual({ field: 'invoice_no', message: '이미 등록된 송장번호예요 (INV-1)' });
  });
  it('E-02 서버 PF_VALIDATION의 field가 폼 칸이면 그 칸 아래', () => {
    const state = fieldErrorFromApi(new ApiError('PF_VALIDATION', { field: 'supplier', reason: 'too_long', max: 50 }, 400), PURCHASE_FIELDS);
    expect(state).toEqual({ field: 'supplier', detail: { reason: 'too_long', min: undefined, max: 50 } });
  });
  it('E-03 (실패해야 함) 폼에 없는 칸 · 재고 부족은 칸 오류가 아니다 → 배너', () => {
    expect(fieldErrorFromApi(new ApiError('PF_VALIDATION', { field: 'body', reason: 'bad_format' }, 400), PURCHASE_FIELDS)).toBeNull();
    expect(
      fieldErrorFromApi(new ApiError('PF_INSUFFICIENT_STOCK', { sku_id: 'PRD-003', stock_qty: 3, requested: 5 }, 409), PURCHASE_FIELDS),
    ).toBeNull();
  });
  it('E-04 재고 부족 배너 문구에 남은 수량이 들어 있다(ApiError가 04 4.4로 만든다)', () => {
    expect(new ApiError('PF_INSUFFICIENT_STOCK', { sku_id: 'PRD-003', stock_qty: 3, requested: 5 }, 409).message).toBe(
      '재고가 부족해요. PRD-003 남은 수량 3개',
    );
  });
  it('E-05 알림 문구 "S-201 출고 — PRD-001 재고 10 → 4", 이전 값을 모르면 재고만', () => {
    expect(stockChangeMessage('S-201 출고', 'PRD-001', 10, 4)).toBe('S-201 출고 — PRD-001 재고 10 → 4');
    expect(stockChangeMessage('P-101 입고 확정', 'PRD-001', null, 1200)).toBe('P-101 입고 확정 — PRD-001 재고 1,200');
  });
});

describe('T: 표 · 폼 렌더 (testid · 버튼 · 배지)', () => {
  it('T-01 구매 표(목 P-101 이동·통관중): 행 · [입고 확정] 있음, 도착 수량 —, 부분 입고 배지 없음', () => {
    const html = renderToString(<PurchaseTable purchases={mockPurchases} itemNames={names} onReceive={noop} />);
    expect(html).toContain('data-testid="purchase-row-P-101"');
    expect(html).toContain('data-testid="btn-receive-P-101"');
    expect(html).toContain('PRD-001 무선 마우스');
    expect(html).toContain('>—</td>'); // 도착 전 received_qty null → —(04 4.5)
    expect(html).not.toContain('partial-badge-P-101');
  });
  it('T-02 8 / 10 입고완료 → 부분 입고 배지, [입고 확정] 없음(실패해야 함)', () => {
    const received = { ...P101, status: '입고완료' as const, received_qty: 8, received_at: '2026-11-23T02:00:00.000Z' };
    const html = renderToString(<PurchaseTable purchases={[received]} itemNames={names} onReceive={noop} />);
    expect(html).toContain('data-testid="partial-badge-P-101"');
    expect(html).toContain('부분 입고');
    expect(html).not.toContain('btn-receive-P-101');
  });
  it('T-03 다 도착(10 / 10)이면 부분 입고 배지 없음', () => {
    const full = { ...P101, status: '입고완료' as const, received_qty: 10 };
    expect(renderToString(<PurchaseTable purchases={[full]} itemNames={names} onReceive={noop} />)).not.toContain('partial-badge');
  });
  it('T-04 판매 표: S-201(출고대기)은 [출고]만, S-202(주문접수)는 [출고대기로]만, 송장번호 —', () => {
    const html = renderToString(<SaleTable sales={mockSales} itemNames={names} onReady={noopAsync} onShip={noopAsync} />);
    expect(html).toContain('data-testid="sale-row-S-201"');
    expect(html).toContain('data-testid="btn-ship-S-201"');
    expect(html).not.toContain('btn-ready-S-201');
    expect(html).toContain('data-testid="btn-ready-S-202"');
    expect(html).not.toContain('btn-ship-S-202');
    expect(html).toContain('<td>—</td>');
  });
  it('T-05 (실패해야 함) 출고완료 판매에는 버튼이 없다', () => {
    const shipped = { ...mockSales[0]!, fulfillment_status: '출고완료' as const };
    const html = renderToString(<SaleTable sales={[shipped]} itemNames={names} onReady={noopAsync} onShip={noopAsync} />);
    expect(html).not.toContain('btn-ship-');
    expect(html).not.toContain('btn-ready-');
  });
  it('T-06 등록 폼 testid · 품목 선택 목록', () => {
    const purchase = renderToString(<PurchaseForm items={mockItems} onCreated={noop} onError={noop} />);
    expect(purchase).toContain('data-testid="form-purchase"');
    expect(purchase).toContain('data-testid="btn-submit-purchase"');
    expect(purchase).toContain('value="PRD-003"');
    const sale = renderToString(<SaleForm items={mockItems} onCreated={noop} onError={noop} />);
    expect(sale).toContain('data-testid="form-sale"');
    expect(sale).toContain('data-testid="btn-submit-sale"');
  });
  it('T-07 입고 확정 창: 도착 수량 기본값 = 주문 수량 10, 확인 버튼 testid. 구매가 없으면 닫힘', () => {
    const html = renderToString(<ReceiveDialog purchase={P101} onClose={noop} onDone={noop} onError={noop} />);
    expect(html).toContain('data-testid="input-received-qty"');
    expect(html).toMatch(/data-testid="input-received-qty"[^>]*value="10"|value="10"[^>]*data-testid="input-received-qty"/);
    expect(html).toContain('data-testid="btn-receive-confirm"');
    expect(renderToString(<ReceiveDialog purchase={null} onClose={noop} onDone={noop} onError={noop} />)).toBe('');
  });
});
