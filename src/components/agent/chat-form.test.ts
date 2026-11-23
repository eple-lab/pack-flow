/**
 * chat-form.ts 단위 테스트 — 보내기 가능 여부 · 실행 결과 알림 문구.
 *
 * 하는 일
 * 1. 기대 결과(버튼 활성 조건 · 알림 문구)를 먼저 적고 비교한다(D-34).
 * 2. 일부러 실패해야 하는 경우(빈 메시지 · 공백만 · 501자 · 모르는 결과 모양)를 넣는다.
 *
 * 근거: docs/work-units/WU-34-chat.md 6 · 다 됐다의 기준(공백만 있는 메시지 → 보내기 버튼 비활성)
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  skygaul  처음 작성 — 챗봇 입력 · 실행 알림 시험 (WU-34)
 */
import { describe, expect, it } from 'vitest';
import { canSend, resultMessage } from './chat-form';

describe('B: 보내기 가능 여부', () => {
  it('B-1 글자가 있으면 보낼 수 있다(앞뒤 공백은 무시)', () => {
    expect(canSend('PRD-001 재고?')).toBe(true);
    expect(canSend('  재고  ')).toBe(true);
  });

  it('B-2 (실패해야 함) 빈 메시지 · 공백만 있는 메시지는 보낼 수 없다', () => {
    expect(canSend('')).toBe(false);
    expect(canSend('   ')).toBe(false);
    expect(canSend('\n\t ')).toBe(false);
  });

  it('B-3 (실패해야 함) 500자까지만: 500자는 되고 501자는 안 된다(공백 제거 뒤 기준)', () => {
    expect(canSend('가'.repeat(500))).toBe(true);
    expect(canSend('가'.repeat(501))).toBe(false);
    expect(canSend(` ${'가'.repeat(500)} `)).toBe(true);
  });
});

describe('R: 실행 결과 알림 문구', () => {
  it('R-1 출고: 판매 번호 · 수량 · 남은 재고를 적는다', () => {
    expect(resultMessage({ type: 'ship_quantity', sale_id: 'S-301', sku_id: 'PRD-001', qty: 4, stock_qty: 6 })).toBe(
      'PRD-001 4개를 출고했어요 (판매 S-301). 남은 재고는 6개예요',
    );
    expect(resultMessage({ type: 'ship_sale', sale_id: 'S-201', stock_qty: 4 })).toBe('주문 S-201을(를) 출고했어요. 남은 재고는 4개예요');
  });

  it('R-2 상태 변경: 번호와 바뀐 상태를 적는다', () => {
    expect(resultMessage({ type: 'set_sale_status', sale_id: 'S-201', status: '주문취소' })).toBe('주문 S-201을(를) 주문취소 상태로 바꿨어요');
    expect(resultMessage({ type: 'set_purchase_status', purchase_id: 'P-101', status: '취소' })).toBe('구매 P-101을(를) 취소 상태로 바꿨어요');
  });

  it('R-3 (실패해야 함) 모르는 모양 · 값이 없으면 숫자를 지어내지 않고 일반 문구', () => {
    expect(resultMessage(null)).toBe('실행했어요');
    expect(resultMessage({ ok: true })).toBe('실행했어요');
    expect(resultMessage({ type: 'ship_quantity' })).toBe('실행했어요');
    expect(resultMessage({ type: 'ship_quantity', sale_id: 'S-1', sku_id: 'PRD-001', qty: '4', stock_qty: 6 })).toBe('실행했어요');
  });
});
