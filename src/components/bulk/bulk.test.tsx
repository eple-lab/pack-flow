/**
 * 일괄 등록 탭 시험 — 예시 붙여넣기 · 미리보기 표 · 반영 본문 · 결과 문구 · 탭 주소.
 *
 * 하는 일
 * 1. 기대값은 시험 전에 적었다(D-34). 실패해야 하는 경우(유효 0행이면 반영 잠금, 오류 행은 반영 본문에서 빠짐)를 넣었다.
 * 2. 표 · 버튼은 react-dom/server renderToString으로 testid · 잠금 · 사유를 본다.
 * 한계: 파일 선택 · 클릭 · 서버 응답은 서버 렌더로 못 본다(브라우저 확인 · E2E step3.spec.ts).
 *
 * 근거: docs/work-units/WU-13-bulk.md 2~5번, docs/04-api-contract.md 3.6
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-24  jkspawn  처음 작성 — 일괄 등록 탭 시험 (WU-13)
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parse } from '@/lib/bulk/parse';
import { parseTradesQuery, tradesUrl } from '@/components/trades/query';
import type { BulkRow } from '@/types/erp';
import { bulkResultLines } from './BulkTab';
import { BULK_SAMPLE, PasteBox } from './PasteBox';
import { PreviewTable, validRowsForCommit } from './PreviewTable';

const noopAsync = async () => {};

/** 서버 미리보기를 흉내 낸 행: 파싱 결과에 서버가 미등록 품목코드(PRD-999)를 더 표시한 모양. */
function serverPreviewOfSample(): BulkRow[] {
  return parse(BULK_SAMPLE, 'tsv').lines.map((row) =>
    row.sku_id === 'PRD-999' ? { ...row, valid: false, errors: [...row.errors, '미등록 품목코드'] } : row,
  );
}

describe('S: 예시 붙여넣기 (WU-13 4번)', () => {
  it('S-01 예시는 머리글 + 10행, 파싱 단계에서 수량 0(7줄) · 같은 붙여넣기 송장 중복(9줄) 두 행이 빠진다', () => {
    const result = parse(BULK_SAMPLE, 'tsv');
    expect(result.lines).toHaveLength(10);
    expect(result.errors.map((e) => [e.line, e.reason])).toEqual([
      [7, '수량이 0 이하'],
      [9, '같은 붙여넣기 안 송장번호 중복'],
    ]);
    expect(result.rows).toHaveLength(8); // 미등록 품목코드(5줄)는 서버 미리보기가 잡는다
  });
  it('S-02 서버가 미등록 품목코드까지 표시하면 유효 7행(T-S3-5)', () => {
    expect(serverPreviewOfSample().filter((r) => r.valid)).toHaveLength(7);
  });
});

describe('V: 미리보기 표', () => {
  it('V-01 유효 행 · 오류 행 testid, 오류 칸에 사유, 요약 · 반영 버튼 "유효한 7행 반영"', () => {
    // React가 글자 조각 사이에 넣는 <!-- --> 표시는 지우고 본다
    const html = renderToString(<PreviewTable rows={serverPreviewOfSample()} committed={false} onCommit={noopAsync} />).replace(
      /<!-- -->/g,
      '',
    );
    expect(html).toContain('data-testid="bulk-row-2"');
    expect(html).not.toContain('bulk-row-error-2');
    expect(html).toMatch(/data-testid="bulk-row-error-5"[^>]*>미등록 품목코드</);
    expect(html).toMatch(/data-testid="bulk-row-error-7"[^>]*>수량이 0 이하</);
    expect(html).toMatch(/data-testid="bulk-row-error-9"[^>]*>같은 붙여넣기 안 송장번호 중복</);
    expect(html).toContain('전체 10행 · 유효 7행 · 오류 3행');
    expect(html).toMatch(/data-testid="btn-bulk-commit"[^>]*>유효한 7행 반영</);
    expect(html).not.toMatch(/data-testid="btn-bulk-commit"[^>]*disabled/);
  });
  it('V-02 (실패해야 함) 유효 0행 · 이미 반영함 → 반영 버튼 잠금', () => {
    const allBad = serverPreviewOfSample().map((r) => ({ ...r, valid: false, errors: ['이미 등록된 송장번호' as const] }));
    expect(renderToString(<PreviewTable rows={allBad} committed={false} onCommit={noopAsync} />)).toMatch(
      /data-testid="btn-bulk-commit"[^>]*disabled/,
    );
    expect(renderToString(<PreviewTable rows={serverPreviewOfSample()} committed onCommit={noopAsync} />)).toMatch(
      /data-testid="btn-bulk-commit"[^>]*disabled/,
    );
  });
  it('V-03 행이 없으면 "행이 없어요", 반영 버튼 없음', () => {
    const html = renderToString(<PreviewTable rows={[]} committed={false} onCommit={noopAsync} />);
    expect(html).toContain('행이 없어요');
    expect(html).toContain('data-testid="bulk-preview-empty"');
    expect(html).not.toContain('btn-bulk-commit');
  });
});

describe('C: 반영 본문 · 결과', () => {
  it('C-01 (실패해야 함) 반영 본문에는 서버가 유효로 준 행만, 미리보기 칸(valid · errors)은 빠진다', () => {
    const rows = validRowsForCommit(serverPreviewOfSample());
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4, 6, 8, 10, 11]);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(['invoice_no', 'kind', 'line', 'memo', 'partner', 'qty', 'sku_id']);
  });
  it('C-02 결과 "7행 반영, 3행 제외" + 줄별 사유(미리보기 오류 3)', () => {
    const { headline, reasons } = bulkResultLines(serverPreviewOfSample(), { applied: 7, skipped: [] });
    expect(headline).toBe('7행 반영, 3행 제외');
    expect(reasons).toEqual(['5줄: 미등록 품목코드', '7줄: 수량이 0 이하', '9줄: 같은 붙여넣기 안 송장번호 중복']);
  });
  it('C-03 같은 붙여넣기를 다시 반영(T-S4-4): 서버가 건너뛴 행도 제외로 센다', () => {
    const { headline, reasons } = bulkResultLines([], {
      applied: 0,
      skipped: [{ line: 2, code: 'PF_DUPLICATE_INVOICE', message: '이미 등록된 송장번호예요 (INV-101)' }],
    });
    expect(headline).toBe('0행 반영, 1행 제외');
    expect(reasons).toEqual(['2줄: 이미 등록된 송장번호예요 (INV-101)']);
  });
});

describe('T: 탭 · 입력 칸', () => {
  it('T-01 ?tab=bulk → 일괄 등록 탭, 상태 필터는 버린다', () => {
    expect(parseTradesQuery({ tab: 'bulk', status: '발주완료' })).toEqual({ tab: 'bulk', status: null });
    expect(tradesUrl('bulk')).toBe('/trades?tab=bulk');
  });
  it('T-02 붙여넣기 칸 testid · 형식 선택 · 예시 · 미리보기 버튼', () => {
    const html = renderToString(<PasteBox text="" format="tsv" onChange={() => {}} onPreview={noopAsync} />);
    for (const id of ['bulk-textarea', 'bulk-format', 'btn-bulk-sample', 'btn-bulk-preview']) {
      expect(html).toContain(`data-testid="${id}"`);
    }
  });
});
