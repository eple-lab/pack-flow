'use client';

/**
 * 품절 임박 카드 — 안전재고보다 재고가 적은 품목과 [발주서 초안 보기] · [AI 에이전트에게 맡기기] 버튼.
 *
 * 하는 일
 * 1. API의 alerts를 품목마다 "품목명 — 재고 N / 안전재고 M" 카드로 보인다. 숫자는 그대로(T-S1-3).
 * 2. 버튼은 openAgentPanel(...)만 부른다. 패널은 skygaul 구역이라 여기서 만들지 않는다.
 * 3. 품절 임박이 없으면 EmptyState(04 4.5).
 *
 * 근거: docs/04-api-contract.md 3.5 · 3.8 · 4.5, docs/pack-flow-plan.md 3절 Step 1 완료 판정 1번 · WU-11 3번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-11
 * 2026-11-23  jkspawn  품절 임박 카드 · 발주서 초안 · 맡기기 버튼 구현 (WU-11)
 */
import { openAgentPanel } from '@/components/agent/open';
import { EmptyState } from '@/components/common/EmptyState';
import { formatNumber } from '@/lib/format';
import type { Dashboard } from '@/types/erp';
import styles from './dashboard.module.css';

/**
 * 발주서 초안 패널을 연다. sku_id가 있으면 그 품목만, 없으면 품절 임박 전체(04 3.8).
 * 부작용: openAgentPanel 호출(AgentSlot이 패널을 연다).
 */
export function openDraftPo(sku_id?: string): void {
  openAgentPanel(sku_id ? { mode: 'draft-po', sku_ids: [sku_id] } : { mode: 'draft-po' });
}

/**
 * 품절 임박 카드 묶음. [발주서 초안 보기]를 누르면 에이전트 패널을 연다.
 * 숫자는 API 값 그대로 쓴다(화면에서 계산하지 않음 — T-S1-3).
 *
 * props
 * - alerts: `Dashboard['alerts']`
 *
 * testid: btn-agent-all, alert-card-<sku_id>, btn-draft-po-<sku_id>, alerts-empty(없을 때)
 */
export function AlertCards({ alerts }: { alerts: Dashboard['alerts'] }) {
  return (
    <section className={styles.section} aria-labelledby="alerts-title">
      <div className={styles.sectionHead}>
        <h2 id="alerts-title" className={styles.sectionTitle}>
          품절 임박
        </h2>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonPrimary}`}
          data-testid="btn-agent-all"
          onClick={() => openDraftPo()}
        >
          AI 에이전트에게 맡기기
        </button>
      </div>
      {alerts.length === 0 ? (
        <EmptyState title="품절 임박 품목이 없어요" testid="alerts-empty" />
      ) : (
        <div className={styles.alertGrid}>
          {alerts.map((alert) => (
            <div
              key={alert.sku_id}
              className={`${styles.card} ${styles.alertCard}`}
              data-testid={`alert-card-${alert.sku_id}`}
            >
              <p className={styles.alertText}>
                <strong>{alert.item_name}</strong> — 재고 {formatNumber(alert.stock_qty)} / 안전재고{' '}
                {formatNumber(alert.safety_stock)}
              </p>
              <button
                type="button"
                className={styles.button}
                data-testid={`btn-draft-po-${alert.sku_id}`}
                onClick={() => openDraftPo(alert.sku_id)}
              >
                발주서 초안 보기
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
