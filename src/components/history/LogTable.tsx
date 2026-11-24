/**
 * 재고 이력 표 — 시각 · 변화량 · 사유 · 참조 번호(최근순). 원장은 추가만 하므로 수정 · 삭제 버튼이 없다.
 *
 * 하는 일
 * 1. `GET /api/stock-logs` 행을 순서 그대로 보인다. 변화량은 `+8` · `−6`, 시각은 한국 시간(목록 `11/24 14:05`, 마우스를 올리면 전체).
 * 2. 취소는 반대 기록이 한 줄 더 생기는 것으로 보인다(출고 −6 · 출고취소 +6 — 01 6절 "기록은 지우지 않는다").
 * 3. 서버 컴포넌트로 둔다(상태 · 이벤트 없음).
 *
 * 근거: docs/04-api-contract.md 3.5 · 4.6, docs/wireframes.html 6절, docs/work-units/WU-14-history-cancel.md 1번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-14
 * 2026-11-24  jkspawn  재고 이력 표 구현 (WU-14)
 */
import { EmptyState } from '@/components/common/EmptyState';
import { formatDateTime, formatDateTimeFull, formatSigned } from '@/lib/format';
import type { StockLog } from '@/types/erp';
import styles from './history.module.css';

/**
 * 재고 이력 표.
 *
 * props
 * - rows: 지금까지 불러온 이력(최근순)
 *
 * testid: log-row-<log_id>, logs-empty
 */
export function LogTable({ rows }: { rows: StockLog[] }) {
  if (rows.length === 0) return <EmptyState title="아직 재고 이력이 없어요" testid="logs-empty" />;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">시각</th>
            <th scope="col">품목</th>
            <th scope="col" className={styles.num}>
              변화
            </th>
            <th scope="col">사유</th>
            <th scope="col">참조</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((log) => (
            <tr key={log.log_id} data-testid={`log-row-${log.log_id}`}>
              <td title={formatDateTimeFull(log.created_at)}>{formatDateTime(log.created_at)}</td>
              <td>{log.sku_id}</td>
              <td className={`${styles.num} ${log.change_qty < 0 ? styles.minus : styles.plus}`}>
                {formatSigned(log.change_qty)}
              </td>
              <td>{log.reason}</td>
              <td>{log.ref_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
