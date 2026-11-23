/**
 * GET /api/dashboard 라우트 시험 — 로그인 · 응답 모양 · 오류 변환.
 *
 * 기대(먼저 적음)
 * - C-22 로그인 안 함 → 401 PF_UNAUTHENTICATED, DB 안 부름
 * - C-23 로그인 + 빈 DB → 200, data에 kpi · pipeline · items · alerts · recent_changes가 모두 있다
 * - C-24 DB 오류 → 500 PF_INTERNAL, 원문 미노출
 *
 * 근거: docs/04-api-contract.md 3.5, WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 대시보드 라우트 시험 (WU-41)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fakeDb } from '@/lib/queries/fakeDb.testutil';

vi.mock('server-only', () => ({}));
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => holder.client as SupabaseClient }));

import { GET } from './route';

const call = () => GET(new Request('https://app.packflow.test/api/dashboard'));

describe('GET /api/dashboard', () => {
  beforeEach(() => { holder.client = null; });

  it('C-22 로그인 안 함 → 401, DB 안 부름', async () => {
    const db = fakeDb({}, { claims: null });
    holder.client = db.client;
    const res = await call();
    expect(res.status).toBe(401);
    expect(db.calls).toHaveLength(0);
  });

  it('C-23 빈 DB여도 200과 전체 모양', async () => {
    holder.client = fakeDb({}).client;
    const res = await call();
    expect(res.status).toBe(200);
    expect(Object.keys((await res.json()).data).sort()).toEqual(['alerts', 'items', 'kpi', 'pipeline', 'recent_changes']);
  });

  it('C-24 DB 오류 → 500 PF_INTERNAL, 원문 미노출', async () => {
    holder.client = fakeDb({}, { failTables: ['stock_logs'] }).client;
    const res = await call();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text).error.code).toBe('PF_INTERNAL');
    expect(text).not.toContain('secret-detail');
  });
});
