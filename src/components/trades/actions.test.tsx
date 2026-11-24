/**
 * 구매 · 판매 상태 버튼 · 취소 버튼 시험 — 전이표대로 버튼이 보이는지, 끝 상태엔 없는지, 확인 창 문구.
 *
 * 하는 일
 * 1. 기대값은 시험 전에 적었다(D-34). 허용 안 된 전이에 버튼이 없어야 하는 경우를 넣었다(WU-14 다 됐다 3번 화면 쪽).
 * 2. 표는 react-dom/server renderToString으로 testid를 본다. 클릭 · 확인 창 · 요청은 브라우저 확인 몫.
 *
 * 근거: docs/work-units/WU-14-history-cancel.md 3~6번, docs/03-data-model.md 3절
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-24  jkspawn  처음 작성 — 상태 · 취소 버튼 시험 (WU-14)
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mockPurchases } from '@/lib/mock/purchases';
import { mockSales } from '@/lib/mock/sales';
import type { Purchase, Sale } from '@/types/erp';
import { cancelConfirmMessage } from './form-utils';
import { purchaseActions, PurchaseTable } from './PurchaseTable';
import { SaleTable } from './SaleTable';

const noop = () => {};
const noopAsync = async () => {};
const P101 = mockPurchases[0] as Purchase;
const S201 = mockSales[0] as Sale;

const purchaseHtml = (purchase: Purchase) =>
  renderToString(
    <PurchaseTable purchases={[purchase]} itemNames={new Map()} onReceive={noop} onStatus={noop} onCancelReceipt={noop} />,
  );
const saleHtml = (sale: Sale) =>
  renderToString(
    <SaleTable sales={[sale]} itemNames={new Map()} onReady={noopAsync} onShip={noopAsync} onOrderCancel={noop} onCancelShipment={noop} />,
  );

describe('A: 구매 버튼은 전이표대로 (WU-14 3번)', () => {
  it('A-01 발주완료 → 이동·통관중으로 · 입고 확정 · 품절 · 발주 취소', () => {
    expect(purchaseActions('발주완료')).toEqual([
      { type: 'status', to: '이동·통관중' },
      { type: 'receive' },
      { type: 'status', to: '품절' },
      { type: 'status', to: '취소' },
    ]);
  });
  it('A-02 이동·통관중 → 입고 확정 · 발주 취소 (품절 없음)', () => {
    expect(purchaseActions('이동·통관중')).toEqual([{ type: 'receive' }, { type: 'status', to: '취소' }]);
  });
  it('A-03 입고완료 → 입고 취소만', () => {
    expect(purchaseActions('입고완료')).toEqual([{ type: 'cancel-receipt' }]);
  });
  it('A-04 (실패해야 함) 끝 상태(입고취소 · 품절 · 취소)엔 버튼이 없다', () => {
    for (const status of ['입고취소', '품절', '취소'] as const) expect(purchaseActions(status)).toEqual([]);
  });
  it('A-05 표: P-101(이동·통관중)은 입고 확정 · 발주 취소 testid, 품절 · 입고 취소는 없음(실패해야 함)', () => {
    const html = purchaseHtml(P101);
    expect(html).toContain('data-testid="btn-receive-P-101"');
    expect(html).toContain('data-testid="btn-purchase-to-취소-P-101"');
    expect(html).not.toContain('btn-purchase-to-품절-P-101');
    expect(html).not.toContain('btn-cancel-receipt-P-101');
  });
  it('A-06 표: 발주완료면 이동·통관중으로 · 품절 버튼, 입고완료면 입고 취소 버튼만', () => {
    const ordered = purchaseHtml({ ...P101, status: '발주완료' });
    expect(ordered).toContain('data-testid="btn-purchase-to-이동·통관중-P-101"');
    expect(ordered).toContain('data-testid="btn-purchase-to-품절-P-101"');
    const received = purchaseHtml({ ...P101, status: '입고완료', received_qty: 8 });
    expect(received).toContain('data-testid="btn-cancel-receipt-P-101"');
    expect(received).not.toContain('btn-receive-P-101');
    expect(received).not.toContain('btn-purchase-to-');
  });
});

describe('B: 판매 버튼은 전이표대로 (WU-14 4번)', () => {
  it('B-01 주문접수 → 출고대기로 · 주문 취소', () => {
    const html = saleHtml({ ...S201, fulfillment_status: '주문접수' });
    expect(html).toContain('data-testid="btn-ready-S-201"');
    expect(html).toContain('data-testid="btn-order-cancel-S-201"');
    expect(html).not.toContain('btn-cancel-shipment-S-201');
  });
  it('B-02 출고대기 → 출고 · 주문 취소', () => {
    const html = saleHtml(S201);
    expect(html).toContain('data-testid="btn-ship-S-201"');
    expect(html).toContain('data-testid="btn-order-cancel-S-201"');
  });
  it('B-03 출고완료 → 출고 취소만', () => {
    const html = saleHtml({ ...S201, fulfillment_status: '출고완료' });
    expect(html).toContain('data-testid="btn-cancel-shipment-S-201"');
    expect(html).not.toContain('btn-order-cancel-S-201');
    expect(html).not.toContain('btn-ship-S-201');
  });
  it('B-04 (실패해야 함) 끝 상태(출고취소 · 주문취소)엔 버튼이 없다', () => {
    for (const status of ['출고취소', '주문취소'] as const) {
      expect(saleHtml({ ...S201, fulfillment_status: status })).not.toMatch(/data-testid="btn-/);
    }
  });
});

describe('C: 취소 확인 창 문구 (WU-14 5번)', () => {
  it('C-01 출고 취소는 돌아올 수량 · 기록이 남는다는 말', () => {
    expect(cancelConfirmMessage('cancel-shipment', 'S-201', 'PRD-001', 6)).toBe(
      'S-201 출고를 취소하면 PRD-001 재고가 6개 돌아오고, 기록은 남아요',
    );
  });
  it('C-02 입고 취소 · 주문 취소 · 발주 취소', () => {
    expect(cancelConfirmMessage('cancel-receipt', 'P-101', 'PRD-001', 8)).toBe(
      'P-101 입고를 취소하면 PRD-001 재고가 8개 줄고, 기록은 남아요',
    );
    expect(cancelConfirmMessage('order-cancel', 'S-202', 'PRD-002', null)).toBe(
      'S-202 주문을 취소해요. 재고는 그대로이고, 기록은 남아요',
    );
    expect(cancelConfirmMessage('purchase-cancel', 'P-101', 'PRD-001', null)).toBe(
      'P-101 발주를 취소해요. 재고는 그대로이고, 기록은 남아요',
    );
  });
});
