/**
 * 최근 재고 변동 5건 — 시각 · 품목 · 증감 · 사유.
 *
 * 하는 일
 * 1. API의 recent_changes를 순서 그대로 보인다(서버가 최근순 5건을 준다).
 * 2. 시각은 한국 시간 `11/24 14:05`, 마우스를 올리면 전체 시각. 증감은 `+8` · `−6`(format.ts).
 * 3. 품목은 품목코드에, 같은 응답의 items에서 찾은 이름을 붙인다(숫자 계산이 아니라 이름 찾기만).
 *
 * 근거: docs/04-api-contract.md 3.5 · 4.6, docs/pack-flow-plan.md 5절 · WU-11 6번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-11
 * 2026-11-23  jkspawn  최근 변경 5건 표 구현 (WU-11)
 */
import { EmptyState } from '@/components/common/EmptyState';
import { formatDateTime, formatDateTimeFull, formatSigned } from '@/lib/format';
import type { Dashboard } from '@/types/erp';
import styles from './dashboard.module.css';

/**
 * 최근 변경 표.
 *
 * props
 * - changes: `Dashboard['recent_changes']`
 * - items: 품목명을 찾을 목록(`Dashboard['items']`). 못 찾으면 품목코드만 보인다.
 *
 * testid: recent-row-<log_id>, recent-empty(없을 때)
 */
export function RecentChanges({
  changes,
  items,
}: {
  changes: Dashboard['recent_changes'];
  items: Dashboard['items'];
}) {
  const names = new Map(items.map((item) => [item.sku_id, item.item_name]));

  return (
    <section className={styles.section} aria-labelledby="recent-title">
      <h2 id="recent-title" className={styles.sectionTitle}>
        최근 변경
      </h2>
      {changes.length === 0 ? (
        <EmptyState title="아직 재고 변동이 없어요" testid="recent-empty" />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">시각</th>
                <th scope="col">품목</th>
                <th scope="col" className={styles.num}>
                  증감
                </th>
                <th scope="col">사유</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((log) => {
                const name = names.get(log.sku_id);
                return (
                  <tr key={log.log_id} data-testid={`recent-row-${log.log_id}`}>
                    <td title={formatDateTimeFull(log.created_at)}>{formatDateTime(log.created_at)}</td>
                    <td>{name ? `${log.sku_id} ${name}` : log.sku_id}</td>
                    <td className={`${styles.num} ${log.change_qty < 0 ? styles.minus : styles.plus}`}>
                      {formatSigned(log.change_qty)}
                    </td>
                    <td>{log.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
