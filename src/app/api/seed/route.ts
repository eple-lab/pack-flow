/**
 * 시연 데이터 적재 API 라우트.
 *
 * 하는 일
 * 1. 본문(dataset)은 seedRequest 스키마로 검사한다(잘못되면 400 PF_VALIDATION).
 * 2. 시드 로더(src/lib/seed)로 JSON을 읽어 형식을 검사한 뒤 pf_reset_and_seed로 넣는다.
 *    DB 함수가 로그인한 사용자 본인의 데이터만 지우고 다시 넣는다(04 3.7, T-AUTH-7). 사용자 id는 요청에서 받지 않는다.
 * 3. 시드 파일이 아직 없거나 형식이 깨졌으면(SeedError) 400 PF_VALIDATION field "dataset"로 돌려준다.
 *    원문(파일 경로 등)은 응답에 싣지 않는다.
 *
 * 근거: docs/04-api-contract.md 3.7 · WU-04 · WU-43
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/seed stub (WU-04)
 * 2026-11-23  eple  stub → 시드 로더 + pf_reset_and_seed 실제 연결 (WU-43)
 */
import { PfError } from '@/lib/api/errors';
import { createHandler } from '@/lib/api/handler';
import { resetAndSeed } from '@/lib/inventory';
import { loadSeed, SeedError } from '@/lib/seed';
import { seedRequest } from '@/lib/validation/schemas';

// POST /api/seed — 시연 데이터 적재(본인 데이터만 초기화). 오류: PF_VALIDATION(400) · PF_UNAUTHENTICATED(401) · PF_CSRF(403)
export const POST = createHandler({
  schema: seedRequest,
  run: async ({ supabase, body }) => {
    let data;
    try {
      data = await loadSeed(body.dataset);
    } catch (error) {
      // 아직 없는 시드(small · large) · 형식 오류 — 고를 수 없는 값으로 알린다
      if (error instanceof SeedError) throw new PfError('PF_VALIDATION', { field: 'dataset', reason: 'not_allowed_value' });
      throw error;
    }
    const result = await resetAndSeed(supabase, { data: data as unknown as Record<string, unknown> });
    return { data: result };
  },
});
