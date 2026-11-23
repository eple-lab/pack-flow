'use client';

/**
 * 판매 목록 표 — 번호 · 품목 · 채널 · 수량 · 금액 · 송장번호 · 상태 · [출고대기로] · [출고].
 *
 * 하는 일
 * 1. API의 판매 목록을 그대로 보인다. 송장번호가 비면 `—`(04 4.5).
 * 2. 버튼은 SALE_TRANSITIONS로 지금 상태에서 갈 수 있을 때만 보인다. 판정 · 재고 확인은 서버가 한다.
 * 3. 버튼은 SubmitButton — 요청 중 잠가서 빠르게 두 번 눌러도 한 번만 보낸다(04 4.6).
 * 4. 주문취소 · 출고 취소 버튼은 WU-14 몫이라 여기 두지 않는다.
 *
 * 근거: docs/04-api-contract.md 3.4 · 4.5 · 4.6, docs/03-data-model.md 3절, docs/work-units/WU-12-trades.md 5번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-12
 * 2026-11-23  jkspawn  판매 표 · 출고대기로 · 출고 버튼 구현 (WU-12)
 */
import { EmptyState } from '@/components/common/EmptyState';
import { SubmitButton } from '@/components/common/SubmitButton';
import { formatEmpty, formatNumber } from '@/lib/format';
import { SALE_TRANSITIONS, type Sale, type SaleStatus } from '@/types/erp';
import styles from './trades.module.css';

/** [출고대기로]가 가는 상태 · [출고]가 가는 상태. 타입이 SALE_STATUSES 상수에 묶여 있다. */
export const SALE_READY = '출고대기' satisfies SaleStatus;
const SALE_SHIPPED = '출고완료' satisfies SaleStatus;

/** 지금 상태에서 [출고대기로]를 보일지. */
export function canMarkReady(status: SaleStatus): boolean {
  return SALE_TRANSITIONS[status].includes(SALE_READY);
}

/** 지금 상태에서 [출고]를 보일지. */
export function canShip(status: SaleStatus): boolean {
  return SALE_TRANSITIONS[status].includes(SALE_SHIPPED);
}

/**
 * 판매 표.
 *
 * props
 * - sales: `GET /api/sales` 응답
 * - itemNames: 품목코드 → 이름
 * - onReady · onShip: 버튼을 눌렀을 때. Promise를 돌려주면 끝날 때까지 버튼이 잠긴다
 * - emptyText: 비었을 때 문구
 *
 * testid: sale-row-<sale_id>, btn-ready-<sale_id>, btn-ship-<sale_id>, sales-empty
 */
export function SaleTable({
  sales,
  itemNames,
  onReady,
  onShip,
  emptyText = '아직 판매가 없어요',
}: {
  sales: Sale[];
  itemNames: ReadonlyMap<string, string>;
  onReady: (sale: Sale) => Promise<void>;
  onShip: (sale: Sale) => Promise<void>;
  emptyText?: string;
}) {
  if (sales.length === 0) return <EmptyState title={emptyText} testid="sales-empty" />;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">번호</th>
            <th scope="col">품목</th>
            <th scope="col">채널</th>
            <th scope="col" className={styles.num}>
              수량
            </th>
            <th scope="col" className={styles.num}>
              금액(원)
            </th>
            <th scope="col">송장번호</th>
            <th scope="col">상태</th>
            <th scope="col">처리</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => {
            const name = itemNames.get(sale.sku_id);
            const ready = canMarkReady(sale.fulfillment_status);
            const ship = canShip(sale.fulfillment_status);
            return (
              <tr key={sale.id} data-testid={`sale-row-${sale.sale_id}`}>
                <td>{sale.sale_id}</td>
                <td>{name ? `${sale.sku_id} ${name}` : sale.sku_id}</td>
                <td>{sale.channel}</td>
                <td className={styles.num}>{formatNumber(sale.sold_qty)}</td>
                <td className={styles.num}>{formatNumber(sale.sale_amount)}</td>
                <td>{formatEmpty(sale.invoice_no)}</td>
                <td>{sale.fulfillment_status}</td>
                <td>
                  <div className={styles.actions}>
                    {ready && (
                      <SubmitButton type="button" testid={`btn-ready-${sale.sale_id}`} onClick={() => onReady(sale)}>
                        출고대기로
                      </SubmitButton>
                    )}
                    {ship && (
                      <SubmitButton type="button" testid={`btn-ship-${sale.sale_id}`} onClick={() => onShip(sale)}>
                        출고
                      </SubmitButton>
                    )}
                    {!ready && !ship && <span className={styles.muted}>{formatEmpty(null)}</span>}
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
