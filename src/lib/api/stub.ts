/**
 * 라우트 stub 공통 — 입력 검사까지만 하고 `PF_NOT_IMPLEMENTED`(501)를 던진다.
 *
 * 하는 일
 * 1. createHandler가 CSRF · 로그인 · 본문/쿼리 스키마 검사를 마친 뒤 이 run이 불린다.
 * 2. 경로 파라미터(`{id}` uuid · `{sku_id}`)는 형식을 검사해 틀리면 400 PF_VALIDATION(field = 파라미터 이름).
 * 3. 그다음 항상 PF_NOT_IMPLEMENTED(501)를 던진다. 라우트 주인이 본문을 채울 때 이 줄을 실제 처리로 바꾼다.
 *
 * 근거: docs/04-api-contract.md 앞머리(stub은 501) · 1절, WU-04 1번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 라우트 stub 공통 run (WU-04)
 */
import { parseWith } from '@/lib/validation/detail';
import { skuParam, uuidParam } from '@/lib/validation/schemas';
import { PfError } from './errors';

/**
 * stub 라우트의 run을 만든다.
 * @param param 경로 파라미터 이름 — 'id'(uuid) 또는 'sku_id'(품목코드). 없으면 검사하지 않는다
 * @throws PfError PF_VALIDATION(파라미터 형식 오류) · PF_NOT_IMPLEMENTED(항상)
 * 사용 예: `createHandler({ schema: itemCreate, run: stubRun() })`
 */
export function stubRun(param?: 'id' | 'sku_id') {
  return async (ctx: { params: Record<string, string> }): Promise<never> => {
    if (param) {
      const checked = parseWith(param === 'id' ? uuidParam : skuParam, ctx.params[param]);
      if (!checked.ok) throw new PfError('PF_VALIDATION', { ...checked.detail, field: param });
    }
    throw new PfError('PF_NOT_IMPLEMENTED');
  };
}
