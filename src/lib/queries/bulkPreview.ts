/**
 * 일괄 등록 미리보기 — 파싱 결과에 DB 조회 결과를 겹쳐 행마다 valid · errors를 정한다 (조회만, 저장 없음).
 *
 * 하는 일
 * 1. 파싱 함수(src/lib/bulk/parse.ts, jkspawn)가 돌려준 rows · errors를 줄 번호 순 BulkRow[]로 합친다.
 *    파싱 오류가 난 줄은 값을 알 수 없어 빈 값 + 사유만 담는다(valid=false).
 * 2. 파싱을 통과한 행은 사용자 JWT 클라이언트로 조회해 세 가지를 더 본다(RLS가 남의 행을 거른다):
 *    미등록 품목코드 · 이미 등록된 송장번호(입고=purchases, 출고=sales) · 출고 수량 대 현재 재고(같은 품목의 출고 행은 위에서부터 누적).
 *    사유 문구는 src/types/erp.ts의 BULK_ERROR_REASONS(04 3.6)만 쓴다.
 * 3. 행 수는 500을 넘으면 전체 거절(PF_VALIDATION). 본문 100KB는 handler와 bulkPreview 스키마가 이미 막는다.
 * 4. insert · update · rpc를 부르지 않는다(원칙: 미리보기는 저장하지 않는다). 최종 판정은 pf_bulk_apply가 한 번 더 한다.
 *
 * 근거: docs/04-api-contract.md 3.6 · docs/05-security.md 5절 · WU-43 고치는 방법 1
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 일괄 등록 미리보기 조회 (WU-43)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PfError } from '@/lib/api/errors';
import type { BulkErrorReason, BulkFormat, BulkRow, BulkRowInput } from '@/types/erp';
import { throwIfDbError } from './throwIfDbError';

/** 행 수 상한(05 5절). */
export const BULK_MAX_ROWS = 500;

/** parse.ts의 계약(WU-13): rows는 값 검사를 통과한 행, errors는 줄 번호 + 사유. */
export type BulkParseFn = (
  text: string,
  format: BulkFormat,
) => { rows: BulkRowInput[]; errors: Array<{ line: number; reason: BulkErrorReason }> };

/** 파싱 오류가 난 줄의 빈 껍데기 행. */
function errorOnlyRow(line: number, reasons: BulkErrorReason[]): BulkRow {
  return { line, kind: '', sku_id: '', qty: null, partner: '', invoice_no: null, memo: null, valid: false, errors: reasons };
}

/**
 * 붙여넣은 내용을 해석하고 DB 상태와 비교해 행별 결과를 만든다.
 * @throws PfError PF_VALIDATION(행 수 500 초과) · DB 조회 오류 변환(PF_INTERNAL 등)
 * 부작용: 없음(select만).
 */
export async function previewBulk(
  supabase: SupabaseClient,
  input: { format: BulkFormat; text: string },
  parse: BulkParseFn,
): Promise<{ rows: BulkRow[] }> {
  const parsed = parse(input.text, input.format);

  // 1. 줄 번호별로 합친다(한 줄에 파싱 오류가 여럿일 수 있다)
  const byLine = new Map<number, BulkRow>();
  const parsedLines = new Set<number>();
  for (const row of parsed.rows) {
    byLine.set(row.line, { ...row, valid: true, errors: [] });
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

    const shipped = new Map<string, number>(); // 품목별로 앞선 출고 행이 쓴 수량
    for (const row of checkable) {
      if (!stockBySku.has(row.sku_id)) {
        row.errors.push('미등록 품목코드');
        continue;
      }
      if ((row.kind === '입고' || row.kind === '출고') && row.invoice_no && taken[row.kind].has(row.invoice_no)) {
        row.errors.push('이미 등록된 송장번호');
      }
      if (row.kind === '출고' && row.qty !== null) {
        const used = shipped.get(row.sku_id) ?? 0;
        if (used + row.qty > (stockBySku.get(row.sku_id) ?? 0)) {
          row.errors.push('출고 수량이 재고보다 많음(미리보기 시점 기준)');
        } else {
          shipped.set(row.sku_id, used + row.qty); // 반영될 행만 누적한다
        }
      }
    }
  }

  for (const row of rows) row.valid = row.errors.length === 0;
  return { rows };
}
