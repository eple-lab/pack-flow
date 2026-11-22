/**
 * messages.ts 단위 테스트 — 04 4.3 문구 표 그대로인지.
 *
 * 하는 일: 7개 reason의 문구를 04 4.3 원문과 비교한다.
 *
 * 근거: docs/04-api-contract.md 4.3
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 칸 아래 문구 시험 (WU-03)
 */
import { describe, expect, it } from 'vitest';
import { VALIDATION_REASONS } from '@/types/erp';
import { fieldMessage } from './messages';

describe('M: fieldMessage (04 4.3)', () => {
  it('M-1 reason 7개가 모두 문구를 가진다', () => {
    for (const reason of VALIDATION_REASONS) expect(fieldMessage({ reason }).length).toBeGreaterThan(0);
  });
  it('M-2 문구가 04 4.3 원문과 같다', () => {
    expect(fieldMessage({ reason: 'required' })).toBe('필수 항목이에요');
    expect(fieldMessage({ reason: 'too_long', max: 100 })).toBe('100자 이하로 입력해 주세요');
    expect(fieldMessage({ reason: 'out_of_range', min: 1, max: 100000 })).toBe('1 ~ 100,000 사이로 입력해 주세요');
    expect(fieldMessage({ reason: 'not_integer' })).toBe('숫자(정수)로 입력해 주세요');
    expect(fieldMessage({ reason: 'bad_format' })).toBe('형식이 맞지 않아요 (예: PRD-001)');
    expect(fieldMessage({ reason: 'not_allowed_value' })).toBe('선택할 수 있는 값이 아니에요');
    expect(fieldMessage({ reason: 'not_allowed_field' })).toBe('보낼 수 없는 항목이에요 (화면 버그 — 배너로)');
  });
  it('M-3 min · max가 없으면 —로 채운다(원문 {max}가 보이지 않음)', () => {
    expect(fieldMessage({ reason: 'too_long' })).not.toMatch(/[{}]/);
  });
});
