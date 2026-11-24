'use client';

/**
 * 구매 목록 표 — 번호 · 품목 · 거래처 · 주문 · 도착 수량 · 상태 · 처리 버튼.
 *
 * 하는 일
 * 1. API의 구매 목록을 그대로 보인다. 도착 수량이 비면 `—`(04 4.5), 주문보다 적게 도착했으면 '부분 입고' 배지.
 * 2. 처리 버튼은 지금 상태에서 갈 수 있는 상태(PURCHASE_TRANSITIONS)만 보인다 — [입고 확정], [이동·통관중으로],
 *    [품절], [발주 취소], 입고완료면 [입고 취소]. 판정은 서버가 하고, 거부되면 배너에 보인다(버튼 숨김은 권한이 아님).
 * 3. 버튼은 누른 사실만 알린다(onReceive · onStatus · onCancelReceipt). 확인 창 · 요청은 TradesView가 한다.
 *
 * 근거: docs/04-api-contract.md 3.3 · 4.5, docs/03-data-model.md 3절, docs/work-units/WU-12-trades.md 2 · 4번, WU-14 3번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-12
 * 2026-11-23  jkspawn  구매 표 · 부분 입고 배지 · 입고 확정 버튼 구현 (WU-12)
 * 2026-11-24  jkspawn  상태 버튼(이동·통관중으로 · 품절 · 발주 취소) · 입고 취소 버튼 추가 (WU-14)
 */
import { EmptyState } from '@/components/common/EmptyState';
import { SubmitButton } from '@/components/common/SubmitButton';
import { formatEmpty, formatNumber } from '@/lib/format';
import {
  PURCHASE_STATUS_CHANGE_TARGETS,
  PURCHASE_TRANSITIONS,
  type Purchase,
  type PurchaseStatus,
  type PurchaseStatusChangeTarget,
} from '@/types/erp';
import styles from './trades.module.css';

/** 입고 확정 · 입고 취소로 가는 상태. 타입이 PURCHASE_STATUSES 상수에 묶여 있어 없는 이름은 빌드가 막는다. */
const RECEIVED = '입고완료' satisfies PurchaseStatus;
const RECEIPT_CANCELLED = '입고취소' satisfies PurchaseStatus;

/** 상태 변경 버튼 글자(`POST /api/purchases/{id}/status`가 받는 값만, 04 3.3). */
export const PURCHASE_STATUS_LABELS: Record<PurchaseStatusChangeTarget, string> = {
  '이동·통관중': '이동·통관중으로',
  품절: '품절',
  취소: '발주 취소',
};

/** 구매 한 건에서 누를 수 있는 일. */
export type PurchaseAction =
  | { type: 'receive' }
  | { type: 'status'; to: PurchaseStatusChangeTarget }
  | { type: 'cancel-receipt' };

/** 지금 상태에서 보일 버튼(전이표 순서 그대로). 결과는 서버 응답을 따른다. */
export function purchaseActions(status: PurchaseStatus): PurchaseAction[] {
  const actions: PurchaseAction[] = [];
  for (const to of PURCHASE_TRANSITIONS[status]) {
    if (to === RECEIVED) actions.push({ type: 'receive' });
    else if (to === RECEIPT_CANCELLED) actions.push({ type: 'cancel-receipt' });
    else if ((PURCHASE_STATUS_CHANGE_TARGETS as readonly string[]).includes(to)) {
      actions.push({ type: 'status', to: to as PurchaseStatusChangeTarget });
    }
  }
  return actions;
}

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
 * - onStatus: [이동·통관중으로] · [품절] · [발주 취소]를 누른 구매와 바꿀 상태. Promise면 끝날 때까지 버튼 잠금
 * - onCancelReceipt: [입고 취소]를 누른 구매(확인 창은 호출부)
 * - emptyText: 비었을 때 문구
 *
 * testid: purchase-row-<purchase_id>, btn-receive-<purchase_id>, btn-purchase-to-<상태>-<purchase_id>,
 *         btn-cancel-receipt-<purchase_id>, partial-badge-<purchase_id>, purchases-empty
 */
export function PurchaseTable({
  purchases,
  itemNames,
  onReceive,
  onStatus,
  onCancelReceipt,
  emptyText = '아직 구매가 없어요',
}: {
  purchases: Purchase[];
  itemNames: ReadonlyMap<string, string>;
  onReceive: (purchase: Purchase) => void;
  onStatus: (purchase: Purchase, to: PurchaseStatusChangeTarget) => void | Promise<void>;
  onCancelReceipt: (purchase: Purchase) => void;
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
            const actions = purchaseActions(purchase.status);
            const pid = purchase.purchase_id;
            return (
              <tr key={purchase.id} data-testid={`purchase-row-${pid}`}>
                <td>{pid}</td>
                <td>{name ? `${purchase.sku_id} ${name}` : purchase.sku_id}</td>
                <td>{purchase.supplier}</td>
                <td className={styles.num}>{formatNumber(purchase.order_qty)}</td>
                <td className={styles.num}>
                  {purchase.received_qty === null ? formatEmpty(null) : formatNumber(purchase.received_qty)}
                </td>
                <td>
                  {purchase.status}
                  {isPartialReceipt(purchase) && (
                    <span className={styles.badge} data-testid={`partial-badge-${pid}`}>
                      부분 입고
                    </span>
                  )}
                </td>
                <td>
                  <div className={styles.actions}>
                    {actions.map((action) => {
                      if (action.type === 'receive') {
                        return (
                          <button
                            key="receive"
                            type="button"
                            className={styles.secondary}
                            data-testid={`btn-receive-${pid}`}
                            onClick={() => onReceive(purchase)}
                          >
                            입고 확정
                          </button>
                        );
                      }
                      if (action.type === 'cancel-receipt') {
                        return (
                          <button
                            key="cancel-receipt"
                            type="button"
                            className={styles.secondary}
                            data-testid={`btn-cancel-receipt-${pid}`}
                            onClick={() => onCancelReceipt(purchase)}
                          >
                            입고 취소
                          </button>
                        );
                      }
                      return (
                        <SubmitButton
                          key={action.to}
                          type="button"
                          testid={`btn-purchase-to-${action.to}-${pid}`}
                          onClick={() => onStatus(purchase, action.to)}
                        >
                          {PURCHASE_STATUS_LABELS[action.to]}
                        </SubmitButton>
                      );
                    })}
                    {actions.length === 0 && <span className={styles.muted}>{formatEmpty(null)}</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
