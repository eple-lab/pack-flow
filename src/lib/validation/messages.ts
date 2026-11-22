/**
 * PF_VALIDATION reason → 칸 아래 문구(04 4.3 표 그대로).
 *
 * 하는 일
 * 1. detail `{field, reason, min, max}`를 화면 문구로 바꾼다. {min} · {max}는 detail 값으로 채운다.
 * 2. 새 문구를 짓지 않는다 — 문구 원본은 docs/04-api-contract.md 4.3.
 *
 * 근거: docs/04-api-contract.md 4.3, WU-03 8번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 칸 아래 문구 표 (WU-03)
 */
import type { ValidationDetail, ValidationReason } from '@/types/erp';

const FIELD_MESSAGES: Record<ValidationReason, string> = {
  required: '필수 항목이에요',
  too_long: '{max}자 이하로 입력해 주세요',
  out_of_range: '{min} ~ {max} 사이로 입력해 주세요',
  not_integer: '숫자(정수)로 입력해 주세요',
  bad_format: '형식이 맞지 않아요 (예: PRD-001)',
  not_allowed_value: '선택할 수 있는 값이 아니에요',
  not_allowed_field: '보낼 수 없는 항목이에요 (화면 버그 — 배너로)',
};

/**
 * 검증 실패 detail을 칸 아래에 보일 문구로 바꾼다.
 * @param detail toValidationDetail이 만든 값(또는 서버 PF_VALIDATION의 detail)
 */
export function fieldMessage(detail: Pick<ValidationDetail, 'reason' | 'min' | 'max'>): string {
  return FIELD_MESSAGES[detail.reason].replace(/\{(min|max)\}/g, (_, key: 'min' | 'max') => {
    const value = detail[key];
    return typeof value === 'number' ? value.toLocaleString('en-US') : '—';
  });
}
