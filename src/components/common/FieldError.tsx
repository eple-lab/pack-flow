/**
 * 칸 아래 오류 문구 — 폼 칸 바로 아래에 빨간 글씨로 보인다.
 *
 * 하는 일
 * 1. 보일 글자 = message가 있으면 그것, 없으면 detail을 fieldMessage로 바꾼 문구(04 4.3).
 * 2. 둘 다 없으면 아무것도 그리지 않는다(null).
 * 3. 서버 컴포넌트로 둔다(버튼 · 상태 없음 — 'use client' 불필요).
 *
 * 근거: docs/04-api-contract.md 4.3 · 4.6, docs/10-screens.md 8절, docs/wireframes.html 8절 · WU-05
 * 구역: eple (docs/06-work-plan.md 1절 '공통 조각')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — FieldError 칸 아래 오류 (WU-05)
 */
import type { ValidationDetail } from '@/types/erp';
import { fieldMessage } from '@/lib/validation/messages';
import styles from './FieldError.module.css';

/**
 * 칸 아래 오류.
 *
 * props
 * - field: 폼 칸 이름. testid `field-error-<field>`에 쓴다.
 * - detail: 검증 detail(reason · min · max). message가 없을 때 fieldMessage로 문구를 만든다.
 * - message: 이미 정해진 문구. 있으면 detail보다 우선한다.
 *
 * testid: field-error-<field>
 */
export function FieldError({
  field,
  detail,
  message,
}: {
  field: string;
  detail?: Pick<ValidationDetail, 'reason' | 'min' | 'max'> | null;
  message?: string | null;
}) {
  const text = message ?? (detail ? fieldMessage(detail) : null);
  if (!text) return null;

  return (
    <p data-testid={`field-error-${field}`} role="alert" className={styles.error}>
      {text}
    </p>
  );
}
