/**
 * 추천 발주 수량 계산 (순수 함수) — 품절이 가까운 품목을 골라 발주 후보 표를 만든다.
 *
 * 하는 일
 * 1. 품목 · 최근 7일 출고 이력 · 구매 목록을 인자로 받아 후보와 추천 수량을 계산한다.
 *    DB · LLM · 현재 시각을 직접 부르지 않는다(시간은 now 인자) — 같은 입력이면 같은 결과.
 * 2. 추천 수량 = max(0, ceil(일평균 출고 × 리드타임) + 안전재고 − 재고 − 입고 예정).
 * 3. 후보 = 추천 수량 > 0 이고 (재고 < 안전재고 또는 품절 예상 3일 이내).
 * 4. 근거 문장(basis)도 여기서 만든다. LLM은 숫자를 정하지 않는다(설계 원칙 4 · P-08).
 *
 * 입력은 이미 사용자 JWT로 조회된 값이어야 한다(남의 데이터가 섞이면 안 됨 — 호출하는 쪽 책임).
 *
 * 근거: docs/work-units/WU-32-reorder.md · docs/04-api-contract.md 3.8 · docs/01-enterprise-architecture.md 6절
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple     자리 생성 (WU-01) — 구현은 skygaul WU-32
 * 2026-11-23  skygaul  처음 구현 — 후보 · 추천 수량 · 근거 문장 계산 (WU-32)
 */
import type { PoDraftLine } from '@/types/agent';
import type { Item, Purchase, PurchaseStatus, StockLog } from '@/types/erp';

/** 출고량을 보는 기간(일). */
export const WINDOW_DAYS = 7;
/** 발주해서 들어오기까지 걸리는 날(일). 추천 수량은 이 기간 동안 팔릴 양을 채운다. */
export const LEAD_DAYS = 7;
/** 품절 예상일이 이 값 이하면 재고가 안전재고 이상이어도 후보로 본다. */
export const SOLD_OUT_WITHIN_DAYS = 3;
/** 거래처를 알 수 없을 때 표시하는 값(04 3.8). */
export const UNKNOWN_SUPPLIER = '미지정';
/** 입고 예정으로 치는 구매 상태. */
const INBOUND_STATUSES: readonly PurchaseStatus[] = ['발주완료', '이동·통관중'];

const DAY_MS = 24 * 60 * 60 * 1000;

/** 계산에 필요한 품목 필드만. */
export type ReorderItem = Pick<Item, 'sku_id' | 'item_name' | 'unit_cost' | 'stock_qty' | 'safety_stock'>;
/** 계산에 필요한 재고 이력 필드만. `실판매출고`만 세고, 7일 밖은 무시한다. */
export type ReorderLog = Pick<StockLog, 'sku_id' | 'change_qty' | 'reason' | 'created_at'>;
/** 계산에 필요한 구매 필드만. 입고 예정(진행 중 구매)과 최근 거래처를 여기서 뽑는다. */
export type ReorderPurchase = Pick<Purchase, 'sku_id' | 'supplier' | 'order_qty' | 'status' | 'created_at'>;

export type ReorderInput = {
  items: readonly ReorderItem[];
  logs: readonly ReorderLog[];
  purchases: readonly ReorderPurchase[];
  /** 지금 시각. 7일 창의 끝. 호출하는 쪽이 넘긴다(테스트 고정용). */
  now: Date;
};

export type ReorderOptions = {
  /** 리드타임 덮어쓰기(일). 기본은 LEAD_DAYS. 시험에서 올림 계산을 보려고 열어 둠. */
  leadDays?: number;
};

/** 소수 첫째 자리까지 사람이 읽기 좋게(1.714 → "1.7", 2 → "2", 0 → "0"). */
function formatPerDay(total: number): string {
  return String(Math.round((total / WINDOW_DAYS) * 10) / 10);
}

/**
 * 발주 후보 목록을 계산한다. 후보가 아닌 품목은 빠진다. 순서는 items 입력 순서를 지킨다.
 *
 * 올림 · 비교는 정수 연산으로 한다(부동소수 오차로 12.000000000000002 → 13이 되는 것을 막는다).
 * 출고취소 이력은 따로 빼지 않는다 — WU-32 규칙이 `실판매출고`만 센다.
 *
 * @returns PoDraftLine[] — 수량 · 단가 · 근거는 모두 코드가 정한 값
 */
export function computeReorderCandidates(input: ReorderInput, options: ReorderOptions = {}): PoDraftLine[] {
  const leadDays = options.leadDays ?? LEAD_DAYS;
  const windowStart = input.now.getTime() - WINDOW_DAYS * DAY_MS;
  const windowEnd = input.now.getTime();

  // 품목별 최근 7일 출고 수량 합 (change_qty는 출고가 음수)
  const soldBySku = new Map<string, number>();
  for (const log of input.logs) {
    if (log.reason !== '실판매출고') continue;
    const at = Date.parse(log.created_at);
    if (Number.isNaN(at) || at < windowStart || at > windowEnd) continue;
    soldBySku.set(log.sku_id, (soldBySku.get(log.sku_id) ?? 0) + Math.max(0, -log.change_qty));
  }

  // 품목별 입고 예정 수량, 가장 최근 구매의 거래처
  const inboundBySku = new Map<string, number>();
  const latestSupplier = new Map<string, { at: number; supplier: string }>();
  for (const purchase of input.purchases) {
    if (INBOUND_STATUSES.includes(purchase.status)) {
      inboundBySku.set(purchase.sku_id, (inboundBySku.get(purchase.sku_id) ?? 0) + purchase.order_qty);
    }
    const supplier = purchase.supplier.trim();
    const at = Date.parse(purchase.created_at);
    if (supplier === '' || Number.isNaN(at)) continue;
    const known = latestSupplier.get(purchase.sku_id);
    if (known === undefined || at > known.at) latestSupplier.set(purchase.sku_id, { at, supplier });
  }

  const candidates: PoDraftLine[] = [];
  for (const item of input.items) {
    const sold = soldBySku.get(item.sku_id) ?? 0;
    const inbound = inboundBySku.get(item.sku_id) ?? 0;

    // ceil(일평균 × 리드타임) = ceil(sold × leadDays ÷ WINDOW_DAYS) — 정수끼리 계산
    const leadDemand = Math.ceil((sold * leadDays) / WINDOW_DAYS);
    const recommended = Math.max(0, leadDemand + item.safety_stock - item.stock_qty - inbound);
    if (recommended <= 0) continue;

    // 품절 예상일 = 재고 ÷ (sold ÷ WINDOW_DAYS) ≤ 3  ⇔  재고 × WINDOW_DAYS ≤ 3 × sold
    const belowSafety = item.stock_qty < item.safety_stock;
    const soldOutSoon = sold > 0 && item.stock_qty * WINDOW_DAYS <= SOLD_OUT_WITHIN_DAYS * sold;
    if (!belowSafety && !soldOutSoon) continue;

    candidates.push({
      sku_id: item.sku_id,
      item_name: item.item_name,
      stock_qty: item.stock_qty,
      safety_stock: item.safety_stock,
      recommended_qty: recommended,
      unit_cost: item.unit_cost,
      supplier: latestSupplier.get(item.sku_id)?.supplier ?? UNKNOWN_SUPPLIER,
      basis: `최근 ${WINDOW_DAYS}일 출고 ${sold}개(하루 ${formatPerDay(sold)}개), 입고 예정 ${inbound}개, 안전재고 ${item.safety_stock}개 기준`,
    });
  }
  return candidates;
}
