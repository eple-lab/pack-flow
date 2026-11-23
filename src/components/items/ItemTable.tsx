'use client';

/**
 * 품목 목록 표 — 품목코드 · 이름 · 매입단가 · 판매가 · 안전재고 · 현재 재고(읽기 전용) · 상태 · [수정] · [이력].
 *
 * 하는 일
 * 1. API의 품목 목록을 그대로 보인다. 미만 배지는 API의 below_safety를 따른다(화면에서 비교하지 않음).
 * 2. 재고는 글자로만 — 입력 칸이 없다(재고는 이력의 합, 01 6절).
 * 3. 구매처 메모(source_url)는 이름 아래 글자로만 보인다. 링크로 열지 않는다(05 5절).
 * 4. 삭제 버튼은 없다(이력 · 거래가 품목을 참조 — 고도화 후보).
 *
 * 근거: docs/04-api-contract.md 3.2 · 4.6, docs/05-security.md 5절, docs/wireframes.html 5.4절, docs/work-units/WU-16-items.md 1 · 5 · 6번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-16
 * 2026-11-23  jkspawn  품목 표 · 검색 거르기 · 수정 · 이력 링크 구현 (WU-16)
 */
import Link from 'next/link';
import { EmptyState } from '@/components/common/EmptyState';
import { formatNumber, searchEmptyMessage } from '@/lib/format';
import type { Item } from '@/types/erp';
import styles from './items.module.css';

/** 검색어로 품목을 거른다(품목코드 · 이름, 대소문자 무시, 화면에서만). 빈 검색어면 전부. */
export function filterItems(items: Item[], query: string): Item[] {
  const q = query.trim().toLowerCase();
  if (q === '') return items;
  return items.filter((item) => item.sku_id.toLowerCase().includes(q) || item.item_name.toLowerCase().includes(q));
}

/** 품목 이력 화면 주소. */
export function itemHistoryHref(sku_id: string): string {
  return `/history?sku_id=${encodeURIComponent(sku_id)}`;
}

/**
 * 품목 표.
 *
 * props
 * - items: 보일 품목(이미 거른 목록)
 * - query: 지금 검색어(비었을 때 문구에 쓴다)
 * - onEdit: [수정]을 누른 품목
 *
 * testid: item-row-<sku_id>, item-stock-<sku_id>, item-badge-<sku_id>, btn-edit-item-<sku_id>, link-history-<sku_id>, items-empty
 */
export function ItemTable({ items, query, onEdit }: { items: Item[]; query: string; onEdit: (item: Item) => void }) {
  if (items.length === 0) {
    return <EmptyState title={query.trim() ? searchEmptyMessage(query) : '아직 품목이 없어요'} testid="items-empty" />;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">품목코드</th>
            <th scope="col">이름</th>
            <th scope="col" className={styles.num}>
              매입단가(원)
            </th>
            <th scope="col" className={styles.num}>
              판매가(원)
            </th>
            <th scope="col" className={styles.num}>
              안전재고
            </th>
            <th scope="col" className={styles.num}>
              재고(읽기 전용)
            </th>
            <th scope="col">상태</th>
            <th scope="col">처리</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.sku_id} data-testid={`item-row-${item.sku_id}`}>
              <td>{item.sku_id}</td>
              <td>
                {item.item_name}
                {/* 구매처 메모는 글자로만 — 링크로 열지 않는다(05 5절) */}
                {item.source_url && (
                  <span className={styles.memo} title={item.source_url}>
                    {item.source_url}
                  </span>
                )}
              </td>
              <td className={styles.num}>{formatNumber(item.unit_cost)}</td>
              <td className={styles.num}>{formatNumber(item.sale_price)}</td>
              <td className={styles.num}>{formatNumber(item.safety_stock)}</td>
              <td className={styles.num} data-testid={`item-stock-${item.sku_id}`}>
                {formatNumber(item.stock_qty)}
              </td>
              <td>
                {item.below_safety ? (
                  <span className={`${styles.badge} ${styles.badgeDanger}`} data-testid={`item-badge-${item.sku_id}`}>
                    안전재고 미만
                  </span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeOk}`}>정상</span>
                )}
              </td>
              <td>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondary}
                    data-testid={`btn-edit-item-${item.sku_id}`}
                    onClick={() => onEdit(item)}
                  >
                    수정
                  </button>
                  <Link href={itemHistoryHref(item.sku_id)} className={styles.link} data-testid={`link-history-${item.sku_id}`}>
                    이력
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
