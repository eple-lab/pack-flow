/**
 * 요청 종류마다 하나씩 — 04 3절 라우트가 받는 본문 · 쿼리의 zod 스키마 모음.
 *
 * 하는 일
 * 1. 모든 스키마는 strict: 계약에 없는 필드(user_id · stock_qty · id …)는 not_allowed_field로 거부한다(04 4.1).
 * 2. 칸 규칙(길이 · 범위 · 빈 값 처리)은 04 4.2 표와 한 줄씩 대응한다. 숫자 상한은 아래 LIMITS 한곳.
 * 3. 화면 폼 · API 라우트 · 에이전트가 같은 스키마를 쓴다(parseWith → detail.ts). 새 문구를 만들지 않는다.
 * 4. DB 함수 · 테이블 CHECK가 같은 범위를 한 번 더 막는다(03 2절 — 여러 겹 방어).
 *
 * 근거: docs/04-api-contract.md 3 · 4.1 · 4.2, docs/03-data-model.md 2절, WU-03 8번 · T-VAL-7
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 라우트별 입력 스키마 (WU-03)
 */
import { z } from 'zod';
import type { AgentAction, PoConfirmLine } from '@/types/agent';
import {
  BULK_FORMATS,
  BULK_KINDS,
  PURCHASE_STATUSES,
  PURCHASE_STATUS_CHANGE_TARGETS,
  SALE_STATUSES,
  SALE_STATUS_CHANGE_TARGETS,
  SEED_DATASETS,
  type BulkFormat,
  type BulkRowInput,
  type PurchaseStatus,
  type PurchaseStatusChangeTarget,
  type SaleStatus,
  type SaleStatusChangeTarget,
  type SeedDataset,
} from '@/types/erp';
import { BODY_MAX_BYTES } from './detail';
import { int, invoiceNo, list, oneOf, password, skuId, text } from './fields';

/** 04 4.2의 숫자 상한(시연용 안전선). DB CHECK와 같은 값. */
export const LIMITS = {
  money: { min: 0, max: 1_000_000_000 },
  qty: { min: 1, max: 100_000 },
  safetyStock: { min: 0, max: 100_000 },
  logLimit: { min: 1, max: 50, default: 20 },
  bulkRows: 500,
  agentLines: 100,
} as const;

/** `z.strictObject` + 필요하면 객체 단위 검사. 반환 타입은 호출부가 정한 T로 고정한다. */
function strict<T>(shape: Record<string, z.ZodType>): z.ZodType<T> {
  return z.strictObject(shape) as unknown as z.ZodType<T>;
}

// ── 품목 ──────────────────────────────────────────────────────────────

export type ItemCreateInput = {
  sku_id: string;
  item_name: string;
  unit_cost: number;
  sale_price: number;
  safety_stock: number;
  source_url: string | null;
};

/** `POST /api/items` — sku_id · item_name · unit_cost · sale_price · safety_stock · source_url? */
export const itemCreate = strict<ItemCreateInput>({
  sku_id: skuId(),
  item_name: text({ max: 100 }),
  unit_cost: int(LIMITS.money),
  sale_price: int(LIMITS.money),
  safety_stock: int(LIMITS.safetyStock),
  source_url: text({ max: 500, presence: 'optional' }),
});

export type ItemUpdateInput = Partial<Omit<ItemCreateInput, 'sku_id'>>;

/**
 * `PATCH /api/items/{sku_id}` — 위 필드 중 일부. 품목코드는 경로에 있고 바꿀 수 없다(sku_id · stock_qty는 받지 않음 → not_allowed_field).
 * 하나도 안 보내면 required(field "body"). source_url은 null(또는 빈 값)로 지울 수 있다.
 */
export const itemUpdate = z
  .strictObject({
    item_name: text({ max: 100, presence: 'partial' }),
    unit_cost: int({ ...LIMITS.money, presence: 'partial' }),
    sale_price: int({ ...LIMITS.money, presence: 'partial' }),
    safety_stock: int({ ...LIMITS.safetyStock, presence: 'partial' }),
    source_url: text({ max: 500, presence: 'partial' }),
  })
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'required', path: [] });
    }
    // 필수 칸(item_name · 숫자)에 null이 남지 않게 한다(빈 값 → required)
    for (const key of ['item_name', 'unit_cost', 'sale_price', 'safety_stock'] as const) {
      if (key in value && value[key] === null) {
        ctx.addIssue({ code: 'custom', message: 'required', path: [key] });
      }
    }
  }) as unknown as z.ZodType<ItemUpdateInput>;

// ── 구매 · 입고 ───────────────────────────────────────────────────────

export type PurchaseCreateInput = {
  sku_id: string;
  supplier: string;
  order_qty: number;
  purchase_cost: number;
  invoice_no: string | null;
};

/** `POST /api/purchases` */
export const purchaseCreate = strict<PurchaseCreateInput>({
  sku_id: skuId(),
  supplier: text({ max: 50 }),
  order_qty: int(LIMITS.qty),
  purchase_cost: int(LIMITS.money),
  invoice_no: invoiceNo(),
});

/** `POST /api/purchases/{id}/status` — to: 이동·통관중 · 품절 · 취소 */
export const purchaseStatusChange = strict<{ to: PurchaseStatusChangeTarget }>({
  to: oneOf(PURCHASE_STATUS_CHANGE_TARGETS),
});

/** `POST /api/purchases/{id}/receive` — received_qty 1 ~ 100,000. 그 구매의 order_qty 상한은 makeReceive로. */
export const receive = strict<{ received_qty: number }>({
  received_qty: int(LIMITS.qty),
});

/**
 * 입고 확정 스키마 — 상한을 그 구매의 order_qty로 좁힌다(04 4.2: 1 ~ 그 구매의 order_qty).
 * @param orderQty 구매의 order_qty (조회한 값)
 */
export function makeReceive(orderQty: number): z.ZodType<{ received_qty: number }> {
  return strict<{ received_qty: number }>({
    received_qty: int({ min: LIMITS.qty.min, max: Math.min(orderQty, LIMITS.qty.max) }),
  });
}

/** `GET /api/purchases?status=` — 상태는 선택. */
export const purchaseListQuery = strict<{ status: PurchaseStatus | null }>({
  status: oneOf(PURCHASE_STATUSES, 'optional'),
});

// ── 판매 · 출고 ───────────────────────────────────────────────────────

export type SaleCreateInput = {
  sku_id: string;
  channel: string;
  sold_qty: number;
  sale_amount: number;
  invoice_no: string | null;
};

/** `POST /api/sales` */
export const saleCreate = strict<SaleCreateInput>({
  sku_id: skuId(),
  channel: text({ max: 30 }),
  sold_qty: int(LIMITS.qty),
  sale_amount: int(LIMITS.money),
  invoice_no: invoiceNo(),
});

/** `POST /api/sales/{id}/status` — to: 출고대기 · 주문취소 */
export const saleStatusChange = strict<{ to: SaleStatusChangeTarget }>({
  to: oneOf(SALE_STATUS_CHANGE_TARGETS),
});

/** `GET /api/sales?status=` */
export const saleListQuery = strict<{ status: SaleStatus | null }>({
  status: oneOf(SALE_STATUSES, 'optional'),
});

// ── 재고 이력 ─────────────────────────────────────────────────────────

export type StockLogsQuery = { sku_id: string | null; limit: number; cursor: string | null };

/**
 * `GET /api/stock-logs?sku_id=&limit=&cursor=` — 쿼리 문자열("20")도 받는다(digitString).
 * limit 1~50, 빈 값이면 기본 20.
 */
export const stockLogsQuery = strict<StockLogsQuery>({
  sku_id: skuId('optional'),
  limit: int({ ...LIMITS.logLimit, presence: 'optional', defaultValue: LIMITS.logLimit.default, digitString: true }),
  cursor: text({ max: 200, presence: 'optional' }),
});

// ── 일괄 등록 ─────────────────────────────────────────────────────────

/** `POST /api/bulk/preview` — 행 수(최대 500) 검사는 파싱 단계(src/lib/bulk/parse.ts)가 한다. */
export const bulkPreview = strict<{ format: BulkFormat; text: string }>({
  format: oneOf(BULK_FORMATS),
  text: text({ max: BODY_MAX_BYTES }),
});

/**
 * 일괄 반영의 한 행(BulkRowInput). 거래처는 입고=supplier(1~50자), 출고=channel(1~30자) 규칙을 따른다.
 */
export const bulkRow = z
  .strictObject({
    line: int({ min: 1, max: 1_000_000 }),
    kind: oneOf(BULK_KINDS),
    sku_id: skuId(),
    qty: int(LIMITS.qty),
    partner: text({ max: 50 }),
    invoice_no: invoiceNo(),
    memo: text({ max: 200, presence: 'optional' }),
  })
  .superRefine((value, ctx) => {
    const partner = (value as { partner?: unknown; kind?: unknown }).partner;
    if (value.kind === '출고' && typeof partner === 'string' && partner.length > 30) {
      ctx.addIssue({ code: 'custom', message: 'too_long', path: ['partner'], params: { max: 30 } });
    }
  }) as unknown as z.ZodType<BulkRowInput>;

/** `POST /api/bulk/commit` — 미리보기에서 유효했던 행만. 서버가 함수에서 한 번 더 검사한다. */
export const bulkCommit = strict<{ rows: BulkRowInput[] }>({
  rows: list(bulkRow, { max: LIMITS.bulkRows }),
});

// ── 시연 데이터 ───────────────────────────────────────────────────────

/** `POST /api/seed` */
export const seedRequest = strict<{ dataset: SeedDataset }>({
  dataset: oneOf(SEED_DATASETS),
});

// ── AI 에이전트 ───────────────────────────────────────────────────────

/** `POST /api/agent/chat` — 1~500자. */
export const chatMessage = strict<{ message: string }>({
  message: text({ max: 500 }),
});

/** `POST /api/agent/draft-po` — sku_ids는 선택(없으면 품절 임박 전체). */
export const draftPoRequest = strict<{ sku_ids: string[] | null }>({
  sku_ids: list(skuId(), { max: LIMITS.agentLines, presence: 'optional' }),
});

const poConfirmLine = strict<PoConfirmLine>({
  sku_id: skuId(),
  supplier: text({ max: 50 }),
  order_qty: int(LIMITS.qty),
  purchase_cost: int(LIMITS.money),
});

/** `POST /api/agent/draft-po/confirm` — 사용자가 고친 값. 받은 내용을 처음부터 다시 검증한다(04 3.8). */
export const poConfirm = strict<{ lines: PoConfirmLine[] }>({
  lines: list(poConfirmLine, { max: LIMITS.agentLines }),
});

/** 사람이 읽는 번호(S-201 · P-101) 또는 uuid. 에이전트 액션이 어느 쪽을 쓸지 문서에 없어 둘 다 받는다. */
const REF_UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
function refId(prefix: 'S' | 'P'): z.ZodType {
  return text({ max: 50, pattern: new RegExp(`^(${prefix}-\\d{1,9}|${REF_UUID})$`) });
}

/** 허용 액션 6개(04 3.8). 목록에 없는 type은 not_allowed_value(field "action.type"). */
export const agentAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('get_stock'), sku_id: skuId() }),
  z.strictObject({ type: z.literal('list_low_stock') }),
  z.strictObject({ type: z.literal('ship_quantity'), sku_id: skuId(), qty: int(LIMITS.qty) }),
  z.strictObject({ type: z.literal('ship_sale'), sale_id: refId('S') }),
  z.strictObject({
    type: z.literal('set_sale_status'),
    sale_id: refId('S'),
    to: oneOf(SALE_STATUS_CHANGE_TARGETS),
  }),
  z.strictObject({
    type: z.literal('set_purchase_status'),
    purchase_id: refId('P'),
    to: oneOf(PURCHASE_STATUS_CHANGE_TARGETS),
  }),
]) as unknown as z.ZodType<AgentAction>;

/** `POST /api/agent/execute` */
export const agentExecute = strict<{ action: AgentAction }>({
  action: agentAction,
});

// ── 로그인 · 경로 값 ──────────────────────────────────────────────────

/** 로그인 화면 입력: 이메일 형식, 비밀번호 1자 이상(판정은 Supabase — 04 4.2). */
export const loginInput = strict<{ email: string; password: string }>({
  email: text({ max: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }),
  password: password(),
});

/** 경로의 `{id}` — uuid(04 1절). */
export const uuidParam = text({
  min: 36,
  max: 36,
  pattern: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
}) as z.ZodType<string>;

/** 경로의 `{sku_id}` — 품목코드 형식. */
export const skuParam = skuId() as z.ZodType<string>;
