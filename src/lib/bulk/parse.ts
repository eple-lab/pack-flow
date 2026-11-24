/**
 * 일괄 등록 붙여넣기(TSV) · CSV 파싱 — 순수 함수. 서버 미리보기 라우트(eple)가 이 함수로 줄 · 칸을 나눈다.
 *
 * 하는 일
 * 1. 크기 상한(100KB · 데이터 500행)을 넘으면 행을 하나도 돌려주지 않고 전체 거절한다(05 5절).
 * 2. 줄바꿈 `\r\n` · `\n`, TSV는 탭, CSV는 쉼표 + 큰따옴표 감싼 값(`""` 이스케이프 · 따옴표 안 줄바꿈)으로 나눈다.
 *    엑셀 · 시트 복사본도 셀 안 줄바꿈은 따옴표로 감싸므로 TSV도 같은 규칙으로 읽는다.
 * 3. 첫 줄이 `구분, 품목코드, 수량, 거래처, 송장번호, 비고` 머리글이면 건너뛴다. 빈 줄은 건너뛴다. 줄 번호는 원본 기준.
 * 4. 행 판정: 열 개수 6이 아니면 `열 개수 오류`, 구분이 입고/출고가 아니면 `구분 값 오류`, 수량이 1 이상 정수가 아니면
 *    `수량이 0 이하`(04 3.6). 그 밖의 칸 규칙(품목코드 형식 · 거래처 길이 · 송장 형식 · 메모 200자 · 수량 상한)은
 *    `bulkRow` 스키마가 판정하고 04 4.3 문구를 쓴다(새 문구를 짓지 않음).
 * 5. 같은 붙여넣기 안 같은 송장번호는 구분(입고 · 출고)별로 두 번째부터 `같은 붙여넣기 안 송장번호 중복`(P-16).
 * 6. `=` · `+` · `-` · `@`로 시작하는 셀은 계산하지 않고 글자 그대로 둔다(05 5절). 이 함수는 어떤 셀도 평가하지 않는다.
 * 7. 미등록 품목코드 · 이미 등록된 송장 · 재고 비교는 DB가 필요해 여기서 보지 않는다(서버 미리보기 몫, WU-43).
 *
 * 근거: docs/04-api-contract.md 3.6 · 4.1~4.3, docs/02-decisions.md P-15 · P-16, docs/05-security.md 5절, WU-13 1번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-13
 * 2026-11-24  jkspawn  TSV · CSV 파싱 · 머리글 · 크기 상한 · 행 판정 · 같은 붙여넣기 송장 중복 구현 (WU-13)
 */
import { BODY_MAX_BYTES, bulkRow, LIMITS, parseWith, toUpperSku } from '@/lib/validation';
import { fieldMessage } from '@/lib/validation/messages';
import {
  BULK_KINDS,
  type BulkErrorReason,
  type BulkFormat,
  type BulkKind,
  type BulkRow,
  type BulkRowInput,
  type ValidationDetail,
} from '@/types/erp';

/** 템플릿 머리글(계획서 · 04 3.6 열 순서). 첫 줄이 이것과 같으면 건너뛴다. */
export const BULK_HEADER = ['구분', '품목코드', '수량', '거래처', '송장번호', '비고'] as const;

/** 한 번에 받는 데이터 행 수 상한(머리글 · 빈 줄 제외). */
export const BULK_MAX_ROWS = LIMITS.bulkRows;

/** 행 오류 하나. reason은 04 3.6 사유 또는 04 4.3 칸 문구. field는 어느 칸 때문인지(열 개수 오류는 없음). */
export type BulkParseError = {
  line: number;
  reason: BulkErrorReason | string;
  field?: keyof BulkRowInput;
};

/**
 * 파싱 결과.
 * - rows: 파싱 단계에서 유효한 행(반영 후보). 서버 미리보기가 DB 조건을 더 본다
 * - errors: 제외된 행과 사유(원본 줄 순서)
 * - lines: 모든 데이터 행을 원본 순서로(미리보기 표 · 서버가 BulkRow를 만들 때). errors에는 04 3.6 사유만 들어간다
 * - rejected: 크기 상한을 넘었으면 그 이유(이때 rows · errors · lines는 비어 있다)
 */
export type BulkParseResult = {
  rows: BulkRowInput[];
  errors: BulkParseError[];
  lines: BulkRow[];
  rejected: ValidationDetail | null;
};

const BULK_REASONS_IN_ROW: readonly string[] = [
  '열 개수 오류',
  '구분 값 오류',
  '수량이 0 이하',
  '같은 붙여넣기 안 송장번호 중복',
] satisfies readonly BulkErrorReason[];

/** 한 줄 = 한 레코드. line은 레코드가 시작한 원본 줄 번호(1부터). */
type RawRecord = { line: number; cells: string[] };

/**
 * 구분자로 나눈 레코드 목록. 큰따옴표로 감싼 칸은 그 안의 구분자 · 줄바꿈을 글자로 두고, `""`는 `"` 하나로 읽는다.
 * 따옴표가 칸 맨 앞에 있을 때만 감싼 칸으로 본다(`5"짜리`처럼 중간 따옴표는 글자).
 */
function splitRecords(text: string, delimiter: string): RawRecord[] {
  const records: RawRecord[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let atCellStart = true;
  let line = 1;
  let recordLine = 1;

  const endCell = () => {
    cells.push(cell);
    cell = '';
    atCellStart = true;
  };
  const endRecord = () => {
    endCell();
    records.push({ line: recordLine, cells });
    cells = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        if (ch === '\n') line += 1;
        if (!(ch === '\r' && text[i + 1] === '\n')) cell += ch;
      }
      continue;
    }
    if (ch === '"' && atCellStart) {
      quoted = true;
      atCellStart = false;
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === '\r' && text[i + 1] === '\n') {
      // \r\n은 \n에서 처리한다
    } else if (ch === '\n') {
      endRecord();
      line += 1;
      recordLine = line;
    } else {
      cell += ch;
      atCellStart = false;
    }
  }
  endRecord();
  return records;
}

/** 모든 칸이 비었으면 빈 줄. */
function isBlank(record: RawRecord): boolean {
  return record.cells.every((c) => c.trim() === '');
}

function isHeader(record: RawRecord): boolean {
  return record.cells.length === BULK_HEADER.length && record.cells.every((c, i) => c.trim() === BULK_HEADER[i]);
}

/** 수량 칸: 1 이상 정수(천 단위 쉼표 허용)면 숫자, 아니면 null. */
function toQty(cell: string): number | null {
  const compact = cell.trim();
  if (!/^\d+$/.test(compact) && !/^\d{1,3}(,\d{3})+$/.test(compact)) return null;
  const n = Number(compact.replace(/,/g, ''));
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

const emptyToNull = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * 붙여넣기 · CSV 글자를 행으로 나누고 파싱 단계 판정을 한다. DB를 보지 않는다.
 *
 * @param text 붙여넣은 글자 또는 CSV 파일 내용
 * @param format `tsv`(엑셀 · 시트 붙여넣기) 또는 `csv`
 * @returns rows(유효) · errors(제외 사유) · lines(전체, 원본 순서) · rejected(크기 상한 초과)
 */
export function parse(text: string, format: BulkFormat): BulkParseResult {
  const empty: BulkParseResult = { rows: [], errors: [], lines: [], rejected: null };

  if (new TextEncoder().encode(text).length > BODY_MAX_BYTES) {
    return { ...empty, rejected: { field: 'text', reason: 'too_long', max: BODY_MAX_BYTES } };
  }

  const records = splitRecords(text, format === 'csv' ? ',' : '\t').filter((r) => !isBlank(r));
  const first = records[0];
  const data = first && isHeader(first) ? records.slice(1) : records;
  if (data.length > BULK_MAX_ROWS) {
    return { ...empty, rejected: { field: 'text', reason: 'too_long', max: BULK_MAX_ROWS } };
  }

  const result: BulkParseResult = { rows: [], errors: [], lines: [], rejected: null };
  const seenInvoices = new Set<string>();

  for (const record of data) {
    const { line, cells } = record;
    const [kindCell = '', skuCell = '', qtyCell = '', partnerCell = '', invoiceCell = '', memoCell = ''] = cells;
    const qty = toQty(qtyCell);
    const row: BulkRow = {
      line,
      kind: kindCell.trim(),
      sku_id: toUpperSku(skuCell),
      qty,
      partner: partnerCell.trim(),
      invoice_no: emptyToNull(invoiceCell),
      memo: emptyToNull(memoCell),
      valid: false,
      errors: [],
    };
    const rowErrors: BulkParseError[] = [];

    if (cells.length !== BULK_HEADER.length) {
      rowErrors.push({ line, reason: '열 개수 오류' });
    } else {
      const kindOk = (BULK_KINDS as readonly string[]).includes(row.kind);
      if (!kindOk) rowErrors.push({ line, reason: '구분 값 오류', field: 'kind' });
      if (qty === null) rowErrors.push({ line, reason: '수량이 0 이하', field: 'qty' });

      // 구분 · 수량이 맞을 때만 나머지 칸을 스키마로 본다(같은 칸 사유를 두 번 쓰지 않게)
      if (kindOk && qty !== null) {
        // 스키마는 strict라 BulkRowInput 일곱 칸만 넘긴다(valid · errors 같은 미리보기 칸이 있으면 not_allowed_field)
        const parsed = parseWith(bulkRow, {
          line,
          kind: row.kind,
          sku_id: row.sku_id,
          qty,
          partner: row.partner,
          invoice_no: row.invoice_no,
          memo: row.memo,
        });
        if (!parsed.ok) {
          rowErrors.push({
            line,
            reason: fieldMessage(parsed.detail),
            field: parsed.detail.field as keyof BulkRowInput,
          });
        }
      }

      // 같은 붙여넣기 안 송장 중복 — 구분별, 첫 번째 줄이 이긴다(P-16)
      if (row.invoice_no !== null) {
        const key = `${row.kind}\u0000${row.invoice_no}`;
        if (seenInvoices.has(key)) rowErrors.push({ line, reason: '같은 붙여넣기 안 송장번호 중복', field: 'invoice_no' });
        else seenInvoices.add(key);
      }
    }

    row.errors = rowErrors.map((e) => e.reason).filter((r): r is BulkErrorReason => BULK_REASONS_IN_ROW.includes(r));
    row.valid = rowErrors.length === 0;
    result.lines.push(row);
    result.errors.push(...rowErrors);
    if (row.valid) {
      result.rows.push({
        line,
        kind: row.kind as BulkKind,
        sku_id: row.sku_id,
        qty: qty as number,
        partner: row.partner,
        invoice_no: row.invoice_no,
        memo: row.memo,
      });
    }
  }
  return result;
}
