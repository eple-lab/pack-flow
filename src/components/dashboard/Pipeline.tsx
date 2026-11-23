/**
 * 구매 · 판매 단계별 건수 — 가로 스텝, 누르면 입출고 화면을 그 상태로 거른다.
 *
 * 하는 일
 * 1. 구매 `발주완료 · 이동·통관중 · 입고완료`, 판매 `출고대기 · 출고완료` 건수를 API 값 그대로 보인다(T-S1-3).
 * 2. 각 칸은 `/trades?status=<상태>` 링크다. 상태 이름은 erp.ts의 타입으로 묶어 오타를 막는다.
 * 3. 서버 컴포넌트로 둔다(next/link만 쓴다).
 *
 * 근거: docs/04-api-contract.md 3.5, docs/pack-flow-plan.md 5절 · WU-11 4번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-11
 * 2026-11-23  jkspawn  구매 · 판매 파이프라인 스텝 · 입출고 필터 링크 구현 (WU-11)
 */
import Link from 'next/link';
import { formatNumber } from '@/lib/format';
import type { Dashboard, PurchaseStatus, SaleStatus } from '@/types/erp';
import styles from './dashboard.module.css';

/** 대시보드에 보일 구매 단계(WU-11 4번). 타입이 PURCHASE_STATUSES 상수에 묶여 있어 없는 이름은 빌드가 막는다. */
export const PIPE_PURCHASE_STEPS: readonly PurchaseStatus[] = ['발주완료', '이동·통관중', '입고완료'];

/** 대시보드에 보일 판매 단계(WU-11 4번). */
export const PIPE_SALE_STEPS: readonly SaleStatus[] = ['출고대기', '출고완료'];

/** 파이프라인 칸이 가는 주소. 한글 상태는 주소용으로 인코딩한다. */
export function tradesHref(status: PurchaseStatus | SaleStatus): string {
  return `/trades?status=${encodeURIComponent(status)}`;
}

/**
 * 구매 · 판매 파이프라인. 건수는 API 값 그대로 쓴다(T-S1-3).
 *
 * props
 * - pipeline: `Dashboard['pipeline']`
 *
 * testid: pipe-purchase-<상태>, pipe-sale-<상태> (상태는 한글 그대로)
 */
export function Pipeline({ pipeline }: { pipeline: Dashboard['pipeline'] }) {
  return (
    <section className={styles.section} aria-labelledby="pipeline-title">
      <h2 id="pipeline-title" className={styles.sectionTitle}>
        진행 단계
      </h2>
      <div className={styles.pipeGroup}>
        <span className={styles.pipeGroupLabel}>구매</span>
        {PIPE_PURCHASE_STEPS.map((status, index) => (
          <span key={status} className={styles.pipeGroup}>
            {index > 0 && <span className={styles.pipeArrow} aria-hidden="true">→</span>}
            <Link href={tradesHref(status)} className={styles.pipeStep} data-testid={`pipe-purchase-${status}`}>
              <span>{status}</span>
              <span className={styles.pipeCount}>{formatNumber(pipeline.purchase[status])}건</span>
            </Link>
          </span>
        ))}
      </div>
      <div className={styles.pipeGroup}>
        <span className={styles.pipeGroupLabel}>판매</span>
        {PIPE_SALE_STEPS.map((status, index) => (
          <span key={status} className={styles.pipeGroup}>
            {index > 0 && <span className={styles.pipeArrow} aria-hidden="true">→</span>}
            <Link href={tradesHref(status)} className={styles.pipeStep} data-testid={`pipe-sale-${status}`}>
              <span>{status}</span>
              <span className={styles.pipeCount}>{formatNumber(pipeline.sale[status])}건</span>
            </Link>
          </span>
        ))}
      </div>
    </section>
  );
}
