/**
 * 일괄 등록 미리보기 — 파싱 결과에 DB 조회 결과를 겹쳐 행마다 valid · errors를 정한다 (조회만, 저장 없음).
 *
 * 하는 일
 * 1. 파싱 함수(src/lib/bulk/parse.ts, jkspawn)의 결과를 줄 번호 순 BulkRow[]로 만든다.
 *    rejected(행 수 · 크기 상한 초과)면 그 내용으로 전체 거절(PF_VALIDATION).
 *    lines가 있으면 원본 값을 살린 그 행들에서 시작하고(오류 행도 값 유지), errors의 사유(04 3.6 · 4.3 칸 문구)를 줄마다 합친다.
 *    lines가 없으면 rows · errors만으로 합치고, 파싱 오류 줄은 빈 값 + 사유만 담는다(valid=false).
 * 2. 파싱을 통과한 행은 사용자 JWT 클라이언트로 조회해 세 가지를 더 본다(RLS가 남의 행을 거른다):
 *    미등록 품목코드 · 이미 등록된 송장번호(입고=purchases, 출고=sales) · 출고 수량 대 현재 재고(오류 없는 행만 위에서부터 입고는 더하고 출고는 빼며 가용 재고에 반영).
 *    여기서 더하는 사유 문구는 src/types/erp.ts의 BULK_ERROR_REASONS(04 3.6)만 쓴다.
 * 3. 행 수는 500을 넘으면 전체 거절(PF_VALIDATION). 본문 100KB는 handler와 bulkPreview 스키마가 이미 막는다.
 * 4. insert · update · rpc를 부르지 않는다(원칙: 미리보기는 저장하지 않는다). 최종 판정은 pf_bulk_apply가 한 번 더 한다.
 *
 * 근거: docs/04-api-contract.md 3.6 · docs/05-security.md 5절 · WU-43 고치는 방법 1
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 일괄 등록 미리보기 조회 (WU-43)
 * 2026-11-24  eple  WU-13 parse 결과(rejected · lines · 칸 문구) 받기 — 501행이 빈 결과로 가던 것 · 오류 행 값이 비던 것 (WU-43)
 * 2026-11-24  eple  미리보기 재고 계산을 유효 행 순서 반영으로 (#46 리뷰)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PfError } from '@/lib/api/errors';
import type { BulkFormat, BulkRow, BulkRowInput, ValidationDetail } from '@/types/erp';
import { throwIfDbError } from './throwIfDbError';

/** 행 수 상한(05 5절). */
export const BULK_MAX_ROWS = 500;

/**
 * parse.ts의 계약(WU-13, src/lib/bulk/parse.ts의 BulkParseResult와 같은 모양).
 * - rows: 파싱 검사를 통과한 행 · errors: 줄 번호 + 사유(04 3.6 사유 또는 04 4.3 칸 문구)
 * - lines: 모든 데이터 행(원본 값, 원본 순서) · rejected: 크기 상한을 넘었으면 그 이유(이때 나머지는 비어 있다)
 * lines · rejected는 없을 수도 있다고 본다(이 라우트가 WU-13보다 먼저 만들어져 시험의 가짜 parse가 옛 모양을 쓴다).
 */
export type BulkParseFn = (
  text: string,
  format: BulkFormat,
) => {
  rows: BulkRowInput[];
  errors: Array<{ line: number; reason: string }>;
  lines?: BulkRow[];
  rejected?: ValidationDetail | null;
};

/** 파싱 오류가 난 줄의 빈 껍데기 행(lines가 없을 때만). */
function errorOnlyRow(line: number, reasons: string[]): BulkRow {
  return { line, kind: '', sku_id: '', qty: null, partner: '', invoice_no: null, memo: null, valid: false, errors: reasons };
}

/**
 * 붙여넣은 내용을 해석하고 DB 상태와 비교해 행별 결과를 만든다.
 * @throws PfError PF_VALIDATION(파싱이 전체 거절 · 행 수 500 초과) · DB 조회 오류 변환(PF_INTERNAL 등)
 * 부작용: 없음(select만).
 */
export async function previewBulk(
  supabase: SupabaseClient,
  input: { format: BulkFormat; text: string },
  parse: BulkParseFn,
): Promise<{ rows: BulkRow[] }> {
  const parsed = parse(input.text, input.format);
  // [WU-43] parse가 행 수 · 크기 상한으로 전체 거절하면 빈 행 대신 그 이유로 400 (eple)
  if (parsed.rejected) throw new PfError('PF_VALIDATION', { ...parsed.rejected });

  // 1. 줄 번호별로 합친다(한 줄에 파싱 오류가 여럿일 수 있다)
  const byLine = new Map<number, BulkRow>();
  const parsedLines = new Set<number>();
  for (const line of parsed.lines ?? []) {
    byLine.set(line.line, { ...line, errors: [...line.errors] });
  }
  for (const row of parsed.rows) {
    if (!byLine.has(row.line)) byLine.set(row.line, { ...row, valid: true, errors: [] });
    parsedLines.add(row.line);
  }
  for (const { line, reason } of parsed.errors) {
    const existing = byLine.get(line);
    if (existing) {
      existing.valid = false;
      if (!existing.errors.includes(reason)) existing.errors.push(reason);
    } else {
      byLine.set(line, errorOnlyRow(line, [reason]));
    }
  }
  if (byLine.size > BULK_MAX_ROWS) {
    throw new PfError('PF_VALIDATION', { field: 'text', reason: 'too_long', max: BULK_MAX_ROWS });
  }
  const rows = [...byLine.values()].sort((a, b) => a.line - b.line);

  // 2. 파싱을 통과한 행만 DB와 비교한다
  const checkable = rows.filter((row) => parsedLines.has(row.line) && row.errors.length === 0 && row.qty !== null);
  if (checkable.length > 0) {
    const skus = [...new Set(checkable.map((row) => row.sku_id))];
    const stockBySku = new Map<string, number>();
    const items = await supabase.from('items').select('sku_id, stock_qty').in('sku_id', skus);
    throwIfDbError(items.error);
    for (const item of (items.data ?? []) as Array<{ sku_id: string; stock_qty: number }>) stockBySku.set(item.sku_id, item.stock_qty);

    const taken = { 입고: new Set<string>(), 출고: new Set<string>() };
    for (const [kind, table] of [['입고', 'purchases'], ['출고', 'sales']] as const) {
      const invoices = [...new Set(checkable.filter((row) => row.kind === kind && row.invoice_no).map((row) => row.invoice_no as string))];
      if (invoices.length === 0) continue;
      const found = await supabase.from(table).select('invoice_no').in('invoice_no', invoices);
      throwIfDbError(found.error);
      for (const entry of (found.data ?? []) as Array<{ invoice_no: string }>) taken[kind].add(entry.invoice_no);
    }

    // [#46 리뷰] 제외될 행이 재고를 선점 · 앞선 입고를 반영 안 함 → 유효한 행만 순서대로 가용 재고에 반영 (eple)
    const available = new Map(stockBySku); // 품목별 가용 재고(pf_bulk_apply가 행 순서대로 반영하는 것과 같게)
    for (const row of checkable) {
      if (!stockBySku.has(row.sku_id)) {
        row.errors.push('미등록 품목코드');
        continue;
      }
      const stock = available.get(row.sku_id) ?? 0;
      if ((row.kind === '입고' || row.kind === '출고') && row.invoice_no && taken[row.kind].has(row.invoice_no)) {
        row.errors.push('이미 등록된 송장번호');
      }
      if (row.kind === '출고' && row.qty !== null && row.qty > stock) {
        row.errors.push('출고 수량이 재고보다 많음(미리보기 시점 기준)');
      }
      // 오류가 하나도 없는 행만 가용 재고에 반영한다(오류 행은 재고를 바꾸지 않는다)
      if (row.errors.length === 0 && row.qty !== null) {
        if (row.kind === '입고') available.set(row.sku_id, stock + row.qty);
        else if (row.kind === '출고') available.set(row.sku_id, stock - row.qty);
      }
    }
  }

  for (const row of rows) row.valid = row.errors.length === 0;
  return { rows };
}
