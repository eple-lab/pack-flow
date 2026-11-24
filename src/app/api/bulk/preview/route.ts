/**
 * 일괄 등록 미리보기 API 라우트.
 *
 * 하는 일
 * 1. 본문(format · text)은 bulkPreview 스키마로 검사한다(잘못되면 400 PF_VALIDATION). 100KB 초과는 handler가 먼저 400으로 막는다.
 * 2. 파싱 함수(src/lib/bulk/parse.ts의 parse, jkspawn WU-13)로 줄 · 열을 나누고, previewBulk가 DB와 비교해
 *    행마다 valid · errors를 정한다. 행 수 500 초과는 400. DB에 쓰지 않는다(조회만).
 * 3. parse가 아직 구현되지 않았으면(WU-13 병합 전) 501 PF_NOT_IMPLEMENTED.
 *
 * 근거: docs/04-api-contract.md 3.6 · WU-04 · WU-43
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — /api/bulk/preview stub (WU-04)
 * 2026-11-23  eple  stub → 파싱 + DB 비교 미리보기 (WU-43)
 */
import * as parser from '@/lib/bulk/parse';
import { PfError } from '@/lib/api/errors';
import { createHandler } from '@/lib/api/handler';
import { previewBulk, type BulkParseFn } from '@/lib/queries/bulkPreview';
import { bulkPreview } from '@/lib/validation/schemas';

// WU-13(jkspawn)이 named export `parse`를 채우기 전에도 빌드되도록 네임스페이스로 받는다
const parse = 'parse' in parser ? (parser as unknown as { parse: BulkParseFn }).parse : undefined;

// POST /api/bulk/preview — 일괄 등록 미리보기. 오류: PF_VALIDATION(400) · PF_NOT_IMPLEMENTED(501)
export const POST = createHandler({
  schema: bulkPreview,
  run: async ({ supabase, body }) => {
    if (typeof parse !== 'function') throw new PfError('PF_NOT_IMPLEMENTED');
    return { data: await previewBulk(supabase, body, parse) };
  },
});
