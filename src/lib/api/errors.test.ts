/**
 * errors.ts 단위 테스트 — 함수 예외 코드 → HTTP · 04 4.4 문구, 모르는 오류 → PF_INTERNAL(원문 숨김), detail 전달.
 *
 * 하는 일: 04 2절 · 4.4 표를 기대값으로 먼저 옮기고 변환 결과와 비교한다.
 *
 * 근거: docs/04-api-contract.md 2 · 4.4, WU-03 4 · 9번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 코드 매핑 · Supabase 오류 변환 시험 (WU-03)
 * 2026-11-25  eple  한도 초과 문구 기대값을 자정으로 (#83)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_ERROR_CODES, SERVER_ERROR_CODES } from '@/types/erp';
import {
  HTTP_STATUS,
  PF_MESSAGES,
  PfError,
  errorResult,
  fromSupabaseError,
  isPfErrorCode,
  isServerErrorCode,
  messageFor,
  toErrorResult,
} from './errors';

/** 기대 표 — 04 2절(HTTP) + 4.4(문구) 원문. detail이 있는 코드는 채운 문구. */
const EXPECTED: Array<[string, number, string, Record<string, unknown> | undefined]> = [
  ['PF_UNAUTHENTICATED', 401, '로그인이 필요해요. 다시 로그인해 주세요', undefined],
  ['PF_CSRF', 403, '요청을 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요', undefined],
  ['PF_NOT_FOUND', 404, '찾을 수 없어요. 목록을 새로고침해 주세요', undefined],
  ['PF_VALIDATION', 400, '입력값을 확인해 주세요', { field: 'qty', reason: 'out_of_range', min: 1, max: 100000 }],
  ['PF_INVALID_TRANSITION', 409, '지금 상태(입고완료)에서는 취소(으)로 바꿀 수 없어요', { from: '입고완료', to: '취소', allowed: ['입고취소'] }],
  ['PF_INSUFFICIENT_STOCK', 409, '재고가 부족해요. PRD-001 남은 수량 4개', { sku_id: 'PRD-001', stock_qty: 4, requested: 9 }],
  ['PF_DUPLICATE_INVOICE', 409, '이미 등록된 송장번호예요 (INV-1)', { invoice_no: 'INV-1' }],
  ['PF_DUPLICATE_SKU', 409, '이미 있는 품목코드예요 (PRD-001)', { sku_id: 'PRD-001' }],
  ['PF_QUOTA_EXCEEDED', 429, '오늘 AI 사용 한도를 다 썼어요. 한국 시간 자정 이후 다시 쓸 수 있어요', { scope: 'user' }],
  ['PF_LLM_UNAVAILABLE', 503, 'AI가 지금 응답하지 않아요. 잠시 뒤 다시 시도해 주세요 (입출고는 그대로 쓸 수 있어요)', { provider: 'ollama' }],
  ['PF_NOT_IMPLEMENTED', 501, '아직 준비 중인 기능이에요', undefined],
  ['PF_INTERNAL', 500, '잠시 문제가 생겼어요. 다시 시도해 주세요', undefined],
];

describe('E: errors — 코드 → HTTP · 문구 (04 2절 · 4.4)', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(EXPECTED)('E-1 %s → HTTP %i, 04 4.4 문구 그대로', (code, status, message, detail) => {
    const result = errorResult(code as never, detail);
    expect(result.status).toBe(status);
    expect(result.body.error.code).toBe(code);
    expect(result.body.error.message).toBe(message);
  });

  it('E-2 서버 코드 12개가 모두 표에 있다(빠진 코드 없음)', () => {
    expect([...SERVER_ERROR_CODES].sort()).toEqual(EXPECTED.map((e) => e[0]).sort());
    for (const code of SERVER_ERROR_CODES) {
      expect(HTTP_STATUS[code]).toBeGreaterThan(0);
      expect(PF_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it('E-3 화면 전용 PF_NETWORK · PF_TIMEOUT 문구가 04 4.4와 같다', () => {
    expect([...CLIENT_ERROR_CODES]).toEqual(['PF_NETWORK', 'PF_TIMEOUT']);
    expect(PF_MESSAGES.PF_NETWORK).toBe('서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요');
    expect(PF_MESSAGES.PF_TIMEOUT).toBe('응답이 늦어요. 잠시 뒤 다시 시도해 주세요 (배포 서버가 깨어나는 중일 수 있어요)');
    expect(isServerErrorCode('PF_NETWORK')).toBe(false);
    expect(isPfErrorCode('PF_NETWORK')).toBe(true);
    expect(isPfErrorCode('PF_WHAT')).toBe(false);
  });

  it('E-4 PF_INSUFFICIENT_STOCK의 detail이 응답에 그대로 전달된다', () => {
    const detail = { sku_id: 'PRD-001', stock_qty: 4, requested: 9 };
    expect(errorResult('PF_INSUFFICIENT_STOCK', detail).body.error.detail).toEqual(detail);
  });

  it('E-5 PF_INTERNAL에는 detail을 싣지 않는다', () => {
    expect(errorResult('PF_INTERNAL', { secret: 'x' }).body.error).not.toHaveProperty('detail');
  });

  it('E-6 detail이 없거나 비면 detail 키를 만들지 않는다', () => {
    expect(errorResult('PF_NOT_FOUND').body.error).not.toHaveProperty('detail');
    expect(errorResult('PF_NOT_FOUND', {}).body.error).not.toHaveProperty('detail');
  });

  it('E-7 문구의 { } 자리는 detail 값으로, 값이 없으면 —로 채운다(원문 {from}이 보이지 않음)', () => {
    expect(messageFor('PF_INVALID_TRANSITION', { from: '발주완료' })).toBe('지금 상태(발주완료)에서는 —(으)로 바꿀 수 없어요');
    expect(messageFor('PF_INSUFFICIENT_STOCK')).not.toMatch(/[{}]/);
  });
});

describe('E: Supabase(PostgREST) 오류 변환', () => {
  afterEach(() => vi.restoreAllMocks());

  it('E-8 message=코드, details=JSON 문자열 → 코드 · HTTP · detail', () => {
    const r = fromSupabaseError({
      message: 'PF_INSUFFICIENT_STOCK',
      details: '{"sku_id":"PRD-001","stock_qty":4,"requested":9}',
      code: 'P0001',
    });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('PF_INSUFFICIENT_STOCK');
    expect(r.body.error.message).toBe('재고가 부족해요. PRD-001 남은 수량 4개');
    expect(r.body.error.detail).toEqual({ sku_id: 'PRD-001', stock_qty: 4, requested: 9 });
  });

  it('E-9 함수 예외 코드 7종 이상이 PostgREST 모양으로 와도 같은 HTTP · 문구로 바뀐다', () => {
    const fromDb = ['PF_UNAUTHENTICATED', 'PF_NOT_FOUND', 'PF_VALIDATION', 'PF_INVALID_TRANSITION', 'PF_INSUFFICIENT_STOCK', 'PF_DUPLICATE_INVOICE', 'PF_DUPLICATE_SKU', 'PF_QUOTA_EXCEEDED', 'PF_NOT_IMPLEMENTED'];
    expect(fromDb.length).toBeGreaterThanOrEqual(7);
    for (const code of fromDb) {
      const expected = EXPECTED.find((e) => e[0] === code)!;
      const r = fromSupabaseError({ message: code, details: null });
      expect(r.status).toBe(expected[1]);
      expect(r.body.error.code).toBe(code);
    }
  });

  it('E-10 details가 JSON이 아니거나 객체가 아니면 detail 없이 코드만 전달', () => {
    expect(fromSupabaseError({ message: 'PF_NOT_FOUND', details: 'not json' }).body.error).not.toHaveProperty('detail');
    expect(fromSupabaseError({ message: 'PF_NOT_FOUND', details: '[1,2]' }).body.error).not.toHaveProperty('detail');
    expect(fromSupabaseError({ message: 'PF_NOT_FOUND', details: '5' }).body.error).not.toHaveProperty('detail');
  });

  it('E-11 PF_VALIDATION detail(field · reason)이 그대로 전달된다', () => {
    const r = fromSupabaseError({ message: 'PF_VALIDATION', details: '{"field":"limit","reason":"out_of_range"}' });
    expect(r.status).toBe(400);
    expect(r.body.error.detail).toEqual({ field: 'limit', reason: 'out_of_range' });
  });

  it('E-12 모르는 오류 → PF_INTERNAL 500, 원문이 응답에 없다', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = 'duplicate key value violates unique constraint "items_user_sku" for user a@packflow.test';
    const r = fromSupabaseError({ message: raw, details: 'Key (user_id, sku_id)=(…) already exists', code: '23505' });
    expect(r.status).toBe(500);
    expect(r.body.error.code).toBe('PF_INTERNAL');
    expect(r.body.error.message).toBe('잠시 문제가 생겼어요. 다시 시도해 주세요');
    const response = JSON.stringify(r.body);
    expect(response).not.toContain('duplicate key');
    expect(response).not.toContain('items_user_sku');
    expect(response).not.toContain('already exists');
    expect(r.body.error).not.toHaveProperty('detail');
    // 원문은 서버 로그에만 — 그것도 이메일은 가려서
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = String(spy.mock.calls[0]?.[0]);
    expect(logged).toContain('duplicate key');
    expect(logged).not.toContain('a@packflow.test');
  });

  it('E-13 화면 전용 코드나 목록에 없는 PF_ 코드가 DB에서 와도 PF_INTERNAL', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const message of ['PF_NETWORK', 'PF_TIMEOUT', 'PF_MADE_UP', '', 'pf_not_found']) {
      const r = fromSupabaseError({ message });
      expect(r.body.error.code).toBe('PF_INTERNAL');
    }
    expect(fromSupabaseError({}).body.error.code).toBe('PF_INTERNAL');
  });

  it('E-14 message 앞뒤 공백은 무시하고 코드를 알아본다', () => {
    expect(fromSupabaseError({ message: ' PF_NOT_FOUND\n' }).body.error.code).toBe('PF_NOT_FOUND');
  });
});

describe('E: toErrorResult — 던져진 값 무엇이든', () => {
  afterEach(() => vi.restoreAllMocks());

  it('E-15 PfError는 코드 · detail 그대로', () => {
    const r = toErrorResult(new PfError('PF_DUPLICATE_SKU', { sku_id: 'PRD-009' }));
    expect(r.status).toBe(409);
    expect(r.body.error.detail).toEqual({ sku_id: 'PRD-009' });
  });

  it('E-16 Supabase 오류 모양 객체는 fromSupabaseError와 같다', () => {
    expect(toErrorResult({ message: 'PF_CSRF' }).status).toBe(403);
  });

  it('E-17 일반 Error · 문자열 · null은 PF_INTERNAL이고 원문이 응답에 없다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const thrown of [new Error('connect ECONNREFUSED 10.0.0.5:5432'), 'boom password=abc', null, undefined, 42]) {
      const r = toErrorResult(thrown);
      expect(r.status).toBe(500);
      expect(r.body.error.code).toBe('PF_INTERNAL');
      expect(JSON.stringify(r.body)).not.toMatch(/ECONNREFUSED|boom|10\.0\.0\.5|password/);
    }
  });
});
