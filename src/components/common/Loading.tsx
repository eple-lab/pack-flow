/**
 * 로딩 표시 — 목록 · 화면을 불러오는 동안 보이는 자리.
 *
 * 하는 일
 * 1. role="status"로 보조 기술에 "불러오는 중"을 알린다.
 * 2. 글자는 label로 바꿀 수 있고, 기본은 '불러오는 중…'.
 * 3. 서버 컴포넌트로 둔다(상태 · 이벤트 없음 — 'use client' 불필요).
 *
 * 근거: docs/10-screens.md 8절, docs/wireframes.html 2 · 8절(세 가지 상태) · WU-05
 * 구역: eple (docs/06-work-plan.md 1절 '공통 조각')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — Loading 로딩 표시 (WU-05)
 */
import styles from './Loading.module.css';

/**
 * 로딩 표시.
 *
 * props
 * - label: 보일 글자. 기본 '불러오는 중…'.
 *
 * testid: loading
 */
export function Loading({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div role="status" data-testid="loading" className={styles.loading}>
      {label}
    </div>
  );
}
