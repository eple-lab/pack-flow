/**
 * 재고 · 입출고 DB 함수(pf_*)를 부르는 얇은 래퍼.
 *
 * 하는 일
 * 1. 함수마다 rpc 호출 한 번만 한다. 재고 계산 · 전이 판정은 하지 않는다(DB가 한다, D-10).
 * 2. rpc 인자 이름은 마이그레이션의 p_… 그대로 쓴다. 객체 키는 p_를 뗀 이름이다.
 * 3. DB 오류는 errors.ts의 fromSupabaseError로 코드 · detail을 옮겨 PfError로 던진다.
 *    모르는 오류는 PF_INTERNAL로 바뀌고 원문은 응답에 싣지 않는다.
 * 4. 래퍼 없음: pf_require_user · pf_purchase_transition_ok · pf_sale_transition_ok(함수 안 · 판정용).
 *
 * 근거: docs/03-data-model.md 4절 · WU-03 6번 · 마이그레이션 20261120100200_inventory.sql · 20261120100300_bulk.sql · 20261120100100_core_functions.sql
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 재고 함수 rpc 래퍼 (WU-03)
 * 2026-11-23  eple  pf_reset_and_seed SQL이 생겨 '아직 SQL 없음' 안내 제거 (WU-08)
 */
import { fromSupabaseError, PfError } from '@/lib/api/errors';
import type {
  BulkCommitResult,
  BulkRowInput,
  DataSource,
  Item,
  Purchase,
  PurchaseStatusChangeTarget,
  PurchaseWithStock,
  SaleStatusChangeTarget,
  Sale,
  SaleWithStock,
  SeedResult,
  ServerErrorCode,
} from '@/types/erp';

/**
 * supabase.rpc를 흉내 내는 최소 모양. 실제 SupabaseClient와 테스트용 가짜 객체가 모두 맞는다.
 * 오류 칸은 PostgREST 오류 모양(message=코드, details=JSON 문자열)을 따른다.
 */
export type Rpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{
    data: unknown;
    error: { message?: unknown; details?: unknown; code?: unknown } | null;
  }>;
};

/**
 * 래퍼가 부르는 함수 이름 → rpc 인자 이름(p_… 순서 그대로).
 * 마이그레이션 파일과 정확히 같아야 한다(테스트 T-INV-1이 확인한다).
 */
export const RPC_PARAMS: Record<string, readonly string[]> = {
  pf_create_item: ['p_sku_id', 'p_item_name', 'p_unit_cost', 'p_sale_price', 'p_safety_stock', 'p_source_url'],
  pf_create_purchase: ['p_sku_id', 'p_supplier', 'p_order_qty', 'p_purchase_cost', 'p_invoice_no', 'p_source'],
  pf_set_purchase_status: ['p_id', 'p_to_status'],
  pf_receive_purchase: ['p_id', 'p_received_qty'],
  pf_cancel_receipt: ['p_id'],
  pf_create_sale: ['p_sku_id', 'p_channel', 'p_sold_qty', 'p_sale_amount', 'p_invoice_no', 'p_source'],
  pf_set_sale_status: ['p_id', 'p_to_status'],
  pf_ship_sale: ['p_id'],
  pf_cancel_shipment: ['p_id'],
  pf_bulk_apply: ['p_rows'],
  pf_llm_take: ['p_user_limit', 'p_global_limit'],
  pf_reset_and_seed: ['p_data'],
};

/**
 * rpc 한 번 부르기. 오류가 있으면 코드 · detail을 옮겨 PfError를 던진다.
 * 던지는 오류: PfError(서버 코드 전부, PF_NOT_IMPLEMENTED 포함). 모르는 오류는 PF_INTERNAL.
 * 부작용: 모르는 DB 오류는 errors.ts의 log.error로 원문을 서버 로그에 남긴다.
 */
async function call<T>(supabase: Rpc, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const body = fromSupabaseError(error).body.error;
    throw new PfError(body.code as ServerErrorCode, body.detail ?? null);
  }
  return data as T;
}

/**
 * 품목 등록(재고 0). 던지는 오류: PF_VALIDATION · PF_DUPLICATE_SKU · PF_UNAUTHENTICATED · PF_NOT_IMPLEMENTED.
 */
export function createItem(
  supabase: Rpc,
  input: {
    sku_id: string;
    item_name: string;
    unit_cost: number;
    sale_price: number;
    safety_stock: number;
    source_url: string | null;
  },
): Promise<Item> {
  return call<Item>(supabase, 'pf_create_item', {
    p_sku_id: input.sku_id,
    p_item_name: input.item_name,
    p_unit_cost: input.unit_cost,
    p_sale_price: input.sale_price,
    p_safety_stock: input.safety_stock,
    p_source_url: input.source_url,
  });
}

/**
 * 구매 생성(발주완료). source를 생략하면 'form'. 던지는 오류: PF_NOT_FOUND(품목) · PF_DUPLICATE_INVOICE · PF_VALIDATION.
 */
export function createPurchase(
  supabase: Rpc,
  input: {
    sku_id: string;
    supplier: string;
    order_qty: number;
    purchase_cost: number;
    invoice_no: string | null;
    source?: DataSource;
  },
): Promise<Purchase> {
  return call<Purchase>(supabase, 'pf_create_purchase', {
    p_sku_id: input.sku_id,
    p_supplier: input.supplier,
    p_order_qty: input.order_qty,
    p_purchase_cost: input.purchase_cost,
    p_invoice_no: input.invoice_no,
    p_source: input.source ?? 'form',
  });
}

/**
 * 구매 상태 변경(재고 영향 없음). 던지는 오류: PF_NOT_FOUND · PF_INVALID_TRANSITION.
 */
export function setPurchaseStatus(
  supabase: Rpc,
  input: { id: string; to_status: PurchaseStatusChangeTarget },
): Promise<Purchase> {
  return call<Purchase>(supabase, 'pf_set_purchase_status', {
    p_id: input.id,
    p_to_status: input.to_status,
  });
}

/**
 * 입고 확정: 재고 +received_qty. 던지는 오류: PF_NOT_FOUND · PF_INVALID_TRANSITION · PF_VALIDATION.
 */
export function receivePurchase(supabase: Rpc, input: { id: string; received_qty: number }): Promise<PurchaseWithStock> {
  return call<PurchaseWithStock>(supabase, 'pf_receive_purchase', {
    p_id: input.id,
    p_received_qty: input.received_qty,
  });
}

/**
 * 입고 취소: 재고 −received_qty. 던지는 오류: PF_NOT_FOUND · PF_INVALID_TRANSITION · PF_INSUFFICIENT_STOCK.
 */
export function cancelReceipt(supabase: Rpc, input: { id: string }): Promise<PurchaseWithStock> {
  return call<PurchaseWithStock>(supabase, 'pf_cancel_receipt', {
    p_id: input.id,
  });
}

/**
 * 판매 생성(주문접수). source를 생략하면 'form'. 던지는 오류: PF_NOT_FOUND(품목) · PF_DUPLICATE_INVOICE · PF_VALIDATION.
 */
export function createSale(
  supabase: Rpc,
  input: {
    sku_id: string;
    channel: string;
    sold_qty: number;
    sale_amount: number;
    invoice_no: string | null;
    source?: DataSource;
  },
): Promise<Sale> {
  return call<Sale>(supabase, 'pf_create_sale', {
    p_sku_id: input.sku_id,
    p_channel: input.channel,
    p_sold_qty: input.sold_qty,
    p_sale_amount: input.sale_amount,
    p_invoice_no: input.invoice_no,
    p_source: input.source ?? 'form',
  });
}

/**
 * 판매 상태 변경(재고 영향 없음). 던지는 오류: PF_NOT_FOUND · PF_INVALID_TRANSITION.
 */
export function setSaleStatus(supabase: Rpc, input: { id: string; to_status: SaleStatusChangeTarget }): Promise<Sale> {
  return call<Sale>(supabase, 'pf_set_sale_status', {
    p_id: input.id,
    p_to_status: input.to_status,
  });
}

/**
 * 출고 확정: 재고 −sold_qty. 주문접수에서 부르면 출고대기를 거쳐 한 번에 간다.
 * 던지는 오류: PF_NOT_FOUND · PF_INVALID_TRANSITION · PF_INSUFFICIENT_STOCK(detail에 남은 수량).
 */
export function shipSale(supabase: Rpc, input: { id: string }): Promise<SaleWithStock> {
  return call<SaleWithStock>(supabase, 'pf_ship_sale', {
    p_id: input.id,
  });
}

/**
 * 출고 취소: 재고 +sold_qty. 던지는 오류: PF_NOT_FOUND · PF_INVALID_TRANSITION.
 */
export function cancelShipment(supabase: Rpc, input: { id: string }): Promise<SaleWithStock> {
  return call<SaleWithStock>(supabase, 'pf_cancel_shipment', {
    p_id: input.id,
  });
}

/**
 * 일괄 등록 반영. 행마다 DB 안에서 서브트랜잭션으로 처리하고 실패 행은 사유와 함께 돌려준다.
 * 던지는 오류: PF_VALIDATION · PF_UNAUTHENTICATED (행 단위 실패는 결과의 skipped에 들어간다).
 */
export function bulkApply(supabase: Rpc, input: { rows: BulkRowInput[] }): Promise<BulkCommitResult> {
  return call<BulkCommitResult>(supabase, 'pf_bulk_apply', {
    p_rows: input.rows,
  });
}

/**
 * LLM 호출 수 +1(한국 시간 하루). 반환: 오늘 내 호출 수.
 * 던지는 오류: PF_QUOTA_EXCEEDED(detail.scope = user | global) · PF_VALIDATION · PF_UNAUTHENTICATED.
 */
export function llmTake(supabase: Rpc, input: { user_limit: number; global_limit: number }): Promise<number> {
  return call<number>(supabase, 'pf_llm_take', {
    p_user_limit: input.user_limit,
    p_global_limit: input.global_limit,
  });
}

/**
 * 시드 데이터 초기화 후 넣기 — 본인 데이터만 지우고 다시 넣는다(SQL: 20261123100000_seed.sql).
 * 던지는 오류: PF_VALIDATION(입력 모양 · 값) · PF_UNAUTHENTICATED · PF_NOT_IMPLEMENTED(events가 아직 stub인 재고 함수를 부를 때).
 */
export function resetAndSeed(supabase: Rpc, input: { data: Record<string, unknown> }): Promise<SeedResult> {
  return call<SeedResult>(supabase, 'pf_reset_and_seed', {
    p_data: input.data,
  });
}
