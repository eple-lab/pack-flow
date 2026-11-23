/**
 * 대시보드 조각 렌더 시험 — react-dom/server renderToString으로 testid · 숫자 · 배지를 확인한다(새 패키지 없이).
 *
 * 하는 일
 * 1. 목 대시보드(src/lib/mock/dashboard.ts)를 그대로 그려 KPI · 품절 임박 · 파이프라인 · 재고 표 · 최근 변경을 본다.
 * 2. 숫자가 API 값 그대로인지(T-S1-3), 쉼표 · 부호 서식, 빈 상태 · 배지가 없어야 하는 경우도 본다.
 * 3. 버튼이 openAgentPanel을 부르는지는 openDraftPo로 본다.
 * 한계: 클릭 · 이동 같은 브라우저 동작은 서버 렌더로 못 본다(E2E — sorek-charlie step1.spec.ts).
 *
 * 근거: docs/work-units/WU-11-dashboard.md '다 됐다의 기준', docs/07-test-strategy.md
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  jkspawn  처음 작성 — 대시보드 조각 렌더 시험 (WU-11)
 */
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { getLastAgentRequest, resetAgentPanelForTest } from '@/components/agent/open';
import { mockDashboard } from '@/lib/mock/dashboard';
import type { Dashboard } from '@/types/erp';
import { AlertCards, openDraftPo } from './AlertCards';
import { DashboardContent } from './DashboardView';
import { KpiCards } from './KpiCards';
import { Pipeline, tradesHref } from './Pipeline';
import { RecentChanges } from './RecentChanges';
import { historyHref, StockTable } from './StockTable';

const noop = () => {};

/** renderToString 결과에서 testid 요소의 글자를 꺼낸다(태그는 지운다). */
function textOf(html: string, testid: string): string | null {
  const start = html.indexOf(`data-testid="${testid}"`);
  if (start < 0) return null;
  const open = html.indexOf('>', start);
  const close = html.indexOf('</', open);
  return html.slice(open + 1, close).replace(/<[^>]*>/g, '').replace(/<!-- -->/g, '');
}

/** React가 글자 사이에 넣는 `<!-- -->` 표시를 지운다. */
const plain = (html: string) => html.replace(/<!-- -->/g, '');

describe('C: 대시보드 (WU-11)', () => {
  beforeEach(() => resetAgentPanelForTest());

  it('C-01 KPI는 목 값 그대로: 품목 3 · 재고 합계 53 · 미만 1(경고 배지) · 오늘 입고 0 · 출고 0', () => {
    const html = renderToString(<KpiCards kpi={mockDashboard.kpi} />);
    expect(textOf(html, 'kpi-item-count')).toBe('3');
    expect(textOf(html, 'kpi-stock-total')).toBe('53');
    expect(textOf(html, 'kpi-below-safety')).toBe('1');
    expect(html).toContain('data-testid="kpi-below-safety-badge"');
    expect(textOf(html, 'kpi-today-in')).toBe('0');
    expect(textOf(html, 'kpi-today-out')).toBe('0');
  });

  it('C-02 (실패해야 함) 안전재고 미만이 0이면 경고 배지가 없다', () => {
    const html = renderToString(<KpiCards kpi={{ ...mockDashboard.kpi, below_safety: 0 }} />);
    expect(html).not.toContain('kpi-below-safety-badge');
  });

  it('C-03 숫자는 천 단위 쉼표 — 재고 합계 12345 → 12,345, 화면에서 다시 계산하지 않는다', () => {
    // items 합과 다른 값을 넣어도 kpi 값을 그대로 보여야 한다(T-S1-3)
    const html = renderToString(<KpiCards kpi={{ ...mockDashboard.kpi, stock_total: 12345, item_count: 1200 }} />);
    expect(textOf(html, 'kpi-stock-total')).toBe('12,345');
    expect(textOf(html, 'kpi-item-count')).toBe('1,200');
  });

  it('C-04 PRD-003(재고 3 / 안전 4)이 품절 임박 카드로 보이고 버튼 · 맡기기 버튼이 있다', () => {
    const html = plain(renderToString(<AlertCards alerts={mockDashboard.alerts} />));
    expect(html).toContain('data-testid="alert-card-PRD-003"');
    expect(html).toContain('노트북 거치대</strong> — 재고 3 / 안전재고 4');
    expect(html).toContain('data-testid="btn-draft-po-PRD-003"');
    expect(html).toContain('data-testid="btn-agent-all"');
  });

  it('C-05 (실패해야 함) 재고가 충분한 PRD-001 · PRD-002는 품절 임박 카드가 없다', () => {
    const html = renderToString(<AlertCards alerts={mockDashboard.alerts} />);
    expect(html).not.toContain('alert-card-PRD-001');
    expect(html).not.toContain('alert-card-PRD-002');
  });

  it('C-06 품절 임박이 없으면 EmptyState', () => {
    const html = renderToString(<AlertCards alerts={[]} />);
    expect(html).toContain('data-testid="alerts-empty"');
    expect(html).toContain('품절 임박 품목이 없어요');
    expect(html).not.toContain('alert-card-');
  });

  it('C-07 [발주서 초안 보기]는 openAgentPanel({ mode: draft-po, sku_ids: [PRD-003] })을 부른다', () => {
    expect(getLastAgentRequest()).toBeNull();
    openDraftPo('PRD-003');
    expect(getLastAgentRequest()).toEqual({ mode: 'draft-po', sku_ids: ['PRD-003'] });
  });

  it('C-08 [AI 에이전트에게 맡기기]는 sku_ids 없이 draft-po로 연다', () => {
    openDraftPo();
    expect(getLastAgentRequest()).toEqual({ mode: 'draft-po' });
  });

  it('C-09 재고 표: PRD-003은 빨간 미만 배지, PRD-001은 배지 없음(실패해야 함), 재고 칸 값 그대로', () => {
    const html = renderToString(<StockTable items={mockDashboard.items} onRowClick={noop} />);
    for (const sku of ['PRD-001', 'PRD-002', 'PRD-003']) expect(html).toContain(`data-testid="stock-row-${sku}"`);
    expect(textOf(html, 'stock-qty-PRD-003')).toBe('3');
    expect(textOf(html, 'stock-qty-PRD-002')).toBe('40');
    expect(html).toContain('data-testid="stock-badge-PRD-003"');
    expect(html).not.toContain('stock-badge-PRD-001');
    expect(html).toContain(`href="${historyHref('PRD-003')}"`);
  });

  it('C-10 미만 여부는 API의 below_safety를 따른다(화면에서 재고와 안전재고를 비교하지 않음)', () => {
    const item = { ...mockDashboard.items[0], stock_qty: 100, safety_stock: 1, below_safety: true };
    const html = renderToString(<StockTable items={[item]} onRowClick={noop} />);
    expect(html).toContain(`data-testid="stock-badge-${item.sku_id}"`);
  });

  it('C-11 파이프라인: 5칸 testid · 건수 그대로 · /trades?status= 링크', () => {
    const html = plain(renderToString(<Pipeline pipeline={mockDashboard.pipeline} />));
    for (const s of ['발주완료', '이동·통관중', '입고완료']) expect(html).toContain(`data-testid="pipe-purchase-${s}"`);
    for (const s of ['출고대기', '출고완료']) expect(html).toContain(`data-testid="pipe-sale-${s}"`);
    expect(html).toContain(`href="${tradesHref('이동·통관중')}"`);
    expect(tradesHref('이동·통관중')).toBe(`/trades?status=${encodeURIComponent('이동·통관중')}`);
    // 목: 이동·통관중 1건, 출고대기 1건
    expect(textOf(html, 'pipe-purchase-이동·통관중')).toBe('이동·통관중');
    expect(html).toMatch(/pipe-purchase-이동·통관중"[^]*?1건/);
    expect(html).toMatch(/pipe-sale-출고대기"[^]*?1건/);
  });

  it('C-12 최근 변경: 응답 순서 그대로, +/− 부호(U+2212), 한국 시간, 품목명', () => {
    const changes: Dashboard['recent_changes'] = [
      { log_id: 2, sku_id: 'PRD-001', change_qty: -6, reason: '실판매출고', ref_type: 'sale', ref_id: 'S-201', created_at: '2026-11-24T05:05:09.000Z' },
      { log_id: 1, sku_id: 'PRD-999', change_qty: 8, reason: '구매입고', ref_type: 'purchase', ref_id: 'P-101', created_at: '2026-11-24T04:00:00.000Z' },
    ];
    const html = plain(renderToString(<RecentChanges changes={changes} items={mockDashboard.items} />));
    expect(html.indexOf('recent-row-2')).toBeLessThan(html.indexOf('recent-row-1'));
    expect(html).toContain('−6');
    expect(html).toContain('+8');
    expect(html).toContain('title="2026-11-24 14:05:09"'); // UTC 05:05 → 한국 14:05
    expect(html).toContain('PRD-001 무선 마우스');
    expect(html).toContain('<td>PRD-999</td>'); // 이름을 못 찾으면 코드만
  });

  it('C-13 최근 변경이 없으면 EmptyState', () => {
    const html = renderToString(<RecentChanges changes={[]} items={[]} />);
    expect(html).toContain('data-testid="recent-empty"');
  });

  it('C-14 전체 묶음: WU-11 표의 testid가 모두 있다', () => {
    const html = renderToString(<DashboardContent data={mockDashboard} onRowClick={noop} />);
    const ids = [
      'kpi-item-count', 'kpi-stock-total', 'kpi-below-safety', 'kpi-today-in', 'kpi-today-out',
      'alert-card-PRD-003', 'btn-draft-po-PRD-003', 'btn-agent-all',
      'pipe-purchase-발주완료', 'pipe-purchase-이동·통관중', 'pipe-purchase-입고완료', 'pipe-sale-출고대기', 'pipe-sale-출고완료',
      'stock-row-PRD-001', 'stock-qty-PRD-001',
    ];
    for (const id of ids) expect(html, id).toContain(`data-testid="${id}"`);
  });
});
