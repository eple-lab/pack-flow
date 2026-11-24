/**
 * 일괄 등록 파싱 시험 — WU-13 '다 됐다' 1번 사례(정상 TSV · CSV · 머리글 · 열 개수 · 구분 · 수량 0 · 수량 문자 ·
 * 같은 송장 2회 · 수식 셀 · 빈 입력 · 501행)와 04 4.2 칸 규칙(메모 201자 · 송장 공백).
 *
 * 하는 일
 * 1. 기대값은 시험을 돌리기 전에 적었다(D-34). 실패해야 하는 입력이 절반 이상이다.
 * 2. DB 없이 도는 순수 함수 시험이다(미등록 품목코드 · 이미 등록된 송장 · 재고 비교는 서버 미리보기 몫).
 *
 * 근거: docs/work-units/WU-13-bulk.md, docs/04-api-contract.md 3.6 · 4.2 · 4.3, docs/05-security.md 5절
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-24  jkspawn  처음 작성 — 파싱 사례 시험 (WU-13)
 */
import { describe, expect, it } from 'vitest';
import { BULK_HEADER, parse } from './parse';

const HEADER_TSV = BULK_HEADER.join('\t');
const HEADER_CSV = BULK_HEADER.join(',');
const tsv = (...lines: string[]) => lines.join('\n');

describe('P: 정상 입력', () => {
  it('P-01 정상 TSV(머리글 있음, \\r\\n) → 머리글 건너뛰고 줄 번호는 원본 기준, 빈 송장 · 비고는 null', () => {
    const text = [HEADER_TSV, '입고\tPRD-001\t10\t가나물산\tINV-1\t첫 입고', '출고\tprd-002\t3\t스마트스토어\t\t'].join('\r\n');
    const result = parse(text, 'tsv');
    expect(result.rejected).toBeNull();
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { line: 2, kind: '입고', sku_id: 'PRD-001', qty: 10, partner: '가나물산', invoice_no: 'INV-1', memo: '첫 입고' },
      { line: 3, kind: '출고', sku_id: 'PRD-002', qty: 3, partner: '스마트스토어', invoice_no: null, memo: null },
    ]);
    expect(result.lines.map((l) => [l.line, l.valid])).toEqual([
      [2, true],
      [3, true],
    ]);
  });

  it('P-02 머리글 없음 → 첫 줄부터 데이터(줄 1)', () => {
    const result = parse('입고\tPRD-001\t5\t가나물산\t\t', 'tsv');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.line).toBe(1);
  });

  it('P-03 정상 CSV: 큰따옴표 안의 쉼표 · "" 이스케이프 · 천 단위 쉼표 수량', () => {
    const text = [HEADER_CSV, '입고,PRD-001,"1,200","가나, 물산",INV-2,"메모 ""중요"""'].join('\n');
    const result = parse(text, 'csv');
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toEqual({
      line: 2,
      kind: '입고',
      sku_id: 'PRD-001',
      qty: 1200,
      partner: '가나, 물산',
      invoice_no: 'INV-2',
      memo: '메모 "중요"',
    });
  });

  it('P-04 빈 줄 · 끝의 줄바꿈은 건너뛴다(엑셀 복사 끝 줄)', () => {
    const result = parse(tsv('입고\tPRD-001\t5\t가나물산\t\t', '', '   ', ''), 'tsv');
    expect(result.rows).toHaveLength(1);
    expect(result.lines).toHaveLength(1);
  });
});

describe('E: 행 오류 — 그 행만 제외하고 사유를 남긴다', () => {
  it('E-01 (실패해야 함) 열 개수 5 · 7 → 열 개수 오류', () => {
    const result = parse(tsv('입고\tPRD-001\t5\t가나물산\t', '입고\tPRD-001\t5\t가나물산\t\t\t남는 칸'), 'tsv');
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      { line: 1, reason: '열 개수 오류' },
      { line: 2, reason: '열 개수 오류' },
    ]);
  });

  it('E-02 (실패해야 함) 구분이 입고 · 출고가 아니면 구분 값 오류', () => {
    const result = parse('반품\tPRD-001\t5\t가나물산\t\t', 'tsv');
    expect(result.errors).toEqual([{ line: 1, reason: '구분 값 오류', field: 'kind' }]);
    expect(result.lines[0]).toMatchObject({ line: 1, kind: '반품', valid: false, errors: ['구분 값 오류'] });
  });

  it('E-03 (실패해야 함) 수량 0 · −3 · 1.5 · 문자 · 수식(=1+1) → 수량이 0 이하', () => {
    const qtys = ['0', '-3', '1.5', '다섯', '=1+1'];
    const result = parse(tsv(...qtys.map((q) => `입고\tPRD-001\t${q}\t가나물산\t\t`)), 'tsv');
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(qtys.map((_, i) => ({ line: i + 1, reason: '수량이 0 이하', field: 'qty' })));
    expect(result.lines[0]?.qty).toBeNull(); // 원본이 정수가 아니면 null
  });

  it('E-04 (실패해야 함) 수량 100,001 → 04 4.3 범위 문구', () => {
    const result = parse('입고\tPRD-001\t100001\t가나물산\t\t', 'tsv');
    expect(result.errors).toEqual([{ line: 1, reason: '1 ~ 100,000 사이로 입력해 주세요', field: 'qty' }]);
  });

  it('E-05 (실패해야 함) 같은 붙여넣기 안 같은 송장 2회 → 두 번째부터 중복, 첫 번째는 유효', () => {
    const result = parse(
      tsv('입고\tPRD-001\t5\t가나물산\tINV-9\t', '입고\tPRD-002\t3\t가나물산\tINV-9\t', '입고\tPRD-003\t1\t가나물산\tINV-9\t'),
      'tsv',
    );
    expect(result.rows.map((r) => r.line)).toEqual([1]);
    expect(result.errors).toEqual([
      { line: 2, reason: '같은 붙여넣기 안 송장번호 중복', field: 'invoice_no' },
      { line: 3, reason: '같은 붙여넣기 안 송장번호 중복', field: 'invoice_no' },
    ]);
  });

  it('E-06 송장 중복은 구분별로 본다(P-16: 구매 · 판매 각각) — 입고 INV-1과 출고 INV-1은 둘 다 유효', () => {
    const result = parse(tsv('입고\tPRD-001\t5\t가나물산\tINV-1\t', '출고\tPRD-001\t2\t쿠팡\tINV-1\t'), 'tsv');
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
  });

  it('E-07 (실패해야 함) 메모 201자 · 송장번호에 공백 → 04 4.3 문구', () => {
    const result = parse(
      tsv(`입고\tPRD-001\t5\t가나물산\t\t${'가'.repeat(201)}`, '입고\tPRD-001\t5\t가나물산\tINV 10\t'),
      'tsv',
    );
    expect(result.errors).toEqual([
      { line: 1, reason: '200자 이하로 입력해 주세요', field: 'memo' },
      { line: 2, reason: '형식이 맞지 않아요 (예: PRD-001)', field: 'invoice_no' },
    ]);
  });

  it('E-08 수식 셀(=, +, -, @로 시작)은 계산하지 않고 글자 그대로 둔다', () => {
    const result = parse('입고\tPRD-001\t5\t=HYPERLINK("x")\t\t@메모', 'tsv');
    expect(result.rows[0]).toMatchObject({ partner: '=HYPERLINK("x")', memo: '@메모' });
  });

  it('E-09 오류 행 · 유효 행이 섞이면 lines는 원본 순서 그대로, valid만 다르다', () => {
    const result = parse(tsv('입고\tPRD-001\t5\t가나물산\t\t', '입고\tPRD-001\t0\t가나물산\t\t', '출고\tPRD-002\t1\t쿠팡\t\t'), 'tsv');
    expect(result.lines.map((l) => [l.line, l.valid])).toEqual([
      [1, true],
      [2, false],
      [3, true],
    ]);
  });
});

describe('R: 전체 거절 · 빈 입력 (05 5절: 500행 · 100KB)', () => {
  it('R-01 빈 입력 · 공백뿐 → 행 없음, 거절 아님', () => {
    for (const text of ['', '  \n\n ']) {
      expect(parse(text, 'tsv')).toEqual({ rows: [], errors: [], lines: [], rejected: null });
    }
  });

  it('R-02 머리글만 있으면 행 없음', () => {
    expect(parse(HEADER_TSV, 'tsv').lines).toEqual([]);
  });

  it('R-03 (실패해야 함) 데이터 501행 → 전체 거절, 행을 하나도 돌려주지 않는다. 500행은 통과', () => {
    const line = '입고\tPRD-001\t1\t가나물산\t\t';
    const over = parse(tsv(HEADER_TSV, ...Array.from({ length: 501 }, () => line)), 'tsv');
    expect(over.rejected).toEqual({ field: 'text', reason: 'too_long', max: 500 });
    expect(over.rows).toEqual([]);
    expect(over.lines).toEqual([]);
    const ok = parse(tsv(...Array.from({ length: 500 }, () => line)), 'tsv');
    expect(ok.rejected).toBeNull();
    expect(ok.rows).toHaveLength(500);
  });

  it('R-04 (실패해야 함) 100KB 초과 → 전체 거절', () => {
    const result = parse(`입고\tPRD-001\t1\t가나물산\t\t${'a'.repeat(100 * 1024)}`, 'tsv');
    expect(result.rejected).toEqual({ field: 'text', reason: 'too_long', max: 100 * 1024 });
    expect(result.rows).toEqual([]);
  });
});
