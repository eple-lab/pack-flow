'use client';

/**
 * 품목별 재고 표 — 품목코드 · 이름 · 재고 · 안전재고 · 상태, 행을 누르면 그 품목의 이력으로.
 *
 * 하는 일
 * 1. API의 items를 그대로 보인다. 미만 여부도 API의 below_safety를 쓴다(화면에서 비교하지 않음 — T-S1-3).
 * 2. 행을 누르면 onRowClick(sku_id). 키보드 사용자를 위해 품목코드 칸에도 같은 주소의 링크를 둔다.
 * 3. 표는 가로 스크롤 상자 안에 둔다(휴대폰 폭).
 *
 * 근거: docs/04-api-contract.md 3.5 · 4.6, docs/pack-flow-plan.md 5절 · WU-11 5번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-11
 * 2026-11-23  jkspawn  품목별 재고 표 · 미만 배지 · 이력 이동 구현 (WU-11)
 */
import Link from 'next/link';
import { EmptyState } from '@/components/common/EmptyState';
import { formatNumber } from '@/lib/format';
import type { Dashboard } from '@/types/erp';
import styles from './dashboard.module.css';

/** 품목 이력 화면 주소. */
export function historyHref(sku_id: string): string {
  return `/history?sku_id=${encodeURIComponent(sku_id)}`;
}

/**
 * 품목별 재고 표. 숫자 · 미만 여부는 API 값 그대로 쓴다(T-S1-3).
 *
 * props
 * - items: `Dashboard['items']`
 * - onRowClick: 행을 눌렀을 때 sku_id와 함께 부른다(보통 `/history?sku_id=`로 이동)
 *
 * testid: stock-row-<sku_id>, stock-qty-<sku_id>, stock-badge-<sku_id>, stock-empty(없을 때)
 */
export function StockTable({
  items,
  onRowClick,
}: {
  items: Dashboard['items'];
  onRowClick: (sku_id: string) => void;
}) {
  return (
    <section className={styles.section} aria-labelledby="stock-title">
      <h2 id="stock-title" className={styles.sectionTitle}>
        품목별 재고
      </h2>
      {items.length === 0 ? (
        <EmptyState title="아직 품목이 없어요" testid="stock-empty" />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">품목코드</th>
                <th scope="col">이름</th>
                <th scope="col" className={styles.num}>
                  재고
                </th>
                <th scope="col" className={styles.num}>
                  안전재고
                </th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.sku_id}
                  className={styles.clickRow}
                  data-testid={`stock-row-${item.sku_id}`}
                  onClick={() => onRowClick(item.sku_id)}
                >
                  <td>
                    {/* 행 클릭과 같은 곳으로 가는 링크 — 링크를 누르면 행 클릭은 막아 두 번 이동하지 않게 한다 */}
                    <Link
                      href={historyHref(item.sku_id)}
                      className={styles.rowLink}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {item.sku_id}
                    </Link>
                  </td>
                  <td>{item.item_name}</td>
                  <td className={styles.num} data-testid={`stock-qty-${item.sku_id}`}>
                    {formatNumber(item.stock_qty)}
                  </td>
                  <td className={styles.num}>{formatNumber(item.safety_stock)}</td>
                  <td>
                    {item.below_safety ? (
                      <span className={`${styles.badge} ${styles.badgeDanger}`} data-testid={`stock-badge-${item.sku_id}`}>
                        안전재고 미만
                      </span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeOk}`}>정상</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
