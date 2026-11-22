/**
 * 검증 실패를 PF_VALIDATION의 detail `{field, reason, min?, max?}`로 바꾸는 함수와 본문 검사.
 *
 * 하는 일
 * 1. zod 오류의 첫 이슈를 04 4.3 reason으로 옮긴다(fields.ts가 message에 reason을 실어 둠).
 * 2. 계약에 없는 필드(strict 위반)는 not_allowed_field, 알 수 없는 type(합집합)은 not_allowed_value.
 * 3. JSON이 아니거나 100KB를 넘는 본문은 field "body"로 돌려준다(04 4.1).
 * 4. 문구(칸 아래 안내)는 여기서 만들지 않는다 — 04 4.3 표를 화면이 reason으로 찾아 쓴다.
 *
 * 근거: docs/04-api-contract.md 2 · 4.1 · 4.3, WU-03 8번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — toValidationDetail · parseJsonText (WU-03)
 */
import type { z } from 'zod';
import { VALIDATION_REASONS, type ValidationDetail, type ValidationReason } from '@/types/erp';

/** 요청 본문 최대 크기(04 4.1): 100KB. */
export const BODY_MAX_BYTES = 100 * 1024;

function isReason(value: unknown): value is ValidationReason {
  return typeof value === 'string' && (VALIDATION_REASONS as readonly string[]).includes(value);
}

function fieldName(path: ReadonlyArray<PropertyKey>): string {
  return path.length === 0 ? 'body' : path.map(String).join('.');
}

/**
 * zod 검증 오류를 04 4.3의 `{field, reason, min, max}`로 바꾼다. 첫 이슈만 쓴다(칸 하나씩 고치게).
 * @param error `schema.safeParse(...)`가 돌려준 error
 */
export function toValidationDetail(error: z.ZodError): ValidationDetail {
  const issue = error.issues[0];
  if (!issue) return { field: 'body', reason: 'bad_format' };

  if (issue.code === 'unrecognized_keys') {
    const key = issue.keys[0] ?? '';
    return { field: fieldName([...issue.path, key]), reason: 'not_allowed_field' };
  }
  if (issue.code === 'invalid_union') {
    return { field: fieldName(issue.path), reason: 'not_allowed_value' };
  }
  if (issue.code === 'custom' && isReason(issue.message)) {
    const params = (issue.params ?? {}) as { min?: unknown; max?: unknown };
    const detail: ValidationDetail = { field: fieldName(issue.path), reason: issue.message };
    if (typeof params.min === 'number') detail.min = params.min;
    if (typeof params.max === 'number') detail.max = params.max;
    return detail;
  }
  if (issue.code === 'invalid_type') {
    // 키가 아예 없을 때(zod: expected nonoptional / received undefined)는 비어 있는 것과 같다
    const missing = (issue as { expected?: string }).expected === 'nonoptional' || /received undefined/.test(issue.message);
    return { field: fieldName(issue.path), reason: missing ? 'required' : 'bad_format' };
  }
  return { field: fieldName(issue.path), reason: 'bad_format' };
}

/** `parse` 결과: 성공하면 정규화된 값, 실패하면 detail. */
export type ParseResult<T> = { ok: true; data: T } | { ok: false; detail: ValidationDetail };

/**
 * 스키마로 입력을 검사하고 정규화한다. 화면 폼과 API 라우트가 같은 함수를 쓴다(04 4절).
 */
export function parseWith<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  return result.success ? { ok: true, data: result.data } : { ok: false, detail: toValidationDetail(result.error) };
}

/**
 * 요청 본문 글자를 JSON으로 읽는다. 100KB 초과 → too_long(max=102400), JSON 아님 → bad_format. 둘 다 field "body".
 */
export function parseJsonText(raw: string): ParseResult<unknown> {
  if (new TextEncoder().encode(raw).length > BODY_MAX_BYTES) {
    return { ok: false, detail: { field: 'body', reason: 'too_long', max: BODY_MAX_BYTES } };
  }
  try {
    return { ok: true, data: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, detail: { field: 'body', reason: 'bad_format' } };
  }
}
