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
| `PF_VALIDATION` | 400 | 입력 형식 · 범위 오류, JSON이 아닌 본문, 받지 않는 필드 | `{ field, reason, min?, max? }` — `reason`은 4.3절 목록 |
| `PF_INVALID_TRANSITION` | 409 | 전이표에 없는 상태 변경 | `{ from, to, allowed: [] }` |
| `PF_INSUFFICIENT_STOCK` | 409 | 재고보다 많이 출고 · 입고취소 | `{ sku_id, stock_qty, requested }` |
| `PF_DUPLICATE_INVOICE` | 409 | 같은 송장번호 | `{ invoice_no }` |
| `PF_DUPLICATE_SKU` | 409 | 같은 품목코드 | `{ sku_id }` |
| `PF_QUOTA_EXCEEDED` | 429 | LLM 호출 상한 초과 (P-09) | `{ scope: "user" \| "global" }` |
| `PF_LLM_UNAVAILABLE` | 503 | LLM 오류 · 시간 초과 | `{ provider }` |
| `PF_NOT_IMPLEMENTED` | 501 | 아직 구현 전(stub) | — |
| `PF_INTERNAL` | 500 | 예상하지 못한 서버 오류 (원문은 서버 로그에만) | — |
| `PF_NETWORK` · `PF_TIMEOUT` | — | **화면 전용.** 서버에 닿지 못함 / 15초 안에 응답 없음 (`api-client`가 만든다) | — |

화면에 보일 문구는 4.4절이 원본이다.

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

## 4. 입력 규칙 · 빈 값 · 오류 문구

화면 · 서버 · DB 함수 · 에이전트가 **같은 기준**으로 검사한다. 원본 코드는 `src/lib/validation/`(eple 소유, zod 스키마) 하나이고, 화면 폼과 API 라우트가 같은 스키마를 가져다 쓴다. DB 함수와 테이블 CHECK는 같은 범위를 한 번 더 막는다(여러 겹 방어 — [05](05-security.md) 3절).

### 4.1 공통 정규화 (검사 전에 먼저)

| 규칙 | 내용 |
|---|---|
| 공백 | 모든 문자열은 앞뒤 공백을 지운다 |
| 빈 값 | 지운 뒤 빈 문자열이면 **선택 칸은 `null`**, 필수 칸은 `required` 오류. 서버 · DB에는 빈 문자열 `""`이 저장되지 않는다 |
| 숫자 | API는 JSON 숫자만 받는다(문자열 `"10"`은 `not_integer`). 화면은 입력의 쉼표 · 공백을 지우고 숫자로 바꿔 보낸다. 소수 · 지수 표기는 `not_integer` |
| 대소문자 | 품목코드는 화면에서 대문자로 바꿔 보낸다. 서버는 대문자 형식만 받는다 |
| 받지 않는 필드 | 계약에 없는 필드(`user_id`, `stock_qty`, `id` 등)가 오면 무시하지 않고 `not_allowed_field`로 거부(strict) |
| 본문 | JSON이 아니거나 100KB 초과면 `PF_VALIDATION`(`field: "body"`) |

### 4.2 필드 규칙

| 필드 | 쓰는 곳 | 필수 | 규칙 | 빈 값 |
|---|---|---|---|---|
| `sku_id` | 품목 · 구매 · 판매 · 일괄 | 필수 | 영문 대문자 · 숫자 · 하이픈 3~20자, 영문 또는 숫자로 시작 (예 `PRD-001`) | `required` |
| `item_name` | 품목 | 필수 | 1~100자 | `required` |
| `unit_cost`, `sale_price` | 품목 | 필수 | 정수 0 ~ 1,000,000,000 | `required` |
| `safety_stock` | 품목 | 필수 | 정수 0 ~ 100,000 | `required` |
| `source_url` | 품목 | 선택 | 500자 이하, 글자로만 표시 | `null` |
| `supplier` | 구매 | 필수 | 1~50자 | `required` (발주서 초안은 서버가 "미지정"을 채움) |
| `order_qty` | 구매 | 필수 | 정수 1 ~ 100,000 | `required` |
| `purchase_cost` | 구매 | 필수 | 정수 0 ~ 1,000,000,000 | `required` |
| `received_qty` | 입고 확정 | 필수 | 정수 1 ~ 그 구매의 `order_qty` | `required` |
| `channel` | 판매 | 필수 | 1~30자 | `required` |
| `sold_qty` | 판매 | 필수 | 정수 1 ~ 100,000 | `required` |
| `sale_amount` | 판매 | 필수 | 정수 0 ~ 1,000,000,000 | `required` |
| `invoice_no` | 구매 · 판매 · 일괄 | 선택 | 1~50자, 영문 · 숫자 · `-` · `_` | **`null` — `null`끼리는 중복이 아니다** |
| `memo` | 일괄 | 선택 | 200자 이하 | `null` |
| `kind` | 일괄 | 필수 | `입고` · `출고` | `required` |
| `to` | 상태 변경 | 필수 | 그 라우트가 받는 상태값만 | `required` |
| `message` | 챗봇 | 필수 | 1~500자 | `required` |
| `limit` · `cursor` | 이력 | 선택 | `limit` 정수 1~50(기본 20), `cursor` 200자 이하 불투명 문자열 | 기본값 |
| `dataset` | 시드 | 필수 | `demo` · `small` · `large` | `required` |
| 로그인 이메일 · 비밀번호 | 로그인 | 필수 | 이메일 형식, 비밀번호 1자 이상(판정은 Supabase) | 화면에서 막음 |

상한(10만 개, 10억 원)은 시연용 안전선이다. 정수 넘침과 입력 실수(0 하나 더)를 막는다.

### 4.3 `PF_VALIDATION`의 `reason` 목록

| `reason` | 뜻 | 칸 아래 문구 |
|---|---|---|
| `required` | 비었음 | 필수 항목이에요 |
| `too_long` | 글자 수 초과 | {max}자 이하로 입력해 주세요 |
| `out_of_range` | 범위 밖 | {min} ~ {max} 사이로 입력해 주세요 |
| `not_integer` | 정수가 아님 | 숫자(정수)로 입력해 주세요 |
| `bad_format` | 형식 오류 | 형식이 맞지 않아요 (예: PRD-001) |
| `not_allowed_value` | 허용 값이 아님 | 선택할 수 있는 값이 아니에요 |
| `not_allowed_field` | 계약에 없는 필드 | 보낼 수 없는 항목이에요 (화면 버그 — 배너로) |

### 4.4 오류 문구 (화면에 보이는 말)

`src/lib/api/errors.ts`(서버)와 `src/lib/api-client.ts`(화면)가 이 표의 문구를 쓴다. `{ }`는 `detail` 값.

| 코드 | 문구 | 어디에 |
|---|---|---|
| `PF_UNAUTHENTICATED` | 로그인이 필요해요. 다시 로그인해 주세요 | 배너 없이 `/login?next=<지금 경로>`로 보낸다. 로그인 뒤 돌아온다 |
| `PF_CSRF` | 요청을 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요 | 배너 |
| `PF_NOT_FOUND` | 찾을 수 없어요. 목록을 새로고침해 주세요 | 배너 |
| `PF_VALIDATION` | 입력값을 확인해 주세요 | `field`가 폼 칸이면 **그 칸 아래**(4.3 문구), 아니면 배너 |
| `PF_INVALID_TRANSITION` | 지금 상태({from})에서는 {to}(으)로 바꿀 수 없어요 | 배너 + 목록 새로고침 |
| `PF_INSUFFICIENT_STOCK` | 재고가 부족해요. {sku_id} 남은 수량 {stock_qty}개 | 배너 (출고 · 입고 취소) |
| `PF_DUPLICATE_INVOICE` | 이미 등록된 송장번호예요 ({invoice_no}) | 송장번호 칸 아래 |
| `PF_DUPLICATE_SKU` | 이미 있는 품목코드예요 ({sku_id}) | 품목코드 칸 아래 |
| `PF_QUOTA_EXCEEDED` | 오늘 AI 사용 한도를 다 썼어요. 한국 시간 오후 5시 이후 다시 쓸 수 있어요 | 에이전트 패널 |
| `PF_LLM_UNAVAILABLE` | AI가 지금 응답하지 않아요. 잠시 뒤 다시 시도해 주세요 (입출고는 그대로 쓸 수 있어요) | 에이전트 패널 |
| `PF_NOT_IMPLEMENTED` | 아직 준비 중인 기능이에요 | 배너 |
| `PF_INTERNAL` | 잠시 문제가 생겼어요. 다시 시도해 주세요 | 배너 |
| `PF_NETWORK` | 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요 | 배너 + [다시 시도] |
| `PF_TIMEOUT` | 응답이 늦어요. 잠시 뒤 다시 시도해 주세요 (배포 서버가 깨어나는 중일 수 있어요) | 배너 + [다시 시도] |

### 4.5 응답의 빈 값을 화면에 보이는 법

| 값 | 언제 비나 | 화면 |
|---|---|---|
| `received_qty`, `received_at`, `shipped_at`, `invoice_no` | 입고 · 출고 전, 송장 없음 | `—` |
| `source_url` | 메모 없음 | 칸을 비움 |
| `supplier` = `"미지정"` | 발주 초안에서 최근 거래처 없음 | 그대로 + 수정 가능 |
| `PoDraft.message` = `null` | LLM 실패 · 상한 | `PF_LLM_UNAVAILABLE` · `PF_QUOTA_EXCEEDED` 문구, 표는 그대로 |
| `next_cursor` = `null` | 마지막 페이지 | [더 보기] 숨김 |
| 빈 배열 | 목록 · 검색 결과 없음 | `EmptyState` (검색이면 "'{검색어}'에 맞는 품목이 없어요") |

### 4.6 화면 공통 처리 (모든 화면 · 패널)

| 규칙 | 내용 | 만드는 곳 |
|---|---|---|
| 알림 방식 | 브라우저 기본 `alert()` · `confirm()` · `prompt()` 금지. 확인은 `ConfirmDialog`, 성공은 `Toast`, 실패는 `ErrorBanner` · `FieldError` | eple `common/` |
| 칸 아래 오류 | `FieldError`가 칸 아래 빨간 글씨로. 화면 검증(같은 스키마)으로 보내기 전에 먼저 보여 주고, 서버가 같은 이유로 거부해도 같은 자리에 | eple `common/` · `validation/` |
| 저장 버튼 잠금 | 모든 저장 · 실행 버튼은 요청 중 잠그고 "처리 중…" 표시(두 번 눌러도 한 번) | eple `common/SubmitButton` |
| 시간 초과 | `api-client`가 15초 뒤 `PF_TIMEOUT`. LLM 라우트는 서버 쪽 20초(WU-31) | eple `api-client` |
| 세션 만료 | 어느 요청이든 401이면 `/login?next=` | eple `api-client` · proxy |
| 숫자 · 금액 표시 | 천 단위 쉼표 `12,000`, 금액 칸 머리글에 "(원)". 증감은 `+8` · `−6` | eple `src/lib/format.ts` |
| 날짜 · 시각 표시 | 한국 시간. 목록 `11/24 14:05`, 올해가 아니면 `2025-11-24`. 마우스를 올리면 전체 `2026-11-24 14:05:09` | eple `src/lib/format.ts` · `time.ts` |
| 폼 초기화 | 저장 성공 뒤 폼을 비우고 첫 칸에 커서. 실패하면 입력값 유지 | 각 화면 |

## 5. 타입 원본

`src/types/erp.ts` (eple 소유)에 `Item`, `Purchase`, `Sale`, `StockLog`, `PurchaseStatus`, `SaleStatus`, `StockReason`, `PfErrorCode`, `Dashboard`, `BulkRow*`를 둔다. 에이전트 전용 타입(`PoDraft`, `AgentAction`, `ChatReply`)은 `src/types/agent.ts` (eple 소유 — 파트 간 계약이라 바꾸려면 PR, skygaul 리뷰)에 둔다. 서버 전용 값(키 · 서비스 설정)은 `src/lib/env.ts`로만 읽는다. 상태값 문자열은 이 파일의 상수만 쓰고, 코드에 직접 적지 않는다.
