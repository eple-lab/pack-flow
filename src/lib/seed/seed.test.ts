/**
 * 시드 로더 단위 테스트 — demo 통과, 형식이 깨진 JSON 거부, 없는 이름 · 없는 파일 오류.
 *
 * 하는 일: 기대(통과 · 거부 사유 문구)를 먼저 적고 loadSeed · parseSeed 결과와 비교한다.
 *
 * 근거: docs/03-data-model.md 7절, WU-08 (S4 기준)
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 시드 로더 시험 (WU-08)
 */
import { describe, expect, it } from 'vitest';
import { SeedError, isSeedName, loadSeed, parseSeed } from './index';

const base = () => ({
  items: [
    { sku_id: 'PRD-001', item_name: '무선 마우스', unit_cost: 8000, sale_price: 15000, initial_qty: 10, safety_stock: 5 },
    { sku_id: 'PRD-002', item_name: 'USB-C 케이블', unit_cost: 2000, sale_price: 5000, initial_qty: 40, safety_stock: 15 },
  ],
  purchases: [{ purchase_id: 'P-101', sku_id: 'PRD-001', supplier: '가나물산', order_qty: 10, purchase_cost: 80000, status: '이동·통관중' }],
  sales: [{ sale_id: 'S-201', sku_id: 'PRD-001', channel: '스마트스토어', sold_qty: 6, sale_amount: 90000, fulfillment_status: '출고대기' }],
  events: [] as unknown[],
});

describe('S4: 시드 로더', () => {
  it('S4-1 demo가 형식 검사를 통과하고 계획서 7절 예시(PRD-001~003 · P-101 · S-201 · S-202)를 담는다', async () => {
    const demo = await loadSeed('demo');
    expect(demo.items.map((i) => i.sku_id)).toEqual(['PRD-001', 'PRD-002', 'PRD-003']);
    expect(demo.purchases.map((p) => p.purchase_id)).toEqual(['P-101']);
    expect(demo.sales.map((s) => s.sale_id)).toEqual(['S-201', 'S-202']);
    expect(demo.events).toEqual([]);
  });

  it('S4-2 demo의 expected가 손으로 센 값과 같다(재고 합 53, 안전재고 미만 1개, initial_qty = expected.stock)', async () => {
    const demo = await loadSeed('demo');
    const total = demo.items.reduce((sum, i) => sum + i.initial_qty, 0);
    expect(total).toBe(53);
    expect(demo.expected?.kpi).toEqual({ item_count: 3, stock_total: 53, below_safety: 1 });
    expect(demo.items.filter((i) => i.initial_qty < i.safety_stock).map((i) => i.sku_id)).toEqual(['PRD-003']);
    for (const i of demo.items) expect(demo.expected?.stock?.[i.sku_id]).toBe(i.initial_qty);
  });

  it('S4-3 모르는 이름은 SeedError', async () => {
    await expect(loadSeed('huge')).rejects.toBeInstanceOf(SeedError);
    await expect(loadSeed('huge')).rejects.toThrow(/모르는 시드 이름/);
    await expect(loadSeed('../etc/passwd')).rejects.toThrow(/모르는 시드 이름/);
    expect(isSeedName('demo')).toBe(true);
    expect(isSeedName('huge')).toBe(false);
  });

  it('S4-4 small · large 파일이 아직 없으면 분명한 오류(주인 안내 포함)', async () => {
    // sorek-charlie가 파일을 추가하면 이 시험은 통과할 수 없으므로 그때 이 줄을 지운다
    for (const name of ['small', 'large']) {
      await expect(loadSeed(name)).rejects.toThrow(new RegExp(`${name}\\.json이 아직 없어요`));
    }
  });

  it('S4-5 정상 입력 통과 · 선택 칸 생략 허용(purchases · sales · events 기본 빈 배열)', () => {
    expect(parseSeed(base()).items).toHaveLength(2);
    const onlyItems = parseSeed({ items: base().items });
    expect(onlyItems.purchases).toEqual([]);
    expect(onlyItems.sales).toEqual([]);
    expect(onlyItems.events).toEqual([]);
  });

  it.each([
    ['최상위가 객체가 아님', () => [] as unknown, /형식 오류/],
    ['items 없음', () => ({}), /items/],
    ['items가 배열이 아님', () => ({ items: 'x' }), /items/],
    ['품목코드 소문자', () => ({ ...base(), items: [{ ...base().items[0], sku_id: 'prd-001' }] }), /sku_id/],
    ['initial_qty 음수', () => ({ ...base(), items: [{ ...base().items[0], initial_qty: -1 }] }), /initial_qty/],
    ['단가가 소수', () => ({ ...base(), items: [{ ...base().items[0], unit_cost: 1.5 }] }), /unit_cost/],
    ['단가가 글자', () => ({ ...base(), items: [{ ...base().items[0], unit_cost: '8000' }] }), /unit_cost/],
    ['모르는 필드(strict)', () => ({ ...base(), items: [{ ...base().items[0], stock_qty: 10 }] }), /items\.0/],
    ['최상위 모르는 필드', () => ({ ...base(), note: 'x' }), /형식 오류/],
    ['구매 수량 0', () => ({ ...base(), purchases: [{ ...base().purchases[0], order_qty: 0 }] }), /order_qty/],
    ['구매 상태가 입고완료(재고 영향 상태는 events로)', () => ({ ...base(), purchases: [{ ...base().purchases[0], status: '입고완료' }] }), /status/],
    ['판매 상태가 출고완료', () => ({ ...base(), sales: [{ ...base().sales[0], fulfillment_status: '출고완료' }] }), /fulfillment_status/],
    ['판매 수량 100001', () => ({ ...base(), sales: [{ ...base().sales[0], sold_qty: 100001 }] }), /sold_qty/],
    ['모르는 event op', () => ({ ...base(), events: [{ op: 'explode', sale_id: 'S-201' }] }), /events/],
  ])('S4-6 형식 거부: %s', (_name, make, re) => {
    expect(() => parseSeed(make(), 'test')).toThrow(SeedError);
    expect(() => parseSeed(make(), 'test')).toThrow(re);
  });

  it('S4-7 교차 확인: 없는 품목을 가리키는 구매 · 판매, 번호 중복, 없는 구매 · 판매를 가리키는 event', () => {
    expect(() => parseSeed({ ...base(), purchases: [{ ...base().purchases[0], sku_id: 'NOPE-1' }] })).toThrow(/없는 품목 NOPE-1/);
    expect(() => parseSeed({ ...base(), sales: [{ ...base().sales[0], sku_id: 'NOPE-1' }] })).toThrow(/없는 품목 NOPE-1/);
    expect(() => parseSeed({ ...base(), items: [base().items[0], base().items[0]] })).toThrow(/PRD-001가 두 번/);
    expect(() => parseSeed({ ...base(), sales: [base().sales[0], base().sales[0]] })).toThrow(/S-201가 두 번/);
    expect(() => parseSeed({ ...base(), events: [{ op: 'ship', sale_id: 'S-999' }] })).toThrow(/events\.0/);
    expect(() => parseSeed({ ...base(), events: [{ op: 'receive', purchase_id: 'P-999', received_qty: 1 }] })).toThrow(/events\.0/);
  });

  it('S4-8 올바른 event는 통과한다(ship · receive)', () => {
    const data = parseSeed({
      ...base(),
      events: [
        { op: 'ship', sale_id: 'S-201' },
        { op: 'receive', purchase_id: 'P-101', received_qty: 8 },
      ],
    });
    expect(data.events).toHaveLength(2);
  });

  it('S4-9 오류 메시지에 이름과 칸이 있고 값 자체는 싣지 않는다', () => {
    try {
      parseSeed({ ...base(), items: [{ ...base().items[0], item_name: '비밀값-xyz', unit_cost: 'abc' }] }, 'demo');
      throw new Error('통과하면 안 된다');
    } catch (e) {
      expect(e).toBeInstanceOf(SeedError);
      expect((e as Error).message).toContain('demo');
      expect((e as Error).message).toContain('unit_cost');
      expect((e as Error).message).not.toContain('비밀값-xyz');
    }
  });
});
