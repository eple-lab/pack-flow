/**
 * 재고 이력 화면 시험 — 이력 표(출고 −6 · 출고취소 +6) · 수정/삭제 버튼 없음 · 검산 줄 · 주소.
 *
 * 하는 일
 * 1. 기대값은 시험 전에 적었다(D-34). 검산 불일치 · 다 못 불러온 경우를 넣었다.
 * 2. 표는 react-dom/server renderToString. 불러오기 · [더 보기]는 브라우저 확인 몫.
 *
 * 근거: docs/work-units/WU-14-history-cancel.md 1 · 2번, docs/wireframes.html 6절
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-24  jkspawn  처음 작성 — 이력 표 · 검산 줄 시험 (WU-14)
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { StockLog } from '@/types/erp';
import { checkLine, historyUrl, LOG_PAGE_SIZE } from './HistoryView';
import { LogTable } from './LogTable';

/** T-S3-1 모양: seed +10 → 출고 −6 → 출고취소 +6 (최근순). */
const rows: StockLog[] = [
  { log_id: 3, sku_id: 'PRD-001', change_qty: 6, reason: '출고취소', ref_type: 'sale', ref_id: 'S-201', created_at: '2026-11-24T05:05:09.000Z' },
  { log_id: 2, sku_id: 'PRD-001', change_qty: -6, reason: '실판매출고', ref_type: 'sale', ref_id: 'S-201', created_at: '2026-11-24T05:02:00.000Z' },
  { log_id: 1, sku_id: 'PRD-001', change_qty: 10, reason: '재고조정', ref_type: 'seed', ref_id: 'seed', created_at: '2026-11-24T00:00:00.000Z' },
];

describe('H: 이력 표', () => {
  it('H-01 T-S3-1: −6 실판매출고 · +6 출고취소 두 줄이 순서대로, 부호는 U+2212, 참조 S-201', () => {
    const html = renderToString(<LogTable rows={rows} />).replace(/<!-- -->/g, '');
    expect(html.indexOf('log-row-3')).toBeLessThan(html.indexOf('log-row-2'));
    expect(html).toMatch(/data-testid="log-row-2"[^]*?−6[^]*?실판매출고[^]*?S-201/);
    expect(html).toMatch(/data-testid="log-row-3"[^]*?\+6[^]*?출고취소[^]*?S-201/);
    expect(html).toContain('title="2026-11-24 14:05:09"');
  });
  it('H-02 (실패해야 함) 이력 행에는 수정 · 삭제 버튼이 없다', () => {
    expect(renderToString(<LogTable rows={rows} />)).not.toContain('<button');
  });
  it('H-03 이력이 없으면 EmptyState', () => {
    expect(renderToString(<LogTable rows={[]} />)).toContain('data-testid="logs-empty"');
  });
});

describe('K: 검산 줄 (WU-14 2번)', () => {
  it('K-01 끝까지 불러왔으면 "현재 재고 10 = 이력 합계 10", 일치', () => {
    expect(checkLine(10, rows, true)).toEqual({ text: '현재 재고 10 = 이력 합계 10', match: true });
  });
  it('K-02 (실패해야 함) 재고와 이력 합이 다르면 불일치', () => {
    expect(checkLine(4, rows, true)).toEqual({ text: '현재 재고 4 = 이력 합계 10', match: false });
  });
  it('K-03 아직 다음 페이지가 있으면 합계를 보이지 않는다', () => {
    expect(checkLine(10, rows.slice(0, 1), false)).toEqual({
      text: '현재 재고 10 · 이력 합계는 [더 보기]로 끝까지 불러오면 보여요',
      match: null,
    });
  });
});

describe('U: 주소 · 페이지 크기', () => {
  it('U-01 품목 주소 · 전체 주소, 20건씩', () => {
    expect(historyUrl('PRD-001')).toBe('/history?sku_id=PRD-001');
    expect(historyUrl(null)).toBe('/history');
    expect(LOG_PAGE_SIZE).toBe(20);
  });
});
