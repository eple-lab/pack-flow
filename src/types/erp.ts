/**
 * ERP 공통 타입 · 상태값 · 오류 코드 상수의 원본.
 *
 * 하는 일
 * 1. 품목 · 구매 · 판매 · 재고 이력 · 대시보드 · 일괄 등록의 모양을 04 5절 그대로 정의한다.
 * 2. 상태값 · 재고 변동 사유 · 오류 코드 · 검증 사유 문자열은 여기 상수만 쓴다(코드에 직접 적지 않는다).
 * 3. 상태 전이표는 DB 함수(pf_*_transition_ok)와 같은 규칙의 사본이다. 판정은 DB가 하고,
 *    화면은 "다음으로 갈 수 있는 상태" 버튼을 고를 때만 쓴다(03 3절).
 *
 * 바꾸려면 docs/04-api-contract.md와 이 파일을 먼저 고치는 PR이 필요하다(eple 리뷰).
 *
 * 근거: docs/04-api-contract.md 2 · 3 · 4.3 · 5절, docs/03-data-model.md 2 · 3절, docs/09-features.md 3절 · WU-03
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 공통 타입 · 상태 · 전이표 · 사유 · 오류 코드 상수 (WU-03)
 */

// ── 상태값 · 사유 (09 3절) ─────────────────────────────────────────────

/** 구매 상태. 한글 그대로 저장 · 표시한다(영어 별칭 금지). */
export const PURCHASE_STATUSES = [
  '발주완료',
  '이동·통관중',
  '입고완료',
  '입고취소',
  '품절',
  '취소',
] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

/** 판매(출고) 상태. */
export const SALE_STATUSES = [
  '주문접수',
  '출고대기',
  '출고완료',
  '출고취소',
  '주문취소',
] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

/** 구매 상태 전이표(03 3절). 키 = 지금 상태, 값 = 갈 수 있는 상태. 끝 상태는 빈 배열. */
export const PURCHASE_TRANSITIONS: Record<PurchaseStatus, readonly PurchaseStatus[]> = {
  발주완료: ['이동·통관중', '입고완료', '품절', '취소'],
  '이동·통관중': ['입고완료', '취소'],
  입고완료: ['입고취소'],
  입고취소: [],
  품절: [],
  취소: [],
};

/** 판매 상태 전이표(03 3절). */
export const SALE_TRANSITIONS: Record<SaleStatus, readonly SaleStatus[]> = {
  주문접수: ['출고대기', '주문취소'],
  출고대기: ['출고완료', '주문취소'],
  출고완료: ['출고취소'],
  출고취소: [],
  주문취소: [],
};

/** `POST /api/purchases/{id}/status`의 `to`가 받는 값(04 3.3). 입고 · 입고취소는 전용 라우트로만 바꾼다. */
export const PURCHASE_STATUS_CHANGE_TARGETS = ['이동·통관중', '품절', '취소'] as const;
export type PurchaseStatusChangeTarget = (typeof PURCHASE_STATUS_CHANGE_TARGETS)[number];

/** `POST /api/sales/{id}/status`의 `to`가 받는 값(04 3.4). */
export const SALE_STATUS_CHANGE_TARGETS = ['출고대기', '주문취소'] as const;
export type SaleStatusChangeTarget = (typeof SALE_STATUS_CHANGE_TARGETS)[number];

/** `stock_logs.reason` 재고 변동 사유(03 2절). */
export const STOCK_REASONS = ['구매입고', '실판매출고', '입고취소', '출고취소', '재고조정'] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

/** `stock_logs.ref_type`. */
export const STOCK_REF_TYPES = ['purchase', 'sale', 'seed'] as const;
export type StockRefType = (typeof STOCK_REF_TYPES)[number];

/** 구매 · 판매 `source` 컬럼 — 어디서 만들어졌나(09 3절). */
export const DATA_SOURCES = ['form', 'bulk', 'agent', 'seed'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

/** 시드 데이터 종류(04 3.7). */
export const SEED_DATASETS = ['demo', 'small', 'large'] as const;
export type SeedDataset = (typeof SEED_DATASETS)[number];

// ── 오류 코드 (04 2절) ────────────────────────────────────────────────

/** 서버가 돌려주는 오류 코드. HTTP 상태 · 문구는 src/lib/api/errors.ts. */
export const SERVER_ERROR_CODES = [
  'PF_UNAUTHENTICATED',
  'PF_CSRF',
  'PF_NOT_FOUND',
  'PF_VALIDATION',
  'PF_INVALID_TRANSITION',
  'PF_INSUFFICIENT_STOCK',
  'PF_DUPLICATE_INVOICE',
  'PF_DUPLICATE_SKU',
  'PF_QUOTA_EXCEEDED',
  'PF_LLM_UNAVAILABLE',
  'PF_NOT_IMPLEMENTED',
  'PF_INTERNAL',
] as const;
export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];

/** 화면 전용 코드 — 서버에 닿지 못함 / 15초 안에 응답 없음. api-client가 만든다. */
export const CLIENT_ERROR_CODES = ['PF_NETWORK', 'PF_TIMEOUT'] as const;

export type PfErrorCode = ServerErrorCode | (typeof CLIENT_ERROR_CODES)[number];

/** `PF_VALIDATION`의 `reason` 목록(04 4.3). */
export const VALIDATION_REASONS = [
  'required',
  'too_long',
  'out_of_range',
  'not_integer',
  'bad_format',
  'not_allowed_value',
  'not_allowed_field',
] as const;
export type ValidationReason = (typeof VALIDATION_REASONS)[number];

/** `PF_VALIDATION`의 `detail` (04 2절). */
export type ValidationDetail = {
  field: string;
  reason: ValidationReason;
  min?: number;
  max?: number;
};

/** 오류 응답 본문 `{ error: {...} }`(04 1절). `detail`은 코드마다 다르다(04 2절). */
export type ApiErrorBody = {
  error: {
    code: PfErrorCode;
    message: string;
    detail?: Record<string, unknown>;
  };
};

/** 성공 응답 본문 `{ data }`. */
export type ApiSuccessBody<T> = { data: T };

// ── 테이블 모양 (03 2절 · 04 3절 응답) ─────────────────────────────────

/** 품목 + 재고. `stock_qty`는 DB 함수만 바꾼다. `below_safety` = 재고가 안전재고보다 적음. */
export type Item = {
  id: string;
  sku_id: string;
  item_name: string;
  source_url: string | null;
  unit_cost: number;
  sale_price: number;
  stock_qty: number;
  safety_stock: number;
  below_safety: boolean;
  created_at: string;
  updated_at: string;
};

/** 구매 · 입고 한 건. `purchase_id`는 사람이 읽는 번호(P-101), `id`는 경로용 uuid. */
export type Purchase = {
  id: string;
  purchase_id: string;
  sku_id: string;
  supplier: string;
  order_qty: number;
  received_qty: number | null;
  purchase_cost: number;
  status: PurchaseStatus;
  invoice_no: string | null;
  source: DataSource;
  received_at: string | null;
  created_at: string;
  updated_at: string;
};

/** 판매 · 출고 한 건. `sale_id`는 사람이 읽는 번호(S-201). */
export type Sale = {
  id: string;
  sale_id: string;
  sku_id: string;
  channel: string;
  sold_qty: number;
  sale_amount: number;
  fulfillment_status: SaleStatus;
  invoice_no: string | null;
  source: DataSource;
  shipped_at: string | null;
  created_at: string;
  updated_at: string;
};

/** 재고 원장 한 줄(추가만 한다). 입고 +, 출고 −. */
export type StockLog = {
  log_id: number;
  sku_id: string;
  change_qty: number;
  reason: StockReason;
  ref_type: StockRefType;
  ref_id: string;
  created_at: string;
};

/** `GET /api/stock-logs`의 응답(키셋 페이지네이션). */
export type StockLogPage = { rows: StockLog[]; next_cursor: string | null };

/** 입고 · 출고 확정 · 취소의 응답에 들어가는 새 재고. */
export type PurchaseWithStock = { purchase: Purchase; stock_qty: number };
export type SaleWithStock = { sale: Sale; stock_qty: number };

/** `GET /api/dashboard`의 응답(04 3.5). */
export type Dashboard = {
  kpi: {
    item_count: number;
    stock_total: number;
    below_safety: number;
    today_in: number;
    today_out: number;
  };
  pipeline: {
    purchase: Record<PurchaseStatus, number>;
    sale: Record<SaleStatus, number>;
  };
  items: Array<Item & { below_safety: boolean }>;
  alerts: Array<{ sku_id: string; item_name: string; stock_qty: number; safety_stock: number }>;
  recent_changes: StockLog[];
};

/** `POST /api/seed`의 응답 — 넣은 건수. */
export type SeedResult = { items: number; purchases: number; sales: number; logs: number };

// ── 일괄 등록 (04 3.6) ────────────────────────────────────────────────

/** 일괄 등록의 구분 값. */
export const BULK_KINDS = ['입고', '출고'] as const;
export type BulkKind = (typeof BULK_KINDS)[number];

/** 일괄 등록 형식. */
export const BULK_FORMATS = ['tsv', 'csv'] as const;
export type BulkFormat = (typeof BULK_FORMATS)[number];

/** 미리보기 오류 사유 문구(04 3.6). 파싱(jkspawn)과 서버가 같은 문구를 쓴다. */
export const BULK_ERROR_REASONS = [
  '미등록 품목코드',
  '수량이 0 이하',
  '구분 값 오류',
  '열 개수 오류',
  '같은 붙여넣기 안 송장번호 중복',
  '이미 등록된 송장번호',
  '출고 수량이 재고보다 많음(미리보기 시점 기준)',
] as const;
export type BulkErrorReason = (typeof BULK_ERROR_REASONS)[number];

/** 일괄 반영(`/api/bulk/commit`)에 보내는 한 행. 열 순서: 구분, 품목코드, 수량, 거래처, 송장번호, 비고. */
export type BulkRowInput = {
  line: number;
  kind: BulkKind;
  sku_id: string;
  qty: number;
  partner: string;
  invoice_no: string | null;
  memo: string | null;
};

/** 미리보기 한 행. 잘못된 행은 값이 원본 그대로일 수 있어 느슨하게 둔다(`valid=false`, `errors` 채움). */
export type BulkRow = {
  line: number;
  kind: string;
  sku_id: string;
  qty: number | null;
  partner: string;
  invoice_no: string | null;
  memo: string | null;
  valid: boolean;
  errors: BulkErrorReason[];
};

/** 반영하지 못한 행과 사유. */
export type BulkSkippedRow = { line: number; code: PfErrorCode; message: string };

export type BulkPreviewResult = { rows: BulkRow[] };
export type BulkCommitResult = { applied: number; skipped: BulkSkippedRow[] };
