'use client';

/**
 * 오류 배너 — 화면 · 패널 공통 오류 표시 조각.
 *
 * 하는 일
 * 1. error가 없으면 아무것도 그리지 않는다(null).
 * 2. error.message를 글자 그대로 보인다. 문구는 서버(04 4.4)가 이미 만들어 보내므로 여기서 새로 짓지 않는다.
 *    PF_INSUFFICIENT_STOCK 문구에는 남은 수량이 들어 있다.
 * 3. PF_NETWORK · PF_TIMEOUT이고 onRetry가 있으면 [다시 시도] 버튼을 보인다.
 *
 * 근거: docs/04-api-contract.md 4.4 · 4.6, docs/10-screens.md 8절, docs/wireframes.html 8절 · WU-05
 * 구역: eple (docs/06-work-plan.md 1절 '공통 조각')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — ErrorBanner 공통 오류 배너 (WU-05)
 */
import type { PfErrorCode } from '@/types/erp';
import styles from './ErrorBanner.module.css';

/** 재시도 버튼을 보여 줄 화면 전용 코드(04 4.4). */
const RETRYABLE_CODES: readonly PfErrorCode[] = ['PF_NETWORK', 'PF_TIMEOUT'];

/**
 * 오류 배너.
 *
 * props
 * - error: `{ code, message }`. 없으면(null · undefined) 아무것도 그리지 않는다.
 * - onRetry: 있으면서 code가 PF_NETWORK · PF_TIMEOUT일 때만 [다시 시도] 버튼을 보인다. 누르면 호출한다.
 *
 * testid: error-banner, error-banner-retry
 */
export function ErrorBanner({
  error,
  onRetry,
}: {
  error: { code: PfErrorCode; message: string } | null | undefined;
  onRetry?: () => void;
}) {
  if (!error) return null;

  const showRetry = Boolean(onRetry) && RETRYABLE_CODES.includes(error.code);

  return (
    <div role="alert" data-testid="error-banner" className={styles.banner}>
      <p className={styles.message}>{error.message}</p>
      {showRetry && (
        <button
          type="button"
          data-testid="error-banner-retry"
          className={styles.retry}
          onClick={onRetry}
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
