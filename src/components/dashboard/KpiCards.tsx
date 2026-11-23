/**
 * 대시보드 KPI 카드 — 전체 품목 · 재고 합계 · 안전재고 미만 · 오늘 입고 · 출고.
 *
 * 하는 일
 * 1. API가 준 kpi 값을 format.ts로 쉼표만 붙여 보인다. 화면에서 다시 계산하지 않는다(T-S1-3).
 * 2. 안전재고 미만이 0보다 크면 경고 배지를 단다.
 * 3. 서버 컴포넌트로 둔다(상태 · 이벤트 없음).
 *
 * 근거: docs/04-api-contract.md 3.5 · 4.6, docs/pack-flow-plan.md 5절 · WU-11 2번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-11
 * 2026-11-23  jkspawn  KPI 카드 4개 구현 · 안전재고 미만 경고 배지 (WU-11)
 */
import type { Dashboard } from '@/types/erp';
import { formatNumber } from '@/lib/format';
import styles from './dashboard.module.css';

/**
 * KPI 카드 4개. 숫자는 API 값 그대로 쓴다(화면에서 계산하지 않음 — T-S1-3).
 *
 * props
 * - kpi: `Dashboard['kpi']`
 *
 * testid: kpi-item-count, kpi-stock-total, kpi-below-safety, kpi-below-safety-badge(0보다 클 때), kpi-today-in, kpi-today-out
 */
export function KpiCards({ kpi }: { kpi: Dashboard['kpi'] }) {
  return (
    <div className={styles.kpiGrid}>
      <div className={styles.card}>
        <span className={styles.cardLabel}>전체 품목 수</span>
        <span className={styles.cardValue} data-testid="kpi-item-count">
          {formatNumber(kpi.item_count)}
        </span>
      </div>
      <div className={styles.card}>
        <span className={styles.cardLabel}>재고 합계</span>
        <span className={styles.cardValue} data-testid="kpi-stock-total">
          {formatNumber(kpi.stock_total)}
        </span>
      </div>
      <div className={styles.card}>
        <span className={styles.cardLabel}>
          안전재고 미만{' '}
          {kpi.below_safety > 0 && (
            <span className={`${styles.badge} ${styles.badgeWarning}`} data-testid="kpi-below-safety-badge">
              경고
            </span>
          )}
        </span>
        <span className={styles.cardValue} data-testid="kpi-below-safety">
          {formatNumber(kpi.below_safety)}
        </span>
      </div>
      <div className={styles.card}>
        <span className={styles.cardLabel}>오늘 입고 · 출고</span>
        <div className={styles.cardRow}>
          <span>
            <span className={styles.subLabel}>입고</span>
            <span className={styles.cardValue} data-testid="kpi-today-in">
              {formatNumber(kpi.today_in)}
            </span>
          </span>
          <span>
            <span className={styles.subLabel}>출고</span>
            <span className={styles.cardValue} data-testid="kpi-today-out">
              {formatNumber(kpi.today_out)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
