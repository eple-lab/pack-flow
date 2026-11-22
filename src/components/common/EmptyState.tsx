'use client';

/**
 * 빈 상태 표시 — 목록 · 검색 결과가 비었을 때 보이는 자리. 다음 행동 버튼 하나를 둘 수 있다.
 *
 * 하는 일
 * 1. 제목 글자를 보인다. 문구는 호출하는 화면이 정한다(예: "아직 품목이 없어요.").
 * 2. actionLabel과 onAction이 둘 다 있으면 버튼 하나를 보인다(04 4.5, 빈 상태에는 다음 행동 버튼 하나).
 * 3. 'use client' — 버튼의 onClick을 쓴다.
 *
 * 근거: docs/04-api-contract.md 4.5 · docs/10-screens.md 8절, docs/wireframes.html 8절 · WU-05
 * 구역: eple (docs/06-work-plan.md 1절 '공통 조각')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — EmptyState 빈 상태 (WU-05)
 */
import styles from './EmptyState.module.css';

/**
 * 빈 상태.
 *
 * props
 * - title: 보일 제목 글자.
 * - actionLabel · onAction: 둘 다 있을 때만 버튼을 보인다. 버튼은 하나다.
 * - testid: 바깥 요소 testid. 없으면 'empty-state'.
 *
 * testid: <testid 또는 empty-state>, empty-state-action(버튼)
 */
export function EmptyState({
  title,
  actionLabel,
  onAction,
  testid,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  testid?: string;
}) {
  const showAction = Boolean(actionLabel) && Boolean(onAction);

  return (
    <div data-testid={testid ?? 'empty-state'} className={styles.empty}>
      <p className={styles.title}>{title}</p>
      {showAction && (
        <button
          type="button"
          data-testid="empty-state-action"
          className={styles.action}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
