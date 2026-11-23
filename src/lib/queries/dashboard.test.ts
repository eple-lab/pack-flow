/**
 * getDashboard 단위 시험 — KST 경계 · pipeline 0건 키 · 최근 5건 · KPI · 오류 변환 (가짜 Supabase).
 *
 * 기대(먼저 적음) — 기준 시각 now = 2026-11-23T05:00:00Z (KST 11/23 14:00). 오늘 = [11-22T15:00Z, 11-23T15:00Z)
 * - C-15 입고완료 4건: 11-22T14:59:59Z(어제) · 11-22T15:00:00Z(오늘 첫 순간) · 11-23T14:59:59Z(오늘 마지막 순간) ·
 *        11-23T15:00:00Z(내일) → today_in = 2. 입고취소 상태 건은 오늘 시각이어도 안 센다
 * - C-16 출고완료 shipped_at 같은 경계 → today_out = 2. 출고대기 건은 안 센다
 * - C-17 pipeline: 구매 · 판매 상태 상수 전체 키가 있고 건수 없는 상태는 0, 있는 상태는 그 건수
 * - C-18 recent_changes: 로그 7건 → 5건, created_at 내림차순, 같은 시각이면 log_id 내림차순
 * - C-19 KPI: 품목 3개(재고 3/5 · 5/5 · 20/5) → item_count 3, stock_total 28, below_safety 1, alerts는 3/5 품목 하나
 * - C-20 빈 DB → 0 · 빈 배열, pipeline 키는 그대로
 * - C-21 어느 표든 오류 → PfError PF_INTERNAL(원문 미노출)
 *
 * 근거: docs/04-api-contract.md 3.5, docs/03-data-model.md 2절, WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 대시보드 조회 시험 (WU-41)
 */
import { describe, expect, it } from 'vitest';
import { PfError } from '@/lib/api/errors';
import { PURCHASE_STATUSES, SALE_STATUSES } from '@/types/erp';
import { getDashboard } from './dashboard';
import { fakeDb, type Row } from './fakeDb.testutil';

const NOW = new Date('2026-11-23T05:00:00Z');
const edges = ['2026-11-22T14:59:59Z', '2026-11-22T15:00:00Z', '2026-11-23T14:59:59Z', '2026-11-23T15:00:00Z'];

const item = (sku_id: string, stock_qty: number, safety_stock: number): Row => ({
  id: `id-${sku_id}`, sku_id, item_name: `이름-${sku_id}`, source_url: null, unit_cost: 1, sale_price: 2,
  stock_qty, safety_stock, created_at: '2026-11-20T00:00:00Z', updated_at: '2026-11-20T00:00:00Z',
});
const purchase = (n: number, status: string, received_at: string | null): Row => ({ id: `p${n}`, status, received_at });
const sale = (n: number, fulfillment_status: string, shipped_at: string | null): Row => ({ id: `s${n}`, fulfillment_status, shipped_at });
const log = (log_id: number, created_at: string): Row => ({
  log_id, sku_id: 'PRD-001', change_qty: 1, reason: '구매입고', ref_type: 'purchase', ref_id: 'P-1', created_at,
});

describe('getDashboard', () => {
  it('C-15 today_in은 KST 오늘 경계(00:00 포함, 다음날 00:00 미포함)로 입고완료만 센다', async () => {
    const { client } = fakeDb({
      purchases: [
        ...edges.map((t, i) => purchase(i, '입고완료', t)),
        purchase(9, '입고취소', '2026-11-23T01:00:00Z'),
      ],
    });
    const d = await getDashboard(client, NOW);
    expect(d.kpi.today_in).toBe(2);
  });

  it('C-16 today_out은 KST 오늘 경계로 출고완료만 센다', async () => {
    const { client } = fakeDb({
      sales: [
        ...edges.map((t, i) => sale(i, '출고완료', t)),
        sale(9, '출고대기', null),
      ],
    });
    const d = await getDashboard(client, NOW);
    expect(d.kpi.today_out).toBe(2);
  });

  it('C-17 pipeline은 상태 상수 전체 키를 가지고 없는 상태는 0이다', async () => {
    const { client } = fakeDb({
      purchases: [purchase(1, '발주완료', null), purchase(2, '발주완료', null), purchase(3, '품절', null)],
      sales: [sale(1, '주문접수', null)],
    });
    const d = await getDashboard(client, NOW);
    expect(Object.keys(d.pipeline.purchase)).toEqual([...PURCHASE_STATUSES]);
    expect(Object.keys(d.pipeline.sale)).toEqual([...SALE_STATUSES]);
    expect(d.pipeline.purchase).toEqual({ 발주완료: 2, '이동·통관중': 0, 입고완료: 0, 입고취소: 0, 품절: 1, 취소: 0 });
    expect(d.pipeline.sale).toEqual({ 주문접수: 1, 출고대기: 0, 출고완료: 0, 출고취소: 0, 주문취소: 0 });
  });

  it('C-18 recent_changes는 최대 5건, created_at 내림차순, 같은 시각이면 log_id 내림차순', async () => {
    const same = '2026-11-23T04:00:00Z';
    const { client } = fakeDb({
      stock_logs: [
        log(1, '2026-11-20T00:00:00Z'), log(2, '2026-11-21T00:00:00Z'), log(3, same), log(4, same),
        log(5, '2026-11-22T00:00:00Z'), log(6, '2026-11-19T00:00:00Z'), log(7, '2026-11-18T00:00:00Z'),
      ],
    });
    const d = await getDashboard(client, NOW);
    expect(d.recent_changes.map((l) => l.log_id)).toEqual([4, 3, 5, 2, 1]);
  });

  it('C-19 KPI · alerts: 3/5는 임박, 5/5는 아님(경계), 합계는 stock_qty 합', async () => {
    const { client } = fakeDb({ items: [item('PRD-003', 20, 5), item('PRD-001', 3, 5), item('PRD-002', 5, 5)] });
    const d = await getDashboard(client, NOW);
    expect(d.kpi).toMatchObject({ item_count: 3, stock_total: 28, below_safety: 1 });
    expect(d.items.map((i) => i.sku_id)).toEqual(['PRD-001', 'PRD-002', 'PRD-003']);
    expect(d.alerts).toEqual([{ sku_id: 'PRD-001', item_name: '이름-PRD-001', stock_qty: 3, safety_stock: 5 }]);
  });

  it('C-20 빈 DB → 0 · 빈 배열, pipeline 키는 유지', async () => {
    const d = await getDashboard(fakeDb({}).client, NOW);
    expect(d.kpi).toEqual({ item_count: 0, stock_total: 0, below_safety: 0, today_in: 0, today_out: 0 });
    expect(d.items).toEqual([]);
    expect(d.alerts).toEqual([]);
    expect(d.recent_changes).toEqual([]);
    expect(Object.keys(d.pipeline.purchase)).toHaveLength(PURCHASE_STATUSES.length);
  });

  it.each(['items', 'purchases', 'sales', 'stock_logs'])('C-21 %s 표 오류 → PfError PF_INTERNAL(원문 미노출)', async (table) => {
    const { client } = fakeDb({}, { failTables: [table] });
    const err = await getDashboard(client, NOW).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PfError);
    expect((err as PfError).code).toBe('PF_INTERNAL');
    expect((err as PfError).message).not.toContain('secret-detail');
  });
});
