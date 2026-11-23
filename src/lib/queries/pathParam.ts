/**
 * 경로 파라미터 형식 검사 도우미 — `{id}`(uuid) · `{sku_id}`(품목코드).
 *
 * 하는 일
 * 1. stub.ts가 하던 검사와 같은 결과를 낸다: 틀리면 400 PF_VALIDATION, detail.field는 파라미터 이름.
 * 2. 스키마는 src/lib/validation/의 uuidParam · skuParam을 그대로 쓴다(새 규칙을 만들지 않는다).
 *
 * 근거: docs/04-api-contract.md 1 · 4.2, WU-41 4단계
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — stub의 경로 파라미터 검사를 실제 라우트로 옮김 (WU-41)
 */
import { PfError } from '@/lib/api/errors';
import { parseWith } from '@/lib/validation/detail';
import { skuParam, uuidParam } from '@/lib/validation/schemas';

/**
 * 경로 파라미터 하나를 검사해 정규화된(앞뒤 공백 제거) 값을 돌려준다.
 * @param params 라우트 컨텍스트의 params
 * @param name 'id'(uuid) 또는 'sku_id'(품목코드)
 * @throws PfError PF_VALIDATION `{ field: name, reason, … }`
 */
export function checkPathParam(params: Record<string, string>, name: 'id' | 'sku_id'): string {
  const checked = parseWith(name === 'id' ? uuidParam : skuParam, params[name]);
  if (!checked.ok) throw new PfError('PF_VALIDATION', { ...checked.detail, field: name });
  return checked.data;
}
