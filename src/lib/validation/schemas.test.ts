/**
 * T-VAL-7 검증 스키마 단위 테스트 — 04 4.2의 칸마다 최소 · 최대 · 하나 넘음 · 빈 값 · 형식 오류,
 * 정규화(공백 · "" → null), 계약에 없는 필드 거부, 정수만.
 *
 * 하는 일: 기대(field · reason · min · max)를 표로 먼저 적고 parseWith 결과와 비교한다.
 *
 * 근거: docs/04-api-contract.md 4.1 · 4.2 · 4.3, WU-03 8번 · T-VAL-7
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — T-VAL-7 필드별 경계 · 정규화 · strict 시험 (WU-03)
 * 2026-11-24  eple  C-86 bulkPreview 끝 탭 보존 시험 추가 (#60)
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { VALIDATION_REASONS, type ValidationDetail } from '@/types/erp';
import { parseJsonText, parseWith, toValidationDetail } from './detail';
import {
  agentAction,
  agentExecute,
  bulkCommit,
  bulkPreview,
  bulkRow,
  chatMessage,
  draftPoRequest,
  itemCreate,
  itemUpdate,
  loginInput,
  makeReceive,
  poConfirm,
  purchaseCreate,
  purchaseListQuery,
  purchaseStatusChange,
  receive,
  saleCreate,
  saleListQuery,
  saleStatusChange,
  seedRequest,
  stockLogsQuery,
  uuidParam,
} from './schemas';
import { toNumberInput, toUpperSku } from './fields';

const ok = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const r = parseWith(schema, input);
  if (!r.ok) throw new Error(`통과해야 하는데 실패: ${JSON.stringify(r.detail)}`);
  return r.data;
};

const fail = (schema: z.ZodType, input: unknown): ValidationDetail => {
  const r = parseWith(schema, input);
  if (r.ok) throw new Error(`실패해야 하는데 통과: ${JSON.stringify(input)}`);
  return r.detail;
};

/** 기대 표의 한 줄: [설명, 입력에서 바꿀 값, 기대 detail] */
type Case = [string, unknown, ValidationDetail];

/** base에서 field 하나만 바꾼 입력으로 표를 돌린다. 값이 undefined 심볼이면 키를 지운다. */
const MISSING = Symbol('missing');
function runTable(schema: z.ZodType, base: Record<string, unknown>, field: string, cases: Case[]) {
  for (const [name, value, expected] of cases) {
    it(`${field}: ${name}`, () => {
      const input = { ...base };
      if (value === MISSING) delete input[field];
      else input[field] = value;
      expect(fail(schema, input)).toEqual(expected);
    });
  }
}

const itemBase = {
  sku_id: 'PRD-001',
  item_name: '박스',
  unit_cost: 1000,
  sale_price: 2000,
  safety_stock: 5,
  source_url: 'https://example.test/a',
};
const purchaseBase = { sku_id: 'PRD-001', supplier: '다이소', order_qty: 10, purchase_cost: 5000, invoice_no: 'INV-1' };
const saleBase = { sku_id: 'PRD-001', channel: '스마트스토어', sold_qty: 3, sale_amount: 9000, invoice_no: 'S-INV_1' };

const req = (field: string): ValidationDetail => ({ field, reason: 'required' });
const range = (field: string, min: number, max: number): ValidationDetail => ({
  field,
  reason: 'out_of_range',
  min,
  max,
});
const notInt = (field: string): ValidationDetail => ({ field, reason: 'not_integer' });
const tooLong = (field: string, max: number): ValidationDetail => ({ field, reason: 'too_long', max });
const badFormat = (field: string): ValidationDetail => ({ field, reason: 'bad_format' });

/** 정수 칸 공통 표: 최소 · 최대 · 하나 넘음 · 빈 값 · 형식 오류 */
function intCases(field: string, min: number, max: number): Case[] {
  return [
    [`${min - 1}은 범위 밖`, min - 1, range(field, min, max)],
    [`${max + 1}은 범위 밖(하나 넘음)`, max + 1, range(field, min, max)],
    ['빈 문자열은 required', '', req(field)],
    ['null은 required', null, req(field)],
    ['키가 없으면 required', MISSING, req(field)],
    ['소수 1.5는 not_integer', 1.5, notInt(field)],
    ['문자 숫자 "10"은 not_integer', '10', notInt(field)],
    ['글자 "abc"는 not_integer', 'abc', notInt(field)],
    ['지수 표기 문자열 "1e3"은 not_integer', '1e3', notInt(field)],
    ['true는 not_integer', true, notInt(field)],
  ];
}

describe('T-VAL-7 itemCreate (04 4.2 품목)', () => {
  it('T-VAL-7 정상 입력은 통과하고 정규화된다', () => {
    const data = ok(itemCreate, { ...itemBase, item_name: '  박스  ', source_url: '  ' });
    expect(data).toEqual({ ...itemBase, item_name: '박스', source_url: null });
  });
  it('T-VAL-7 선택 칸(source_url)을 안 보내도 null이 된다', () => {
    const rest: Record<string, unknown> = { ...itemBase };
    delete rest.source_url;
    expect(ok(itemCreate, rest).source_url).toBeNull();
  });
  it('T-VAL-7 경계값(최소 · 최대)은 통과한다', () => {
    expect(
      ok(itemCreate, {
        sku_id: 'A-1',
        item_name: 'x'.repeat(100),
        unit_cost: 0,
        sale_price: 1_000_000_000,
        safety_stock: 100_000,
        source_url: 'u'.repeat(500),
      }),
    ).toMatchObject({ unit_cost: 0, sale_price: 1_000_000_000, safety_stock: 100_000 });
  });

  describe('sku_id', () => {
    const cases: Case[] = [
      ['빈 값은 required', '', req('sku_id')],
      ['공백만 있으면 required', '   ', req('sku_id')],
      ['키가 없으면 required', MISSING, req('sku_id')],
      ['2자(최소 미만)는 bad_format', 'A-', badFormat('sku_id')],
      ['21자(하나 넘음)는 too_long', 'A'.repeat(21), tooLong('sku_id', 20)],
      ['소문자는 bad_format(서버는 대문자만)', 'prd-001', badFormat('sku_id')],
      ['하이픈으로 시작하면 bad_format', '-PRD1', badFormat('sku_id')],
      ['허용 밖 글자(밑줄)는 bad_format', 'PRD_001', badFormat('sku_id')],
      ['한글은 bad_format', '품목001', badFormat('sku_id')],
      ['숫자 타입은 bad_format', 123, badFormat('sku_id')],
    ];
    runTable(itemCreate, itemBase, 'sku_id', cases);
    it('3자 · 20자 · 숫자로 시작은 통과', () => {
      for (const sku of ['A-1', 'A'.repeat(20), '1ABC', '  PRD-001  ']) {
        expect(ok(itemCreate, { ...itemBase, sku_id: sku }).sku_id).toBe(sku.trim());
      }
    });
  });

  describe('item_name', () => {
    runTable(itemCreate, itemBase, 'item_name', [
      ['빈 값은 required', '', req('item_name')],
      ['공백만 있으면 required', '   ', req('item_name')],
      ['키가 없으면 required', MISSING, req('item_name')],
      ['101자(하나 넘음)는 too_long', 'x'.repeat(101), tooLong('item_name', 100)],
      ['글자가 아니면 bad_format', 5, badFormat('item_name')],
    ]);
  });

  for (const field of ['unit_cost', 'sale_price'] as const) {
    describe(field, () => runTable(itemCreate, itemBase, field, intCases(field, 0, 1_000_000_000)));
  }
  describe('safety_stock', () => runTable(itemCreate, itemBase, 'safety_stock', intCases('safety_stock', 0, 100_000)));

  describe('source_url', () => {
    runTable(itemCreate, itemBase, 'source_url', [['501자(하나 넘음)는 too_long', 'u'.repeat(501), tooLong('source_url', 500)]]);
    it('빈 값 · 공백 · null은 null', () => {
      for (const v of ['', '   ', null]) expect(ok(itemCreate, { ...itemBase, source_url: v }).source_url).toBeNull();
    });
  });

  describe('strict — 계약에 없는 필드는 거부 (04 4.1)', () => {
    for (const key of ['stock_qty', 'user_id', 'id', 'created_at', 'extra']) {
      it(`${key}가 오면 not_allowed_field`, () => {
        expect(fail(itemCreate, { ...itemBase, [key]: 1 })).toEqual({ field: key, reason: 'not_allowed_field' });
      });
    }
  });
});

describe('T-VAL-7 itemUpdate (PATCH — 일부 필드)', () => {
  it('보낸 필드만 정규화해 돌려준다(없는 필드를 만들지 않는다)', () => {
    expect(ok(itemUpdate, { item_name: ' 새 이름 ' })).toEqual({ item_name: '새 이름' });
    expect(ok(itemUpdate, { sale_price: 0 })).toEqual({ sale_price: 0 });
  });
  it('source_url은 빈 값 → null로 지울 수 있다', () => {
    expect(ok(itemUpdate, { source_url: '' })).toEqual({ source_url: null });
  });
  it('하나도 안 보내면 required(field body)', () => {
    expect(fail(itemUpdate, {})).toEqual(req('body'));
  });
  it('stock_qty · sku_id · user_id는 not_allowed_field', () => {
    for (const key of ['stock_qty', 'sku_id', 'user_id']) {
      expect(fail(itemUpdate, { item_name: 'a', [key]: 'X' })).toEqual({ field: key, reason: 'not_allowed_field' });
    }
  });
  it('필수 칸을 빈 값으로 바꾸려 하면 required', () => {
    expect(fail(itemUpdate, { item_name: '  ' })).toEqual(req('item_name'));
    expect(fail(itemUpdate, { unit_cost: '' })).toEqual(req('unit_cost'));
    expect(fail(itemUpdate, { safety_stock: null })).toEqual(req('safety_stock'));
  });
  it('범위 · 정수 · 길이 검사는 생성과 같다', () => {
    expect(fail(itemUpdate, { unit_cost: 1_000_000_001 })).toEqual(range('unit_cost', 0, 1_000_000_000));
    expect(fail(itemUpdate, { safety_stock: 100_001 })).toEqual(range('safety_stock', 0, 100_000));
    expect(fail(itemUpdate, { sale_price: 1.5 })).toEqual(notInt('sale_price'));
    expect(fail(itemUpdate, { item_name: 'x'.repeat(101) })).toEqual(tooLong('item_name', 100));
    expect(fail(itemUpdate, { source_url: 'u'.repeat(501) })).toEqual(tooLong('source_url', 500));
  });
});

describe('T-VAL-7 purchaseCreate (04 4.2 구매)', () => {
  it('정상 입력 통과, 송장번호 빈 값은 null', () => {
    expect(ok(purchaseCreate, purchaseBase)).toEqual(purchaseBase);
    expect(ok(purchaseCreate, { ...purchaseBase, invoice_no: '' }).invoice_no).toBeNull();
  });
  it('송장번호를 안 보내도 null', () => {
    const rest: Record<string, unknown> = { ...purchaseBase };
    delete rest.invoice_no;
    expect(ok(purchaseCreate, rest).invoice_no).toBeNull();
  });
  describe('sku_id', () => runTable(purchaseCreate, purchaseBase, 'sku_id', [
    ['빈 값은 required', '', req('sku_id')],
    ['소문자는 bad_format', 'prd-001', badFormat('sku_id')],
    ['21자는 too_long', 'A'.repeat(21), tooLong('sku_id', 20)],
  ]));
  describe('supplier', () => runTable(purchaseCreate, purchaseBase, 'supplier', [
    ['빈 값은 required', '', req('supplier')],
    ['공백만은 required', '  ', req('supplier')],
    ['키가 없으면 required', MISSING, req('supplier')],
    ['51자(하나 넘음)는 too_long', 's'.repeat(51), tooLong('supplier', 50)],
  ]));
  it('supplier 50자는 통과', () => {
    expect(ok(purchaseCreate, { ...purchaseBase, supplier: 's'.repeat(50) }).supplier).toHaveLength(50);
  });
  describe('order_qty', () => runTable(purchaseCreate, purchaseBase, 'order_qty', intCases('order_qty', 1, 100_000)));
  describe('purchase_cost', () => runTable(purchaseCreate, purchaseBase, 'purchase_cost', intCases('purchase_cost', 0, 1_000_000_000)));
  describe('invoice_no', () => runTable(purchaseCreate, purchaseBase, 'invoice_no', [
    ['51자(하나 넘음)는 too_long', 'A'.repeat(51), tooLong('invoice_no', 50)],
    ['공백이 낀 글자는 bad_format', 'A B', badFormat('invoice_no')],
    ['허용 밖 글자(#)는 bad_format', 'INV#1', badFormat('invoice_no')],
    ['한글은 bad_format', '송장1', badFormat('invoice_no')],
  ]));
  it('invoice_no 1자 · 50자 · 하이픈 · 밑줄은 통과', () => {
    for (const v of ['1', 'A'.repeat(50), 'a-b_c']) expect(ok(purchaseCreate, { ...purchaseBase, invoice_no: v }).invoice_no).toBe(v);
  });
  it('계약에 없는 필드(user_id · source · status)는 not_allowed_field', () => {
    for (const key of ['user_id', 'source', 'status', 'received_qty']) {
      expect(fail(purchaseCreate, { ...purchaseBase, [key]: 'x' })).toEqual({ field: key, reason: 'not_allowed_field' });
    }
  });
});

describe('T-VAL-7 receive (입고 확정)', () => {
  describe('received_qty', () => runTable(receive, { received_qty: 5 }, 'received_qty', intCases('received_qty', 1, 100_000)));
  it('makeReceive: 1 ~ 그 구매의 order_qty', () => {
    const schema = makeReceive(10);
    expect(ok(schema, { received_qty: 1 }).received_qty).toBe(1);
    expect(ok(schema, { received_qty: 10 }).received_qty).toBe(10);
    expect(fail(schema, { received_qty: 11 })).toEqual(range('received_qty', 1, 10));
    expect(fail(schema, { received_qty: 0 })).toEqual(range('received_qty', 1, 10));
    expect(fail(schema, { received_qty: '' })).toEqual(req('received_qty'));
    expect(fail(schema, { received_qty: 2.5 })).toEqual(notInt('received_qty'));
  });
  it('order_qty가 1이면 1만 통과', () => {
    expect(fail(makeReceive(1), { received_qty: 2 })).toEqual(range('received_qty', 1, 1));
  });
  it('계약에 없는 필드는 거부', () => {
    expect(fail(receive, { received_qty: 1, stock_qty: 9 })).toEqual({ field: 'stock_qty', reason: 'not_allowed_field' });
  });
});

describe('T-VAL-7 saleCreate (04 4.2 판매)', () => {
  it('정상 입력 통과 · 송장번호 빈 값 null', () => {
    expect(ok(saleCreate, saleBase)).toEqual(saleBase);
    expect(ok(saleCreate, { ...saleBase, invoice_no: '  ' }).invoice_no).toBeNull();
  });
  describe('channel', () => runTable(saleCreate, saleBase, 'channel', [
    ['빈 값은 required', '', req('channel')],
    ['키가 없으면 required', MISSING, req('channel')],
    ['31자(하나 넘음)는 too_long', 'c'.repeat(31), tooLong('channel', 30)],
  ]));
  it('channel 30자는 통과', () => {
    expect(ok(saleCreate, { ...saleBase, channel: 'c'.repeat(30) }).channel).toHaveLength(30);
  });
  describe('sold_qty', () => runTable(saleCreate, saleBase, 'sold_qty', intCases('sold_qty', 1, 100_000)));
  describe('sale_amount', () => runTable(saleCreate, saleBase, 'sale_amount', intCases('sale_amount', 0, 1_000_000_000)));
  describe('sku_id', () => runTable(saleCreate, saleBase, 'sku_id', [['빈 값은 required', '', req('sku_id')]]));
  describe('invoice_no', () => runTable(saleCreate, saleBase, 'invoice_no', [['51자는 too_long', 'A'.repeat(51), tooLong('invoice_no', 50)]]));
  it('계약에 없는 필드는 거부', () => {
    expect(fail(saleCreate, { ...saleBase, fulfillment_status: '출고완료' })).toEqual({
      field: 'fulfillment_status',
      reason: 'not_allowed_field',
    });
  });
});

describe('T-VAL-7 상태 변경 · 목록 필터 · 시드 (to · status · dataset)', () => {
  it('구매 to: 허용 3개만 통과', () => {
    for (const to of ['이동·통관중', '품절', '취소']) expect(ok(purchaseStatusChange, { to }).to).toBe(to);
  });
  it('구매 to: 입고완료 · 영어 · 오타는 not_allowed_value', () => {
    for (const to of ['입고완료', '입고취소', '발주완료', 'cancel', '이동통관중']) {
      expect(fail(purchaseStatusChange, { to })).toEqual({ field: 'to', reason: 'not_allowed_value' });
    }
  });
  it('구매 to: 빈 값 · 키 없음은 required', () => {
    expect(fail(purchaseStatusChange, { to: '' })).toEqual(req('to'));
    expect(fail(purchaseStatusChange, {})).toEqual(req('to'));
  });
  it('판매 to: 출고대기 · 주문취소만 통과', () => {
    for (const to of ['출고대기', '주문취소']) expect(ok(saleStatusChange, { to }).to).toBe(to);
    for (const to of ['출고완료', '출고취소', '주문접수']) {
      expect(fail(saleStatusChange, { to })).toEqual({ field: 'to', reason: 'not_allowed_value' });
    }
    expect(fail(saleStatusChange, { to: ' ' })).toEqual(req('to'));
  });
  it('to 숫자 타입은 not_allowed_value', () => {
    expect(fail(saleStatusChange, { to: 1 })).toEqual({ field: 'to', reason: 'not_allowed_value' });
  });
  it('목록 status 필터: 선택(빈 값 · 없음 → null), 목록 밖은 not_allowed_value', () => {
    expect(ok(purchaseListQuery, {})).toEqual({ status: null });
    expect(ok(purchaseListQuery, { status: '' })).toEqual({ status: null });
    expect(ok(purchaseListQuery, { status: '입고완료' })).toEqual({ status: '입고완료' });
    expect(fail(purchaseListQuery, { status: '출고완료' })).toEqual({ field: 'status', reason: 'not_allowed_value' });
    expect(ok(saleListQuery, { status: '출고완료' })).toEqual({ status: '출고완료' });
    expect(fail(saleListQuery, { status: '입고완료' })).toEqual({ field: 'status', reason: 'not_allowed_value' });
  });
  it('dataset: demo · small · large만', () => {
    for (const dataset of ['demo', 'small', 'large']) expect(ok(seedRequest, { dataset }).dataset).toBe(dataset);
    expect(fail(seedRequest, { dataset: 'huge' })).toEqual({ field: 'dataset', reason: 'not_allowed_value' });
    expect(fail(seedRequest, { dataset: '' })).toEqual(req('dataset'));
    expect(fail(seedRequest, {})).toEqual(req('dataset'));
    expect(fail(seedRequest, { dataset: 'demo', user_id: 'x' })).toEqual({ field: 'user_id', reason: 'not_allowed_field' });
  });
});

describe('T-VAL-7 stockLogsQuery (limit · cursor · sku_id)', () => {
  it('아무것도 없으면 기본값 limit 20, 나머지 null', () => {
    expect(ok(stockLogsQuery, {})).toEqual({ sku_id: null, limit: 20, cursor: null });
  });
  it('쿼리 문자열 limit "20" · 숫자 20 모두 통과, 빈 값은 기본 20', () => {
    expect(ok(stockLogsQuery, { limit: '50' }).limit).toBe(50);
    expect(ok(stockLogsQuery, { limit: 1 }).limit).toBe(1);
    expect(ok(stockLogsQuery, { limit: '' }).limit).toBe(20);
  });
  describe('limit', () => {
    runTable(stockLogsQuery, {}, 'limit', [
      ['0은 범위 밖', 0, range('limit', 1, 50)],
      ['51은 범위 밖(하나 넘음)', 51, range('limit', 1, 50)],
      ['"51"도 범위 밖', '51', range('limit', 1, 50)],
      ['소수 1.5는 not_integer', 1.5, notInt('limit')],
      ['"1.5"는 not_integer', '1.5', notInt('limit')],
      ['"abc"는 not_integer', 'abc', notInt('limit')],
    ]);
  });
  describe('cursor', () => {
    runTable(stockLogsQuery, {}, 'cursor', [['201자(하나 넘음)는 too_long', 'c'.repeat(201), tooLong('cursor', 200)]]);
    it('200자 통과 · 빈 값은 null', () => {
      expect(ok(stockLogsQuery, { cursor: 'c'.repeat(200) }).cursor).toHaveLength(200);
      expect(ok(stockLogsQuery, { cursor: '' }).cursor).toBeNull();
    });
  });
  it('sku_id: 빈 값 null, 소문자 bad_format', () => {
    expect(ok(stockLogsQuery, { sku_id: '' }).sku_id).toBeNull();
    expect(ok(stockLogsQuery, { sku_id: 'PRD-001' }).sku_id).toBe('PRD-001');
    expect(fail(stockLogsQuery, { sku_id: 'prd-001' })).toEqual(badFormat('sku_id'));
  });
  it('받지 않는 쿼리 이름은 거부', () => {
    expect(fail(stockLogsQuery, { offset: '1' })).toEqual({ field: 'offset', reason: 'not_allowed_field' });
  });
});

describe('T-VAL-7 일괄 등록 (bulkPreview · bulkRow · bulkCommit)', () => {
  const rowBase = { line: 2, kind: '입고', sku_id: 'PRD-001', qty: 5, partner: '거래처', invoice_no: null, memo: null };
  it('bulkRow 정상 · 빈 값 → null', () => {
    expect(ok(bulkRow, rowBase)).toEqual(rowBase);
    expect(ok(bulkRow, { ...rowBase, invoice_no: '  ', memo: '' })).toEqual(rowBase);
  });
  describe('kind', () => runTable(bulkRow, rowBase, 'kind', [
    ['빈 값은 required', '', req('kind')],
    ['목록 밖은 not_allowed_value', '반품', { field: 'kind', reason: 'not_allowed_value' }],
  ]));
  describe('qty', () => runTable(bulkRow, rowBase, 'qty', intCases('qty', 1, 100_000)));
  describe('line', () => runTable(bulkRow, rowBase, 'line', [
    ['0은 범위 밖', 0, range('line', 1, 1_000_000)],
    ['소수는 not_integer', 1.5, notInt('line')],
  ]));
  describe('sku_id', () => runTable(bulkRow, rowBase, 'sku_id', [
    ['소문자는 bad_format', 'prd-001', badFormat('sku_id')],
    ['빈 값은 required', '', req('sku_id')],
  ]));
  describe('partner (입고=거래처 50자)', () => runTable(bulkRow, rowBase, 'partner', [
    ['빈 값은 required', '', req('partner')],
    ['51자는 too_long(50)', 'p'.repeat(51), tooLong('partner', 50)],
  ]));
  it('출고의 거래처(channel)는 30자까지 — 31자는 too_long(30)', () => {
    expect(ok(bulkRow, { ...rowBase, kind: '출고', partner: 'p'.repeat(30) }).partner).toHaveLength(30);
    expect(fail(bulkRow, { ...rowBase, kind: '출고', partner: 'p'.repeat(31) })).toEqual(tooLong('partner', 30));
  });
  describe('invoice_no / memo', () => {
    runTable(bulkRow, rowBase, 'invoice_no', [['51자는 too_long', 'A'.repeat(51), tooLong('invoice_no', 50)]]);
    runTable(bulkRow, rowBase, 'memo', [['201자(하나 넘음)는 too_long', 'm'.repeat(201), tooLong('memo', 200)]]);
    it('memo 200자 통과', () => {
      expect(ok(bulkRow, { ...rowBase, memo: 'm'.repeat(200) }).memo).toHaveLength(200);
    });
  });
  it('bulkRow strict', () => {
    expect(fail(bulkRow, { ...rowBase, valid: true })).toEqual({ field: 'valid', reason: 'not_allowed_field' });
  });
  it('bulkCommit: 행 1~500, 행 안 오류는 경로(rows.N.field)로', () => {
    expect(ok(bulkCommit, { rows: [rowBase] }).rows).toHaveLength(1);
    expect(fail(bulkCommit, { rows: [] })).toEqual(req('rows'));
    expect(fail(bulkCommit, {})).toEqual(req('rows'));
    expect(fail(bulkCommit, { rows: Array.from({ length: 501 }, () => rowBase) })).toEqual(tooLong('rows', 500));
    expect(ok(bulkCommit, { rows: Array.from({ length: 500 }, () => rowBase) }).rows).toHaveLength(500);
    expect(fail(bulkCommit, { rows: [rowBase, { ...rowBase, qty: 0 }] })).toEqual(range('rows.1.qty', 1, 100_000));
    expect(fail(bulkCommit, { rows: 'x' })).toEqual(badFormat('rows'));
  });
  it('bulkPreview: format tsv · csv, text 필수', () => {
    expect(ok(bulkPreview, { format: 'tsv', text: '구분\t품목코드' }).format).toBe('tsv');
    expect(fail(bulkPreview, { format: 'xlsx', text: 'a' })).toEqual({ field: 'format', reason: 'not_allowed_value' });
    expect(fail(bulkPreview, { format: 'csv', text: '  ' })).toEqual(req('text'));
    expect(fail(bulkPreview, { format: 'csv' })).toEqual(req('text'));
  });
  it('C-86 bulkPreview는 text 끝의 탭을 지우지 않고, 공백만 있는 text는 여전히 required', () => {
    const raw = '입고\tPRD-001\t1\t가나\t\t';
    expect(ok(bulkPreview, { format: 'tsv', text: raw }).text).toBe(raw);
    expect(fail(bulkPreview, { format: 'tsv', text: ' \t \n ' })).toEqual(req('text'));
  });
});

describe('T-VAL-7 에이전트 (chatMessage · draftPoRequest · poConfirm · agentExecute)', () => {
  describe('message', () => runTable(chatMessage, { message: '재고 알려줘' }, 'message', [
    ['빈 값은 required', '', req('message')],
    ['공백만은 required', '   ', req('message')],
    ['키가 없으면 required', MISSING, req('message')],
    ['501자(하나 넘음)는 too_long', 'm'.repeat(501), tooLong('message', 500)],
  ]));
  it('message 1자 · 500자는 통과, 앞뒤 공백 제거', () => {
    expect(ok(chatMessage, { message: 'a' }).message).toBe('a');
    expect(ok(chatMessage, { message: 'm'.repeat(500) }).message).toHaveLength(500);
    expect(ok(chatMessage, { message: '  안녕  ' }).message).toBe('안녕');
  });
  it('draftPoRequest: sku_ids 선택', () => {
    expect(ok(draftPoRequest, {})).toEqual({ sku_ids: null });
    expect(ok(draftPoRequest, { sku_ids: ['PRD-001'] })).toEqual({ sku_ids: ['PRD-001'] });
    expect(fail(draftPoRequest, { sku_ids: ['prd'] })).toEqual(badFormat('sku_ids.0'));
    expect(fail(draftPoRequest, { sku_ids: 'PRD-001' })).toEqual(badFormat('sku_ids'));
  });
  const line = { sku_id: 'PRD-001', supplier: '다이소', order_qty: 10, purchase_cost: 5000 };
  it('poConfirm: 줄마다 구매 규칙으로 다시 검사', () => {
    expect(ok(poConfirm, { lines: [line] }).lines).toEqual([line]);
    expect(fail(poConfirm, { lines: [] })).toEqual(req('lines'));
    expect(fail(poConfirm, { lines: [line, { ...line, order_qty: 0 }] })).toEqual(range('lines.1.order_qty', 1, 100_000));
    expect(fail(poConfirm, { lines: [{ ...line, supplier: '' }] })).toEqual(req('lines.0.supplier'));
    expect(fail(poConfirm, { lines: [{ ...line, source: 'agent' }] })).toEqual({ field: 'lines.0.source', reason: 'not_allowed_field' });
    expect(fail(poConfirm, { lines: Array.from({ length: 101 }, () => line) })).toEqual(tooLong('lines', 100));
  });
  it('agentAction: 허용 6개 통과', () => {
    const actions = [
      { type: 'get_stock', sku_id: 'PRD-001' },
      { type: 'list_low_stock' },
      { type: 'ship_quantity', sku_id: 'PRD-001', qty: 3 },
      { type: 'ship_sale', sale_id: 'S-201' },
      { type: 'set_sale_status', sale_id: 'S-201', to: '출고대기' },
      { type: 'set_purchase_status', purchase_id: 'P-101', to: '취소' },
    ];
    for (const action of actions) expect(ok(agentAction, action)).toEqual(action);
  });
  it('agentAction: 허용 밖 type · 잘못된 값은 거부', () => {
    expect(fail(agentExecute, { action: { type: 'delete_all' } })).toEqual({ field: 'action.type', reason: 'not_allowed_value' });
    expect(fail(agentExecute, { action: { type: 'ship_quantity', sku_id: 'PRD-001', qty: 0 } })).toEqual(range('action.qty', 1, 100_000));
    expect(fail(agentExecute, { action: { type: 'ship_sale', sale_id: 'DROP TABLE' } })).toEqual(badFormat('action.sale_id'));
    expect(fail(agentExecute, { action: { type: 'set_sale_status', sale_id: 'S-1', to: '출고완료' } })).toEqual({
      field: 'action.to',
      reason: 'not_allowed_value',
    });
    expect(fail(agentExecute, { action: { type: 'list_low_stock', user_id: 'x' } })).toEqual({
      field: 'action.user_id',
      reason: 'not_allowed_field',
    });
    expect(fail(agentExecute, {})).toEqual(req('action'));
  });
});

describe('T-VAL-7 로그인 · 경로 값', () => {
  it('loginInput: 이메일 형식 · 비밀번호 1자 이상(공백 보존)', () => {
    expect(ok(loginInput, { email: ' a-a@packflow.test ', password: ' pw ' })).toEqual({ email: 'a-a@packflow.test', password: ' pw ' });
    expect(fail(loginInput, { email: '', password: 'x' })).toEqual(req('email'));
    expect(fail(loginInput, { email: 'not-an-email', password: 'x' })).toEqual(badFormat('email'));
    expect(fail(loginInput, { email: 'a@packflow.test', password: '' })).toEqual(req('password'));
    expect(fail(loginInput, { email: 'a@packflow.test' })).toEqual(req('password'));
  });
  it('uuidParam: uuid만', () => {
    expect(ok(uuidParam, '123e4567-e89b-12d3-a456-426614174000')).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(fail(uuidParam, 'S-201')).toEqual(badFormat('body'));
    expect(fail(uuidParam, '')).toEqual(req('body'));
  });
});

describe('T-VAL-7 화면용 변환 · 본문 검사 · reason 목록', () => {
  it('toUpperSku: 공백 제거 + 대문자', () => {
    expect(toUpperSku('  prd-001 ')).toBe('PRD-001');
  });
  it('toNumberInput: 쉼표 · 공백 제거, 숫자 아니면 원문 유지(스키마가 막음)', () => {
    expect(toNumberInput('1,200')).toBe(1200);
    expect(toNumberInput(' 3 000 ')).toBe(3000);
    expect(toNumberInput('')).toBe('');
    expect(toNumberInput('1.5')).toBe('1.5');
    expect(toNumberInput('abc')).toBe('abc');
    expect(fail(receive, { received_qty: toNumberInput('1.5') })).toEqual(notInt('received_qty'));
  });
  it('parseJsonText: JSON 아님 · 100KB 초과는 field body', () => {
    expect(parseJsonText('{"a":1}')).toEqual({ ok: true, data: { a: 1 } });
    expect(parseJsonText('not json')).toEqual({ ok: false, detail: badFormat('body') });
    expect(parseJsonText('')).toEqual({ ok: false, detail: badFormat('body') });
    expect(parseJsonText(JSON.stringify({ a: 'x'.repeat(102_400) }))).toEqual({
      ok: false,
      detail: { field: 'body', reason: 'too_long', max: 102_400 },
    });
  });
  it('본문이 객체가 아니면(배열 · 숫자 · null) field body bad_format', () => {
    for (const body of [[], 5, null, 'x']) expect(fail(itemCreate, body)).toEqual(badFormat('body'));
  });
  it('reason 값은 04 4.3 목록 7개와 정확히 같다', () => {
    expect([...VALIDATION_REASONS].sort()).toEqual(
      ['bad_format', 'not_allowed_field', 'not_allowed_value', 'not_integer', 'out_of_range', 'required', 'too_long'].sort(),
    );
  });
  it('어떤 스키마가 내는 reason이든 목록 안에 있다(표 전체 훑기)', () => {
    const samples: Array<[z.ZodType, unknown]> = [
      [itemCreate, {}],
      [purchaseCreate, { ...purchaseBase, order_qty: 'x' }],
      [saleCreate, { ...saleBase, sold_qty: 0 }],
      [purchaseStatusChange, { to: 'x' }],
      [itemCreate, { ...itemBase, zzz: 1 }],
      [itemCreate, { ...itemBase, item_name: 'x'.repeat(101) }],
      [itemCreate, 7],
    ];
    for (const [schema, input] of samples) {
      expect(VALIDATION_REASONS).toContain(fail(schema, input).reason);
    }
  });
  it('toValidationDetail: 이슈가 없으면 body bad_format', () => {
    expect(toValidationDetail({ issues: [] } as unknown as z.ZodError)).toEqual(badFormat('body'));
  });
});
