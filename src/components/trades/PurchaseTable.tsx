'use client';

/**
 * 구매 목록 표 — 번호 · 품목 · 거래처 · 주문 · 도착 수량 · 상태 · [입고 확정].
 *
 * 하는 일
 * 1. API의 구매 목록을 그대로 보인다. 도착 수량이 비면 `—`(04 4.5), 주문보다 적게 도착했으면 '부분 입고' 배지.
 * 2. [입고 확정]은 지금 상태에서 '입고완료'로 갈 수 있을 때만(PURCHASE_TRANSITIONS) 보인다. 판정은 서버가 한다.
 * 3. 상태 변경 · 입고 취소 버튼은 WU-14 몫이라 여기 두지 않는다.
 *
 * 근거: docs/04-api-contract.md 3.3 · 4.5, docs/03-data-model.md 3절, docs/work-units/WU-12-trades.md 2 · 4번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-12
 * 2026-11-23  jkspawn  구매 표 · 부분 입고 배지 · 입고 확정 버튼 구현 (WU-12)
 */
import { EmptyState } from '@/components/common/EmptyState';
import { formatEmpty, formatNumber } from '@/lib/format';
import { PURCHASE_TRANSITIONS, type Purchase, type PurchaseStatus } from '@/types/erp';
import styles from './trades.module.css';

/** 입고 확정으로 가는 상태. 타입이 PURCHASE_STATUSES 상수에 묶여 있어 없는 이름은 빌드가 막는다. */
const RECEIVED = '입고완료' satisfies PurchaseStatus;

/** 지금 상태에서 [입고 확정]을 보일지(전이표 사본 — 결과는 서버 응답을 따른다). */
export function canReceive(status: PurchaseStatus): boolean {
  return PURCHASE_TRANSITIONS[status].includes(RECEIVED);
}

/** 주문보다 적게 도착했는지. 도착 전(null)은 아니다. */
export function isPartialReceipt(purchase: Pick<Purchase, 'order_qty' | 'received_qty'>): boolean {
  return purchase.received_qty !== null && purchase.received_qty < purchase.order_qty;
}

/**
 * 구매 표.
 *
 * props
 * - purchases: `GET /api/purchases` 응답
 * - itemNames: 품목코드 → 이름(없으면 코드만)
 * - onReceive: [입고 확정]을 누른 구매
 * - emptyText: 비었을 때 문구
 *
 * testid: purchase-row-<purchase_id>, btn-receive-<purchase_id>, partial-badge-<purchase_id>, purchases-empty
 */
export function PurchaseTable({
  purchases,
  itemNames,
  onReceive,
  emptyText = '아직 구매가 없어요',
}: {
  purchases: Purchase[];
  itemNames: ReadonlyMap<string, string>;
  onReceive: (purchase: Purchase) => void;
  emptyText?: string;
}) {
  if (purchases.length === 0) return <EmptyState title={emptyText} testid="purchases-empty" />;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">번호</th>
            <th scope="col">품목</th>
            <th scope="col">거래처</th>
            <th scope="col" className={styles.num}>
              주문
            </th>
            <th scope="col" className={styles.num}>
              도착 수량
            </th>
            <th scope="col">상태</th>
            <th scope="col">처리</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((purchase) => {
            const name = itemNames.get(purchase.sku_id);
            return (
              <tr key={purchase.id} data-testid={`purchase-row-${purchase.purchase_id}`}>
                <td>{purchase.purchase_id}</td>
                <td>{name ? `${purchase.sku_id} ${name}` : purchase.sku_id}</td>
                <td>{purchase.supplier}</td>
                <td className={styles.num}>{formatNumber(purchase.order_qty)}</td>
                <td className={styles.num}>
                  {purchase.received_qty === null ? formatEmpty(null) : formatNumber(purchase.received_qty)}
                </td>
                <td>
                  {purchase.status}
                  {isPartialReceipt(purchase) && (
                    <span className={styles.badge} data-testid={`partial-badge-${purchase.purchase_id}`}>
                      부분 입고
                    </span>
                  )}
                </td>
                <td>
                  {canReceive(purchase.status) ? (
                    <button
                      type="button"
                      className={styles.secondary}
                      data-testid={`btn-receive-${purchase.purchase_id}`}
                      onClick={() => onReceive(purchase)}
                    >
                      입고 확정
                    </button>
                  ) : (
                    <span className={styles.muted}>{formatEmpty(null)}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
