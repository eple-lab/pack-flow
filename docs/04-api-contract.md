# 04. API 계약

작성일: 2026-11-20 · 화면(jkspawn) · 서버(eple) · DB 함수(sorek-charlie) · 에이전트(skygaul)가 **함께 지키는 약속**이다.

- 한쪽만 바꾸지 않는다. 바꿔야 하면 **이 문서와 `src/types/erp.ts`를 먼저 고치는 PR**(eple 리뷰)을 올리고, 병합된 뒤 양쪽 코드를 고친다.
- Wave 0에서 eple이 모든 라우트를 **이 모양 그대로 돌려주는 자리(stub)**로 만든다. 아직 구현이 없으면 `501 NOT_IMPLEMENTED`. 그래서 화면 · 에이전트는 첫날부터 이 계약을 기준으로 만들 수 있다.
- 화면 개발용 목(mock) 응답은 `src/lib/mock/`에 같은 타입으로 둔다(환경변수 `NEXT_PUBLIC_USE_MOCK=1`). 목과 `src/lib/api-client.ts`는 계약을 비춘 것이라 eple 소유다.

## 1. 공통 규칙

| 항목 | 규칙 |
|---|---|
| 인증 | Supabase 세션 쿠키(`@supabase/ssr`). 화면은 `fetch(..., { credentials: 'same-origin' })` |
| 미로그인 | 화면 경로는 `/login`으로 보냄, `/api/**`는 401 |
| 변경 요청 | GET 외에는 헤더 `X-PF: 1` 필수, 서버가 `Origin`이 자기 주소인지 확인 (P-18) |
| 본문 | JSON만. 일괄 등록도 텍스트를 JSON 문자열로 보낸다 |
| 성공 | 200(조회 · 변경) / 201(생성). 본문은 `{ "data": ... }` |
| 오류 | `{ "error": { "code": "PF_...", "message": "한국어 안내", "detail": { } } }`. 화면은 `message`만 보여 준다 |
| 남의 리소스 | 404 `PF_NOT_FOUND` (P-07) |
| 날짜 | ISO 8601 문자열. '오늘'은 `Asia/Seoul` 기준 |
| ID | 경로의 `{id}`는 uuid(`id` 컬럼). 화면 표시는 `purchase_id` · `sale_id` |

## 2. 오류 코드

| 코드 | HTTP | 언제 | `detail` |
|---|---|---|---|
| `PF_UNAUTHENTICATED` | 401 | 로그인 안 함 | — |
| `PF_CSRF` | 403 | `X-PF` 없음 또는 다른 Origin | — |
| `PF_NOT_FOUND` | 404 | 없음 또는 남의 것 | — |
| `PF_VALIDATION` | 400 | 입력 형식 · 범위 오류 | `{ field, reason }` |
| `PF_INVALID_TRANSITION` | 409 | 전이표에 없는 상태 변경 | `{ from, to, allowed: [] }` |
| `PF_INSUFFICIENT_STOCK` | 409 | 재고보다 많이 출고 · 입고취소 | `{ sku_id, stock_qty, requested }` |
| `PF_DUPLICATE_INVOICE` | 409 | 같은 송장번호 | `{ invoice_no }` |
| `PF_DUPLICATE_SKU` | 409 | 같은 품목코드 | `{ sku_id }` |
| `PF_QUOTA_EXCEEDED` | 429 | LLM 호출 상한 초과 (P-09) | `{ scope: "user" \| "global" }` |
| `PF_LLM_UNAVAILABLE` | 503 | LLM 오류 · 시간 초과 | `{ provider }` |
| `PF_NOT_IMPLEMENTED` | 501 | 아직 구현 전(stub) | — |

## 3. 라우트

담당은 **라우트 파일의 주인**이다. 라우트 안에서 부르는 DB 함수의 주인은 [03](03-data-model.md) 4절.

### 3.1 상태 · 인증

| 메서드 · 경로 | 요청 | 응답 `data` | 담당 |
|---|---|---|---|
| `GET /api/health` | — | `{ status: "ok", db: "ok" \| "down", llm: "gemini" \| "ollama" }` | eple |
| `GET /api/me` | — | `{ email, user_id }` | eple |

로그인 · 로그아웃은 Supabase Auth를 화면에서 직접 쓴다(`/login` 페이지, eple).

### 3.2 품목

| 메서드 · 경로 | 요청 | 응답 `data` | 담당 |
|---|---|---|---|
| `GET /api/items` | — | `Item[]` (재고 · 안전재고 · `below_safety` 포함) | eple |
| `POST /api/items` | `{ sku_id, item_name, unit_cost, sale_price, safety_stock, source_url? }` | `Item` (DB 함수 `pf_create_item`) | eple |
| `PATCH /api/items/{sku_id}` | 위 필드 중 일부 (`stock_qty`는 받지 않음 → 400) | `Item` | eple |

### 3.3 구매 · 입고

| 메서드 · 경로 | 요청 | 응답 `data` | DB 함수 |
|---|---|---|---|
| `GET /api/purchases?status=` | — | `Purchase[]` (최근순) | 조회 |
| `POST /api/purchases` | `{ sku_id, supplier, order_qty, purchase_cost, invoice_no? }` | `Purchase` | `pf_create_purchase` |
| `POST /api/purchases/{id}/status` | `{ to: "이동·통관중" \| "품절" \| "취소" }` | `Purchase` | `pf_set_purchase_status` |
| `POST /api/purchases/{id}/receive` | `{ received_qty }` | `{ purchase: Purchase, stock_qty }` | `pf_receive_purchase` |
| `POST /api/purchases/{id}/cancel-receipt` | — | `{ purchase, stock_qty }` | `pf_cancel_receipt` |

라우트 담당: eple.

### 3.4 판매 · 출고

| 메서드 · 경로 | 요청 | 응답 `data` | DB 함수 |
|---|---|---|---|
| `GET /api/sales?status=` | — | `Sale[]` | 조회 |
| `POST /api/sales` | `{ sku_id, channel, sold_qty, sale_amount, invoice_no? }` | `Sale` | `pf_create_sale` |
| `POST /api/sales/{id}/status` | `{ to: "출고대기" \| "주문취소" }` | `Sale` | `pf_set_sale_status` |
| `POST /api/sales/{id}/ship` | — | `{ sale: Sale, stock_qty }` | `pf_ship_sale` |
| `POST /api/sales/{id}/cancel-shipment` | — | `{ sale, stock_qty }` | `pf_cancel_shipment` |

라우트 담당: eple.

### 3.5 재고 이력 · 대시보드

| 메서드 · 경로 | 요청 | 응답 `data` | 담당 |
|---|---|---|---|
| `GET /api/stock-logs?sku_id=&limit=20&cursor=` | `limit` 1~50, 기본 20 | `{ rows: StockLog[], next_cursor: string \| null }` (최근순, 키셋 페이지네이션) | eple |
| `GET /api/dashboard` | — | `Dashboard` (아래) | eple |

```ts
type Dashboard = {
  kpi: {
    item_count: number;        // 전체 품목 수
    stock_total: number;       // 재고 합계
    below_safety: number;      // stock_qty < safety_stock 품목 수
    today_in: number;          // 오늘 입고완료 건수 (Asia/Seoul)
    today_out: number;         // 오늘 출고완료 건수
  };
  pipeline: {                  // 상태별 건수
    purchase: Record<PurchaseStatus, number>;
    sale: Record<SaleStatus, number>;
  };
  items: Array<Item & { below_safety: boolean }>;
  alerts: Array<{ sku_id: string; item_name: string; stock_qty: number; safety_stock: number }>; // 품절 임박 카드
  recent_changes: StockLog[];  // 최근 5건
};
```

### 3.6 일괄 등록

미리보기는 **저장하지 않는다.** 반영은 미리보기에서 유효했던 행만 다시 보내고, 서버가 함수에서 한 번 더 검사한다.

| 메서드 · 경로 | 요청 | 응답 `data` | 담당 |
|---|---|---|---|
| `POST /api/bulk/preview` | `{ format: "tsv" \| "csv", text: string }` (최대 500행) | `{ rows: BulkRow[] }` 행마다 `valid`, `errors[]` | eple(라우트) · 파싱 함수 `src/lib/bulk/parse.ts`는 jkspawn |
| `POST /api/bulk/commit` | `{ rows: BulkRowInput[] }` | `{ applied: number, skipped: Array<{ line, code, message }> }` | eple → `pf_bulk_apply` |

```ts
type BulkRowInput = {
  line: number;                 // 붙여넣은 원본의 줄 번호 (사유 표시용)
  kind: "입고" | "출고";
  sku_id: string;
  qty: number;                  // > 0
  partner: string;              // 거래처 (입고=supplier, 출고=channel)
  invoice_no: string | null;
  memo: string | null;
};
```

열 순서는 계획서 템플릿: `구분, 품목코드, 수량, 거래처, 송장번호, 비고`. 첫 줄이 이 머리글이면 건너뛴다.

미리보기 오류 사유: `미등록 품목코드`, `수량이 0 이하`, `구분 값 오류`, `열 개수 오류`, `같은 붙여넣기 안 송장번호 중복`, `이미 등록된 송장번호`, `출고 수량이 재고보다 많음(미리보기 시점 기준)`.

### 3.7 시연 데이터

| 메서드 · 경로 | 요청 | 응답 `data` | 담당 |
|---|---|---|---|
| `POST /api/seed` | `{ dataset: "demo" \| "small" \| "large" }` | `{ items, purchases, sales, logs }` 건수 | eple(라우트 · `pf_reset_and_seed`), 시드 데이터는 sorek-charlie |

**로그인한 사용자 본인의 데이터만** 지우고 다시 넣는다. 화면에서는 확인 창을 한 번 띄운다.

### 3.8 AI 에이전트 (skygaul)

원칙: **계산은 코드, 초안은 AI, 실행은 사람.** LLM 응답으로 DB를 바로 바꾸는 라우트는 없다. 실행 라우트는 사람이 [확인]을 누른 뒤에만 불리고, 받은 내용을 **처음부터 다시 검증**한다.

| 메서드 · 경로 | 요청 | 응답 `data` | 쓰기 |
|---|---|---|---|
| `POST /api/agent/draft-po` | `{ sku_ids?: string[] }` (없으면 품절 임박 전체) | `PoDraft` | 없음 |
| `POST /api/agent/draft-po/confirm` | `{ lines: Array<{ sku_id, supplier, order_qty, purchase_cost }> }` (사용자가 고친 값) | `{ purchases: Purchase[] }` | `pf_create_purchase` (`source: "agent"`) |
| `POST /api/agent/chat` | `{ message: string }` (500자까지) | `ChatReply` | 없음 |
| `POST /api/agent/execute` | `{ action: AgentAction }` | `{ result }` | 허용 액션의 함수 |

```ts
type PoDraft = {
  lines: Array<{
    sku_id: string; item_name: string;
    stock_qty: number; safety_stock: number;
    recommended_qty: number;     // 코드가 계산 (src/lib/agent/reorder.ts)
    unit_cost: number;           // items.unit_cost
    supplier: string;            // 최근 구매의 거래처, 없으면 "미지정"
    basis: string;               // 계산 근거 문장 (코드가 만든 것)
  }>;
  message: string | null;        // LLM이 쓴 발주서 문안. LLM 실패면 null (P-08)
  llm_error: { code: string; message: string } | null;
  provider: "gemini" | "ollama";
};

type AgentAction =
  | { type: "get_stock"; sku_id: string }
  | { type: "list_low_stock" }
  | { type: "ship_quantity"; sku_id: string; qty: number }            // 새 판매(직접출고) 후 출고 (P-14)
  | { type: "ship_sale"; sale_id: string }                            // 기존 주문 출고
  | { type: "set_sale_status"; sale_id: string; to: "출고대기" | "주문취소" }
  | { type: "set_purchase_status"; purchase_id: string; to: "이동·통관중" | "품절" | "취소" };

type ChatReply = {
  reply: string;                  // 사용자에게 보일 문장. 수치는 서버 조회 결과에서만
  facts: Record<string, number>;  // reply에 들어간 수치의 출처 (예: { "PRD-001.stock_qty": 4 })
  proposed_action: AgentAction | null;   // 변경 액션이면 화면이 [확인]/[취소]를 띄운다
  needs_confirmation: boolean;    // 조회 액션은 false (바로 결과를 reply에 담음)
  refused: { reason: string } | null;    // 허용 밖 요청 · 재고 부족 등
};
```

- 허용 액션은 위 6개뿐이다. LLM이 다른 `type`을 내면 `refused`로 바꾼다.
- `ship_quantity`의 수량이 재고보다 많으면 `chat` 단계에서 이미 `refused`(남은 수량 안내)로 답하고, `execute`에서도 DB 함수가 다시 막는다(이중 확인).
- `sku_id`는 LLM이 지은 값을 믿지 않는다. 서버가 사용자의 품목 목록에서 이름 · 코드로 다시 찾고, 없으면 `refused`.
- LLM 호출 전 `pf_llm_take()`로 상한을 확인한다. 넘으면 429.

## 4. 타입 원본

`src/types/erp.ts` (eple 소유)에 `Item`, `Purchase`, `Sale`, `StockLog`, `PurchaseStatus`, `SaleStatus`, `StockReason`, `PfErrorCode`, `Dashboard`, `BulkRow*`를 둔다. 에이전트 전용 타입(`PoDraft`, `AgentAction`, `ChatReply`)은 `src/types/agent.ts` (eple 소유 — 파트 간 계약이라 바꾸려면 PR, skygaul 리뷰)에 둔다. 서버 전용 값(키 · 서비스 설정)은 `src/lib/env.ts`로만 읽는다. 상태값 문자열은 이 파일의 상수만 쓰고, 코드에 직접 적지 않는다.
