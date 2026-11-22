/**
 * 입력 검증의 칸 단위 부품 — 문자열 · 정수 · 선택값을 04 4.1 정규화와 4.3 reason으로 검사한다.
 *
 * 하는 일
 * 1. 문자열은 앞뒤 공백을 지우고, 빈 값이면 선택 칸은 null · 필수 칸은 required로 만든다(04 4.1).
 * 2. 숫자는 JSON 숫자(정수)만 받는다. 문자열 "10" · 소수는 not_integer. 쿼리 문자열용 digitString 옵션만 예외.
 * 3. 실패는 zod 이슈의 message에 reason 문자열을, params에 {min, max}를 실어 보낸다
 *    (detail.ts의 toValidationDetail이 04 4.3 모양으로 바꾼다).
 * 4. 품목코드는 서버에서 대문자로 바꿔 주지 않는다(대문자 형식만 받음 — 04 4.1). 화면용 변환은 toUpperSku.
 *
 * 근거: docs/04-api-contract.md 4.1 · 4.2 · 4.3, WU-03 8번 · T-VAL-7
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 칸 단위 검증 부품 (WU-03)
 */
import { z } from 'zod';
import type { ValidationReason } from '@/types/erp';

type Params = { min?: number; max?: number };

/** zod 이슈 하나를 04 4.3 reason으로 남긴다. */
function fail(
  ctx: z.core.$RefinementCtx,
  input: unknown,
  reason: ValidationReason,
  params?: Params,
): typeof z.NEVER {
  ctx.issues.push({ code: 'custom', input, message: reason, ...(params ? { params } : {}) });
  return z.NEVER;
}

type Presence = 'required' | 'optional' | 'partial';

/** presence에 맞게 "키가 없을 때"의 동작을 정한다. */
function withPresence<T extends z.ZodType>(
  build: (acceptMissing: boolean) => T,
  presence: Presence,
): z.ZodType {
  if (presence === 'optional') return build(true); // 키가 없으면 null
  if (presence === 'partial') return z.optional(build(false)); // 키가 없으면 그대로 없음(PATCH)
  return build(false); // 키가 없으면 required
}

export type TextOptions = {
  /** 최소 글자 수(기본 1). 앞뒤 공백을 지운 뒤 센다 */
  min?: number;
  max: number;
  /** 필수(기본) · 선택(빈 값 → null, 키가 없어도 null) · partial(PATCH: 키가 없으면 없는 채로, 빈 값 → null) */
  presence?: Presence;
  /** 형식 검사. 어긋나면 bad_format */
  pattern?: RegExp;
};

/**
 * 글자 칸. 앞뒤 공백 제거 → 빈 값 처리 → 길이 → 형식 순으로 본다.
 * @returns 필수는 문자열, 선택은 문자열 또는 null
 */
export function text(options: TextOptions): z.ZodType {
  const { max, min = 1, presence = 'required', pattern } = options;
  return withPresence(
    (acceptMissing) =>
      (acceptMissing ? z.unknown().optional() : z.unknown()).transform((value, ctx) => {
        const optional = presence !== 'required';
        if (value === undefined || value === null) {
          return optional ? null : fail(ctx, value, 'required');
        }
        if (typeof value !== 'string') return fail(ctx, value, 'bad_format');
        const trimmed = value.trim();
        if (trimmed === '') return optional ? null : fail(ctx, value, 'required');
        if (trimmed.length > max) return fail(ctx, value, 'too_long', { max });
        if (trimmed.length < min) return fail(ctx, value, 'bad_format');
        if (pattern && !pattern.test(trimmed)) return fail(ctx, value, 'bad_format');
        return trimmed;
      }),
    presence,
  );
}

export type IntOptions = {
  min: number;
  max: number;
  /** 필수(기본) · partial(PATCH) · optional(없으면 defaultValue) */
  presence?: Presence;
  /** optional일 때 키가 없거나 빈 값이면 쓸 값 (예: limit 기본 20) */
  defaultValue?: number;
  /** URL 쿼리처럼 문자열로만 올 수 있는 값("20")을 숫자로 받는다. 본문에는 쓰지 않는다 */
  digitString?: boolean;
};

/**
 * 정수 칸. JSON 숫자 정수만 받는다(소수 · 지수 · 문자열은 not_integer).
 * 범위 밖은 out_of_range + {min, max}.
 */
export function int(options: IntOptions): z.ZodType {
  const { min, max, presence = 'required', defaultValue, digitString = false } = options;
  return withPresence(
    (acceptMissing) =>
      (acceptMissing ? z.unknown().optional() : z.unknown()).transform((value, ctx) => {
        const optional = presence !== 'required';
        if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
          if (!optional) return fail(ctx, value, 'required');
          return defaultValue ?? null;
        }
        let n: number;
        if (typeof value === 'number') {
          n = value;
        } else if (digitString && typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
          n = Number(value.trim());
        } else {
          return fail(ctx, value, 'not_integer');
        }
        if (!Number.isSafeInteger(n)) return fail(ctx, value, 'not_integer');
        if (n < min || n > max) return fail(ctx, value, 'out_of_range', { min, max });
        return n;
      }),
    presence,
  );
}

/**
 * 정해진 값 중 하나(`to` · `kind` · `dataset` 등). 비면 required, 목록 밖이면 not_allowed_value.
 */
export function oneOf<const T extends readonly string[]>(
  values: T,
  presence: Presence = 'required',
): z.ZodType<T[number]> {
  return withPresence(
    (acceptMissing) =>
      (acceptMissing ? z.unknown().optional() : z.unknown()).transform((value, ctx) => {
        const optional = presence !== 'required';
        if (value === undefined || value === null) return optional ? null : fail(ctx, value, 'required');
        if (typeof value !== 'string') return fail(ctx, value, 'not_allowed_value');
        const trimmed = value.trim();
        if (trimmed === '') return optional ? null : fail(ctx, value, 'required');
        if (!(values as readonly string[]).includes(trimmed)) return fail(ctx, value, 'not_allowed_value');
        return trimmed;
      }),
    presence,
  ) as z.ZodType<T[number]>;
}

/**
 * 배열 칸. 원소 스키마는 호출하는 쪽이 준다. 비었거나 없으면 required, max 초과는 too_long.
 */
export function list<T extends z.ZodType>(
  element: T,
  options: { min?: number; max: number; presence?: Presence },
): z.ZodType {
  const { min = 1, max, presence = 'required' } = options;
  return withPresence(
    (acceptMissing) =>
      (acceptMissing ? z.unknown().optional() : z.unknown()).transform((value, ctx) => {
        const optional = presence !== 'required';
        if (value === undefined || value === null) return optional ? null : fail(ctx, value, 'required');
        if (!Array.isArray(value)) return fail(ctx, value, 'bad_format');
        if (value.length < min) return optional && value.length === 0 ? null : fail(ctx, value, 'required');
        if (value.length > max) return fail(ctx, value, 'too_long', { max });
        // 원소 검사는 원소 스키마에 맡기고, 이슈 경로에 위치(0, 1, …)를 붙여 돌려준다
        const out: unknown[] = [];
        value.forEach((item, index) => {
          const result = element.safeParse(item);
          if (result.success) {
            out.push(result.data);
          } else {
            for (const issue of result.error.issues) {
              ctx.issues.push({ ...issue, input: item, path: [index, ...issue.path] } as z.core.$ZodRawIssue);
            }
          }
        });
        return out;
      }),
    presence,
  );
}

/**
 * 비밀번호 칸 — 앞뒤 공백을 지우지 않는다(공백도 비밀번호의 일부). 1자 이상, 판정은 Supabase(04 4.2).
 */
export function password(max = 200): z.ZodType {
  return z.unknown().transform((value, ctx) => {
    if (value === undefined || value === null || value === '') return fail(ctx, value, 'required');
    if (typeof value !== 'string') return fail(ctx, value, 'bad_format');
    if (value.length > max) return fail(ctx, value, 'too_long', { max });
    return value;
  });
}

/** 품목코드 형식: 영문 대문자 · 숫자 · 하이픈 3~20자, 영문 또는 숫자로 시작(04 4.2). */
export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;
export const SKU_MIN = 3;
export const SKU_MAX = 20;

/** 품목코드 칸. 20자 초과는 too_long, 3자 미만 · 소문자 · 허용 밖 글자는 bad_format. */
export function skuId(presence: Presence = 'required'): z.ZodType {
  return text({ min: SKU_MIN, max: SKU_MAX, pattern: SKU_PATTERN, presence });
}

/** 송장번호 칸(선택): 1~50자, 영문 · 숫자 · `-` · `_`. 빈 값은 null — null끼리는 중복이 아니다(04 4.2). */
export function invoiceNo(presence: Presence = 'optional'): z.ZodType {
  return text({ max: 50, pattern: /^[A-Za-z0-9_-]+$/, presence });
}

/**
 * 화면용: 입력한 품목코드를 앞뒤 공백 제거 + 대문자로 바꾼다(04 4.1 — 서버는 이 변환을 하지 않는다).
 */
export function toUpperSku(input: string): string {
  return input.trim().toUpperCase();
}

/**
 * 화면용: 숫자 입력의 쉼표 · 공백을 지우고 숫자로 바꾼다(04 4.1). 숫자가 아니면 원문을 그대로 돌려줘
 * 스키마가 not_integer로 막게 한다.
 */
export function toNumberInput(input: string): number | string {
  const cleaned = input.replace(/[,\s]/g, '');
  if (cleaned === '') return '';
  return /^-?\d+$/.test(cleaned) ? Number(cleaned) : input;
}
