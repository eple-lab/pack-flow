/**
 * 일괄 등록 라우트 단위 시험 — 미리보기(저장 없음) · 반영(pf_bulk_apply 한 번) · 공통 검사. 가짜 Supabase를 쓴다.
 *
 * 기대(먼저 적음)
 * - C-71 preview 정상: 재고 10인 PRD-001에 입고 1행 · 출고 4행(합 10) → 전부 valid, errors 빈 배열
 * - C-72 preview 없는 품목코드 → 그 행만 valid=false, errors ['미등록 품목코드'], 다른 행은 valid
 * - C-73 preview 이미 등록된 송장번호(입고는 purchases · 출고는 sales 기준) → '이미 등록된 송장번호'
 * - C-74 preview 출고 수량이 재고 초과 → 단독 11개는 '출고 수량이 재고보다 많음(미리보기 시점 기준)',
 *        같은 품목 출고 6 + 6(재고 10)은 첫 행 valid · 둘째 행만 오류(누적)
 * - C-75 preview 파싱 오류 줄('열 개수 오류')은 valid=false, 값 칸 빈 값 · 줄 번호 순서 유지
 * - C-76 preview는 insert · update · rpc를 한 번도 부르지 않는다(성공 · 실패 모두)
 * - C-77 preview 501행 → 400 PF_VALIDATION(field text, max 500) · 100KB 초과 본문 → 400 field body, DB · rpc 0회
 * - C-78 commit 정상: rpc pf_bulk_apply를 한 번, 인자 { p_rows: 보낸 행 그대로 }로 부르고 { applied, skipped }를 200으로 돌려줌
 * - C-79 commit 501행 · 수량 0 행 · 계약에 없는 user_id 칸 → 400, rpc 0회
 * - C-80 X-PF 헤더 없음 → 403 PF_CSRF · 로그인 안 함 → 401 PF_UNAUTHENTICATED (preview · commit 둘 다), DB · rpc 0회
 * - C-81 commit에서 DB 함수가 모르는 오류(원문 포함)를 던지면 500 PF_INTERNAL, 응답에 원문 없음
 * - C-82 parse가 아직 없으면(WU-13 병합 전) preview → 501 PF_NOT_IMPLEMENTED, DB 0회
 * - C-83 parse가 rejected(501행)를 돌려주면 → PfError PF_VALIDATION, detail { field: 'text', reason: 'too_long', max: 500 }, DB 0회 (실패해야 함)
 * - C-84 parse가 lines를 주면 오류 행도 원본 값 유지: 수량 0 행 → kind '입고' · sku_id 'PRD-001' · qty 0(lines 값 그대로), valid=false,
 *        errors ['수량이 0 이하'] / 메모 201자 행(lines의 errors는 빈 배열) → errors에 칸 문구 '200자 이하로 입력해 주세요'
 *        / 정상 행은 DB 비교를 거쳐 valid, 줄 순서 1 · 2 · 3
 * - C-86 preview 마지막 줄이 빈 칸으로 끝나도(끝 탭 2개: 송장 · 비고 빈 값 / 1개: 비고만 빈 값) 열 개수 오류가 아니고
 *        두 행 모두 valid=true, errors [] (붙여넣은 글자 끝 탭을 trim하지 않아야 통과)
 *
 * 근거: docs/04-api-contract.md 3.6 · 4절, docs/05-security.md 5절, WU-43
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 일괄 등록 라우트 단위 시험 C-71 ~ C-82 (WU-43)
 * 2026-11-24  eple  C-83 · C-84 추가 — WU-13 parse의 rejected · lines 받기 (WU-43)
 * 2026-11-24  eple  C-86 추가 — 끝 탭 보존 시험 (#60)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BulkErrorReason, BulkRowInput } from '@/types/erp';

vi.mock('server-only', () => ({}));
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => holder.client as SupabaseClient }));

/** 시험용 parse: 줄마다 탭 6칸(구분 품목코드 수량 거래처 송장 비고). 칸이 6개가 아니면 '열 개수 오류'. */
vi.mock('@/lib/bulk/parse', () => ({
  parse: (text: string) => {
    const rows: BulkRowInput[] = [];
    const errors: Array<{ line: number; reason: BulkErrorReason }> = [];
    text.split('\n').forEach((raw, index) => {
      if (raw.trim() === '') return;
      const line = index + 1;
      const cols = raw.split('\t');
      if (cols.length !== 6) {
        errors.push({ line, reason: '열 개수 오류' });
        return;
      }
      rows.push({
        line,
        kind: cols[0] as '입고' | '출고',
        sku_id: cols[1],
        qty: Number(cols[2]),
        partner: cols[3],
        invoice_no: cols[4] || null,
        memo: cols[5] || null,
      });
    });
    return { rows, errors };
  },
}));

import { POST as commit } from './commit/route';
import { POST as preview } from './preview/route';

const ORIGIN = 'https://app.packflow.test';
type Handler = (request: Request) => Promise<Response>;
type Row = Record<string, unknown>;

/** select · in 체인과 rpc 기록, 쓰기 호출 기록을 가진 가짜 Supabase. */
function fake(tables: Record<string, Row[]>, options: { claims?: { sub: string } | null; rpcError?: { message: string } } = {}) {
  const reads: string[] = [];
  const writes: string[] = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const claims = options.claims === undefined ? { sub: '00000000-0000-4000-8000-000000000001' } : options.claims;
  const client = {
    from(table: string) {
      let filter: { col: string; vals: unknown[] } | null = null;
      const builder = {
        select() {
          return builder;
        },
        in(col: string, vals: unknown[]) {
          filter = { col, vals };
          return builder;
        },
        insert() {
          writes.push(`insert ${table}`);
          return builder;
        },
        update() {
          writes.push(`update ${table}`);
          return builder;
        },
        delete() {
          writes.push(`delete ${table}`);
          return builder;
        },
        then(resolve: (v: unknown) => unknown) {
          reads.push(table);
          const f = filter;
          const data = (tables[table] ?? []).filter((r) => !f || f.vals.includes(r[f.col]));
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (options.rpcError) return { data: null, error: options.rpcError };
      return {
        data: { applied: 1, skipped: [{ line: 2, code: 'PF_NOT_FOUND', message: '찾을 수 없어요. 목록을 새로고침해 주세요' }] },
        error: null,
      };
    },
    auth: { getClaims: async () => ({ data: claims ? { claims } : null, error: null }) },
  } as unknown as SupabaseClient;
  return { client, reads, writes, rpcCalls };
}

function call(handler: Handler, body: unknown, headers: 'ok' | 'none' = 'ok') {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (headers === 'ok') {
    h['x-pf'] = '1';
    h.origin = ORIGIN;
  }
  return handler(new Request(`${ORIGIN}/api/bulk/x`, { method: 'POST', headers: h, body: JSON.stringify(body) }));
}

const TABLES = (): Record<string, Row[]> => ({
  items: [
    { sku_id: 'PRD-001', stock_qty: 10 },
    { sku_id: 'PRD-002', stock_qty: 0 },
  ],
  purchases: [{ invoice_no: 'IN-USED' }],
  sales: [{ invoice_no: 'OUT-USED' }],
});
const text = (...lines: string[]) => lines.join('\n');
const tsv = (kind: string, sku: string, qty: number, inv = '') => [kind, sku, qty, '거래처', inv, '메모'].join('\t');
type PreviewRow = { line: number; valid: boolean; errors: string[] };

beforeEach(() => {
  holder.client = null;
});

describe('POST /api/bulk/preview', () => {
  it('C-71 재고 10에 입고 1행 · 출고 4행(합 10)이면 전부 valid', async () => {
    holder.client = fake(TABLES()).client;
    const body = text(
      tsv('입고', 'PRD-001', 5, 'IN-1'),
      tsv('출고', 'PRD-001', 4, 'OUT-1'),
      tsv('출고', 'PRD-001', 3),
      tsv('출고', 'PRD-001', 2),
      tsv('출고', 'PRD-001', 1),
    );
    const res = await call(preview, { format: 'tsv', text: body });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.rows).toHaveLength(5);
    expect(json.data.rows.every((r: PreviewRow) => r.valid && r.errors.length === 0)).toBe(true);
  });

  it('C-72 없는 품목코드는 그 행만 오류', async () => {
    holder.client = fake(TABLES()).client;
    const res = await call(preview, { format: 'tsv', text: text(tsv('입고', 'PRD-001', 1), tsv('입고', 'NOPE-001', 1)) });
    const rows = (await res.json()).data.rows;
    expect(rows[0]).toMatchObject({ line: 1, valid: true, errors: [] });
    expect(rows[1]).toMatchObject({ line: 2, valid: false, errors: ['미등록 품목코드'] });
  });

  it('C-73 이미 등록된 송장번호는 입고는 purchases, 출고는 sales 기준으로 오류', async () => {
    holder.client = fake(TABLES()).client;
    const body = text(
      tsv('입고', 'PRD-001', 1, 'IN-USED'),
      tsv('입고', 'PRD-001', 1, 'OUT-USED'),
      tsv('출고', 'PRD-001', 1, 'OUT-USED'),
      tsv('출고', 'PRD-001', 1, 'IN-USED'),
    );
    const rows = (await (await call(preview, { format: 'tsv', text: body })).json()).data.rows;
    expect(rows.map((r: PreviewRow) => r.valid)).toEqual([false, true, false, true]);
    expect(rows[0].errors).toEqual(['이미 등록된 송장번호']);
  });

  it('C-74 출고 수량이 재고 초과면 오류, 같은 품목 출고는 누적해서 센다', async () => {
    holder.client = fake(TABLES()).client;
    const single = (await (await call(preview, { format: 'tsv', text: tsv('출고', 'PRD-001', 11) })).json()).data.rows;
    expect(single[0]).toMatchObject({ valid: false, errors: ['출고 수량이 재고보다 많음(미리보기 시점 기준)'] });
    const stacked = (
      await (await call(preview, { format: 'tsv', text: text(tsv('출고', 'PRD-001', 6), tsv('출고', 'PRD-001', 6)) })).json()
    ).data.rows;
    expect(stacked.map((r: PreviewRow) => r.valid)).toEqual([true, false]);
  });

  it('C-75 파싱 오류 줄은 valid=false이고 줄 번호 순서를 지킨다', async () => {
    holder.client = fake(TABLES()).client;
    const body = text(tsv('입고', 'PRD-001', 1), '입고\tPRD-001', tsv('입고', 'PRD-001', 2));
    const rows = (await (await call(preview, { format: 'tsv', text: body })).json()).data.rows;
    expect(rows.map((r: PreviewRow) => r.line)).toEqual([1, 2, 3]);
    expect(rows[1]).toMatchObject({ valid: false, errors: ['열 개수 오류'], sku_id: '', qty: null });
  });

  it('C-76 미리보기는 성공 · 실패 모두 insert · update · rpc를 한 번도 부르지 않는다', async () => {
    const f = fake(TABLES());
    holder.client = f.client;
    await call(preview, { format: 'tsv', text: text(tsv('입고', 'PRD-001', 1), tsv('출고', 'NOPE-001', 1)) });
    await call(preview, { format: 'tsv', text: tsv('출고', 'PRD-001', 99) });
    expect(f.writes).toEqual([]);
    expect(f.rpcCalls).toEqual([]);
    expect(f.reads.length).toBeGreaterThan(0); // 조회는 했다(시험이 헛돌지 않는지)
  });

  it('C-77 501행 → 400(field text, max 500), 100KB 초과 → 400(field body). DB · rpc 0회', async () => {
    const f = fake(TABLES());
    holder.client = f.client;
    const many = Array.from({ length: 501 }, (_, i) => tsv('입고', 'PRD-001', 1, `B-${i}`)).join('\n');
    const r1 = await call(preview, { format: 'tsv', text: many });
    expect(r1.status).toBe(400);
    expect((await r1.json()).error.detail).toMatchObject({ field: 'text', max: 500 });
    const big = await call(preview, { format: 'tsv', text: 'x'.repeat(100 * 1024 + 1) });
    expect(big.status).toBe(400);
    expect((await big.json()).error.detail).toMatchObject({ field: 'body' });
    expect(f.reads).toEqual([]);
    expect(f.rpcCalls).toEqual([]);
  });

  it('C-86 마지막 줄이 빈 칸(탭)으로 끝나도 열 개수 오류 없이 valid', async () => {
    holder.client = fake(TABLES()).client;
    const two = text(tsv('입고', 'PRD-001', 1), '입고\tPRD-001\t1\t거래처\t\t');
    const r1 = (await (await call(preview, { format: 'tsv', text: two })).json()).data.rows;
    expect(r1.map((r: PreviewRow) => r.valid)).toEqual([true, true]);
    expect(r1.map((r: PreviewRow) => r.errors)).toEqual([[], []]);
    const one = text(tsv('입고', 'PRD-001', 1), '입고\tPRD-001\t1\t거래처\tINV-9\t');
    const r2 = (await (await call(preview, { format: 'tsv', text: one })).json()).data.rows;
    expect(r2.map((r: PreviewRow) => r.valid)).toEqual([true, true]);
    expect(r2.map((r: PreviewRow) => r.errors)).toEqual([[], []]);
  });

  it('C-80 X-PF 없음 → 403, 로그인 안 함 → 401 (DB 0회)', async () => {
    const f = fake(TABLES());
    holder.client = f.client;
    const noHeader = await call(preview, { format: 'tsv', text: tsv('입고', 'PRD-001', 1) }, 'none');
    expect(noHeader.status).toBe(403);
    expect((await noHeader.json()).error.code).toBe('PF_CSRF');
    const anon = fake(TABLES(), { claims: null });
    holder.client = anon.client;
    const res = await call(preview, { format: 'tsv', text: tsv('입고', 'PRD-001', 1) });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('PF_UNAUTHENTICATED');
    expect(f.reads.length + anon.reads.length).toBe(0);
  });
});

describe('POST /api/bulk/commit', () => {
  const row = (line: number, extra: Partial<BulkRowInput> = {}): BulkRowInput => ({
    line,
    kind: '입고',
    sku_id: 'PRD-001',
    qty: 1,
    partner: '가상 공급처',
    invoice_no: `BULK-${line}`,
    memo: null,
    ...extra,
  });

  it('C-78 pf_bulk_apply를 한 번, p_rows 그대로 부르고 {applied, skipped}를 돌려준다', async () => {
    const f = fake(TABLES());
    holder.client = f.client;
    const rows = [row(1), row(2, { kind: '출고', partner: '쿠팡', invoice_no: null })];
    const res = await call(commit, { rows });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({
      applied: 1,
      skipped: [{ line: 2, code: 'PF_NOT_FOUND', message: '찾을 수 없어요. 목록을 새로고침해 주세요' }],
    });
    expect(f.rpcCalls).toHaveLength(1);
    expect(f.rpcCalls[0].fn).toBe('pf_bulk_apply');
    expect(f.rpcCalls[0].args).toEqual({ p_rows: rows });
    expect(f.writes).toEqual([]); // 표를 직접 쓰지 않는다
  });

  it('C-79 501행 · 수량 0 · user_id 칸 → 400, rpc 0회', async () => {
    const f = fake(TABLES());
    holder.client = f.client;
    const r501 = await call(commit, { rows: Array.from({ length: 501 }, (_, i) => row(i + 1)) });
    expect(r501.status).toBe(400);
    expect((await r501.json()).error.detail).toMatchObject({ max: 500 });
    const zero = await call(commit, { rows: [row(1, { qty: 0 })] });
    expect(zero.status).toBe(400);
    const extra = await call(commit, { rows: [{ ...row(1), user_id: 'x' }] });
    expect(extra.status).toBe(400);
    expect((await extra.json()).error.detail.reason).toBe('not_allowed_field');
    expect(f.rpcCalls).toEqual([]);
  });

  it('C-80 X-PF 없음 → 403, 로그인 안 함 → 401 (rpc 0회)', async () => {
    const f = fake(TABLES());
    holder.client = f.client;
    expect((await call(commit, { rows: [row(1)] }, 'none')).status).toBe(403);
    const anon = fake(TABLES(), { claims: null });
    holder.client = anon.client;
    const res = await call(commit, { rows: [row(1)] });
    expect(res.status).toBe(401);
    expect(f.rpcCalls.length + anon.rpcCalls.length).toBe(0);
  });

  it('C-81 모르는 DB 오류는 500 PF_INTERNAL이고 응답에 원문이 없다', async () => {
    holder.client = fake(TABLES(), { rpcError: { message: 'relation "purchases" secret-detail failed' } }).client;
    const res = await call(commit, { rows: [row(1)] });
    expect(res.status).toBe(500);
    const body = JSON.stringify(await res.json());
    expect(body).toContain('PF_INTERNAL');
    expect(body).not.toContain('secret-detail');
    expect(body).not.toContain('purchases');
  });
});

describe('parse가 없을 때', () => {
  it('C-82 WU-13 병합 전이면 preview → 501 PF_NOT_IMPLEMENTED, DB 0회', async () => {
    vi.resetModules();
    vi.doMock('@/lib/bulk/parse', () => ({}));
    const { POST } = await import('./preview/route');
    const f = fake(TABLES());
    holder.client = f.client;
    const res = await call(POST, { format: 'tsv', text: tsv('입고', 'PRD-001', 1) });
    expect(res.status).toBe(501);
    expect((await res.json()).error.code).toBe('PF_NOT_IMPLEMENTED');
    expect(f.reads).toEqual([]);
    vi.doUnmock('@/lib/bulk/parse');
  });
});

describe('WU-13 parse 결과 모양(rejected · lines)', () => {
  const input = { format: 'tsv' as const, text: '(가짜 parse가 무시함)' };

  it('C-83 parse가 rejected를 돌려주면 PF_VALIDATION(field text, max 500), DB 0회', async () => {
    const { previewBulk } = await import('@/lib/queries/bulkPreview');
    const f = fake(TABLES());
    const rejected = { field: 'text', reason: 'too_long' as const, max: 500 };
    const parseRejected = () => ({ rows: [], errors: [], lines: [], rejected });
    await expect(previewBulk(f.client, input, parseRejected)).rejects.toMatchObject({
      code: 'PF_VALIDATION',
      detail: rejected,
    });
    expect(f.reads).toEqual([]);
  });

  it('C-84 lines가 있으면 오류 행도 원본 값을 지키고, 칸 문구를 errors에 싣는다', async () => {
    const { previewBulk } = await import('@/lib/queries/bulkPreview');
    const f = fake(TABLES());
    const base = { partner: '거래처', invoice_no: null, memo: null };
    const ok = { line: 1, kind: '입고' as const, sku_id: 'PRD-001', qty: 2, ...base };
    const parseWithLines = () => ({
      rows: [ok],
      errors: [
        { line: 2, reason: '수량이 0 이하' },
        { line: 3, reason: '200자 이하로 입력해 주세요' },
      ],
      lines: [
        { ...ok, valid: true, errors: [] },
        { line: 2, kind: '입고', sku_id: 'PRD-001', qty: 0, ...base, valid: false, errors: ['수량이 0 이하'] },
        { line: 3, kind: '출고', sku_id: 'PRD-001', qty: 1, ...base, memo: 'x'.repeat(201), valid: false, errors: [] },
      ],
      rejected: null,
    });
    const { rows } = await previewBulk(f.client, input, parseWithLines);
    expect(rows.map((r) => r.line)).toEqual([1, 2, 3]);
    expect(rows[0]).toMatchObject({ valid: true, errors: [] });
    expect(rows[1]).toMatchObject({ kind: '입고', sku_id: 'PRD-001', qty: 0, valid: false, errors: ['수량이 0 이하'] });
    expect(rows[2]).toMatchObject({ kind: '출고', valid: false, errors: ['200자 이하로 입력해 주세요'] });
    expect(f.reads).toContain('items'); // 정상 행은 DB와 비교했다
  });
});
