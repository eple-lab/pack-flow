/**
 * 입출고 화면 주소(`?tab=purchase|sale|bulk&status=...`)를 읽고 만드는 순수 함수 모음.
 *
 * 하는 일
 * 1. 쿼리에서 탭과 상태 필터를 고른다. 상태는 erp.ts 상수에 있는 값만 받고, 없는 값은 버린다.
 * 2. 대시보드 파이프라인은 `?status=`만 보낸다(WU-11) — 상태가 구매 상태면 구매 탭, 판매 상태면 판매 탭을 연다.
 * 3. 'use client'가 없다 — 서버 page.tsx와 클라이언트 TradesView가 함께 쓴다.
 *
 * 근거: docs/work-units/WU-12-trades.md 1번, docs/04-api-contract.md 3.3 · 3.4
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  jkspawn  처음 작성 — 탭 · 상태 쿼리 읽기 · 만들기 (WU-12)
 * 2026-11-24  jkspawn  일괄 등록 탭(`tab=bulk`, 상태 필터 없음) 추가 (WU-13)
 */
import { PURCHASE_STATUSES, SALE_STATUSES, type PurchaseStatus, type SaleStatus } from '@/types/erp';

export type TradesTab = 'purchase' | 'sale' | 'bulk';

/** 화면이 쓰는 쿼리 값. 상태 필터는 고른 탭의 것만 남는다. */
export type TradesQuery =
  | { tab: 'purchase'; status: PurchaseStatus | null }
  | { tab: 'sale'; status: SaleStatus | null }
  | { tab: 'bulk'; status: null };

type RawParam = string | string[] | undefined;

function first(value: RawParam): string | null {
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === 'string' && text.trim() !== '' ? text.trim() : null;
}

function isPurchaseStatus(value: string | null): value is PurchaseStatus {
  return value !== null && (PURCHASE_STATUSES as readonly string[]).includes(value);
}

function isSaleStatus(value: string | null): value is SaleStatus {
  return value !== null && (SALE_STATUSES as readonly string[]).includes(value);
}

/**
 * 쿼리에서 탭 · 상태를 고른다.
 * - `tab`이 없으면 상태로 탭을 고른다(판매 상태면 sale, 그 밖은 purchase).
 * - 고른 탭에 맞지 않는 상태(예: `tab=sale&status=발주완료`)는 버린다. 일괄 등록 탭(`bulk`)은 상태 필터가 없다.
 */
export function parseTradesQuery(params: { tab?: RawParam; status?: RawParam }): TradesQuery {
  const tabParam = first(params.tab);
  const status = first(params.status);
  const tab: TradesTab =
    tabParam === 'sale' || tabParam === 'purchase' || tabParam === 'bulk'
      ? tabParam
      : isSaleStatus(status)
        ? 'sale'
        : 'purchase';
  if (tab === 'bulk') return { tab, status: null };
  if (tab === 'sale') return { tab, status: isSaleStatus(status) ? status : null };
  return { tab, status: isPurchaseStatus(status) ? status : null };
}

/** 입출고 화면 주소. 상태가 없으면 탭만. 한글 상태는 주소용으로 인코딩한다. */
export function tradesUrl(tab: TradesTab, status?: PurchaseStatus | SaleStatus | null): string {
  const params = new URLSearchParams({ tab });
  if (status) params.set('status', status);
  return `/trades?${params.toString()}`;
}
