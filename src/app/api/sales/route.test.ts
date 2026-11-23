/**
 * GET /api/sales?status= 라우트 시험 — status 필터 · 최근순 · 잘못된 status · 로그인.
 *
 * 기대(먼저 적음)
 * - C-10 status 없음 → 전부, created_at 최근순
 * - C-11 status=출고완료 → eq('fulfillment_status', '출고완료')가 DB에 전달되고 그 상태만 온다
 * - C-12 잘못된 status → 400 PF_VALIDATION(field status), DB를 부르지 않음
 * - C-13 로그인 안 함 → 401 PF_UNAUTHENTICATED, DB를 부르지 않음
 * - C-14 Supabase 오류 → 500 PF_INTERNAL, 원문 미노출
 *
 * 근거: docs/04-api-contract.md 3.4, WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — sales 목록 시험 (WU-41)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fakeDb } from '@/lib/queries/fakeDb.testutil';

vi.mock('server-only', () => ({}));
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => holder.client as SupabaseClient }));

import { GET } from './route';

const row = (id: string, fulfillment_status: string, created_at: string) => ({ id, fulfillment_status, created_at });
const rows = [
  row('a', '출고완료', '2026-11-20T01:00:00.000Z'),
  row('b', '주문접수', '2026-11-22T01:00:00.000Z'),
  row('c', '출고완료', '2026-11-21T01:00:00.000Z'),
];
const call = (qs = '') => GET(new Request('https://app.packflow.test/api/sales' + qs));

describe('GET /api/sales', () => {
  beforeEach(() => { holder.client = null; });

  it('C-10 status 없으면 전부 최근순', async () => {
    holder.client = fakeDb({ sales: rows }).client;
    const { data } = await (await call()).json();
    expect(data.map((r: { id: string }) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('C-11 status가 eq로 전달되고 그 상태만 최근순으로 온다', async () => {
    const db = fakeDb({ sales: rows });
    holder.client = db.client;
    const { data } = await (await call('?status=' + encodeURIComponent('출고완료'))).json();
    expect(data.map((r: { id: string }) => r.id)).toEqual(['c', 'a']);
    expect(db.calls[0].ops).toContainEqual({ op: 'eq', args: ['fulfillment_status', '출고완료'] });
  });

  it('C-12 잘못된 status → 400 PF_VALIDATION, DB 안 부름', async () => {
    const db = fakeDb({ sales: rows });
    holder.client = db.client;
    const res = await call('?status=없는상태');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('PF_VALIDATION');
    expect(body.error.detail.field).toBe('status');
    expect(db.calls).toHaveLength(0);
  });

  it('C-13 로그인 안 함 → 401, DB 안 부름', async () => {
    const db = fakeDb({ sales: rows }, { claims: null });
    holder.client = db.client;
    const res = await call();
    expect(res.status).toBe(401);
    expect(db.calls).toHaveLength(0);
  });

  it('C-14 Supabase 오류 → 500 PF_INTERNAL, 원문 미노출', async () => {
    holder.client = fakeDb({}, { failTables: ['sales'] }).client;
    const res = await call();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text).error.code).toBe('PF_INTERNAL');
    expect(text).not.toContain('secret-detail');
  });
});
