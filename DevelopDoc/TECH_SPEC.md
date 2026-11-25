# PackFlow 기술 명세 (TECH_SPEC)

작성일: 2026-11-23 · 근거: [01 아키텍처](../docs/01-enterprise-architecture.md) · [03 데이터 모델](../docs/03-data-model.md) · [04 API 계약](../docs/04-api-contract.md) · [05 보안](../docs/05-security.md), 계획서 6~9절 · 상태: **초안 — 11/25 최종 점검에서 갱신** · 11/24 밤 사실 대조 반영(5 · 6 · 7 · 8 · 9절)

원본은 `docs/`이고 이 문서는 요약이다. 코드와 다르면 코드 · 원본 문서가 맞다. 정확한 컬럼 · 정규식 · 문구는 각 원본 링크를 본다.

## 1. 기술 스택 · 환경

| 영역 | 선택 | 근거 |
|---|---|---|
| 웹 · API | Next.js 16(App Router) + React + TypeScript strict, Node 24, npm. 로그인 확인 파일은 `src/proxy.ts`(D-30) | D-03 |
| DB · 인증 | Supabase(Postgres · Auth · RLS). 프로젝트 2개: dev(개발 · 테스트) / demo(시연) | D-11 |
| LLM | 배포 Gemini 무료 티어 / 개발 각자 PC의 Ollama, `LLM_PROVIDER`로 전환 | D-06 |
| 배포 | Render Web Service 2개: dev · 시연(D-37, `render.yaml` · `render.demo.yaml`) | 계획서 8절 |
| 스타일 | CSS 모듈 + 토큰(D-31). Tailwind 등 미사용 | D-31 |
| 테스트 | Vitest(단위 · DB · API), Playwright(E2E) | [07](../docs/07-test-strategy.md) |
| CI | GitHub Actions(`secret-check` · lint · typecheck · unit) | P-11 |
| DB 변경 관리 | `supabase/migrations/*.sql` 저장소 관리 | P-06 |

## 2. 아키텍처 (4층 요약)

| 층 | PackFlow의 답 |
|---|---|
| 비즈니스 | 판매자 1인이 구매 · 입고 · 판매 · 출고를 한곳에서 처리하고, 재고가 언제 왜 바뀌었는지 설명할 수 있다 |
| 애플리케이션 | 품목 · 구매/입고 · 판매/출고 · 재고 원장 · 일괄 등록 · 대시보드 · AI 에이전트 · 인증 · 시연 데이터 |
| 데이터 | 4테이블 + LLM 사용량, 모두 Supabase, 사용자별 격리(RLS). 재고는 DB 함수만 바꾼다 |
| 기술 | Next.js(Render) · Supabase 2개 · Gemini/Ollama · GitHub + Actions |

```text
브라우저(Next.js 화면)
  -> proxy(로그인 확인) -> API 라우트 /api/** (입력 검증 · 오류 형식 · CSRF)
      -> 사용자 JWT로 Supabase rpc(pf_*) -> 재고 함수(전이 검사 · 재고 · 이력, 한 트랜잭션) -> RLS 테이블
      -> 에이전트(후보 계산 · 허용 액션 검사) -> lib/llm.ts -> Gemini(배포) / Ollama(개발)
         (확인 뒤에만 rpc(pf_*))
```

구성도(mermaid)와 요청 흐름 전체는 [01 3절](../docs/01-enterprise-architecture.md). 화면 폼 · 일괄 등록 · 챗봇이 **모두 같은 `pf_*` 함수**를 지나므로 규칙을 한 번만 테스트하면 된다.

### 설계 원칙 네 가지와 강제 장치

| 원칙 | 강제 장치 | 확인 테스트 |
|---|---|---|
| 재고는 이력의 합 | 재고 컬럼에 사용자 UPDATE 권한 없음, 함수가 재고와 이력을 한 트랜잭션으로 | T-INV |
| 기록은 지우지 않는다 | `stock_logs`에 UPDATE · DELETE 권한 없음, 취소는 반대 기록 | 취소 후 원래 기록 존재(Step 3) |
| 권한은 DB에서 | 모든 테이블 RLS, 함수 첫 줄 `auth.uid()` 확인, 남의 ID는 404 | T-AUTH, 완료 테스트 6 |
| 계산은 코드, 초안은 AI, 실행은 사람 | 추천 수량은 코드(`lib/agent/reorder.ts`), LLM은 문안 · 액션 JSON만, 실행은 확인 API에서 다시 검증 | T-AI |

LLM이 꺼져도 입출고는 동작한다(LLM 오류는 에이전트 패널에만 표시, P-08).

## 3. 데이터 구조

금액은 원 단위 정수, 시각은 `timestamptz`(표시 · '오늘'은 `Asia/Seoul`). 입력 범위 CHECK는 테이블에도 같이 있다. 컬럼 전체: [03 2절](../docs/03-data-model.md).

| 테이블 | 핵심 컬럼 · 규칙 | 쓰는 주체 |
|---|---|---|
| `items` | `sku_id`(사용자 안 unique), `item_name`, `unit_cost`, `sale_price`, `stock_qty`(≥ 0), `safety_stock` | 사용자는 이름 · 단가 · 안전재고만, 재고는 함수만 |
| `purchases` | `purchase_id`(P-101), `sku_id`, `supplier`, `order_qty`, `received_qty`, `status`, `invoice_no`(사용자 안 unique) | 함수만 |
| `sales` | `sale_id`(S-201), `sku_id`, `channel`, `sold_qty`, `sale_amount`, `fulfillment_status`, `invoice_no` | 함수만 |
| `stock_logs` | `change_qty`(≠ 0), `reason`(구매입고 · 실판매출고 · 입고취소 · 출고취소 · 재고조정), `ref_type`, `ref_id` | 함수만, **추가만** |
| `llm_usage` | `(user_id, day)`별 호출 수 | `pf_llm_take()`만 |

불변식(회귀 테스트 마지막에 항상 검산): 품목별 `sum(stock_logs.change_qty) = items.stock_qty`, `stock_qty ≥ 0`, 입고완료 · 출고완료마다 해당 이력이 정확히 1개(T-INV-1~4).

시드 3벌: `demo`(시연) · `small`(품목 5 · 이력 20, 정답표 비교) · `large`(품목 10 · 이력 50, 응답 시간 측정). 모두 가상 데이터.

## 4. 상태 전이

전이 규칙은 함수 안 한곳(`pf_purchase_transition_ok` · `pf_sale_transition_ok`)에만 둔다. 화면은 갈 수 있는 버튼만 보여 주지만 판정은 DB가 한다.

**구매 `purchases.status`**

| 현재 | 갈 수 있는 상태 | 재고 영향 |
|---|---|---|
| 발주완료 | 이동·통관중 / 입고완료 / 품절 / 취소 | 입고완료: +received_qty |
| 이동·통관중 | 입고완료 / 취소 | 입고완료: +received_qty |
| 입고완료 | 입고취소 | −received_qty (재고 부족 시 거부) |
| 입고취소 · 품절 · 취소 | (끝) | — |

**판매 `sales.fulfillment_status`**

| 현재 | 갈 수 있는 상태 | 재고 영향 |
|---|---|---|
| 주문접수 | 출고대기 / 주문취소 | — |
| 출고대기 | 출고완료 / 주문취소 | 출고완료: −sold_qty (재고 부족 시 거부) |
| 출고완료 | 출고취소 | +sold_qty |
| 출고취소 · 주문취소 | (끝) | — |

다이어그램: [03 3절](../docs/03-data-model.md).

## 5. 재고 함수 (RPC)

모두 `security definer`, 첫 줄에서 `pf_require_user()`, 모든 쿼리에 `user_id = uid` 조건. 행 잠금(`for update`)으로 같은 품목의 동시 출고를 줄 세운다(부하 검증은 범위 밖).

| 함수 | 하는 일 | 재고 · 이력 |
|---|---|---|
| `pf_create_item` | 품목 등록(재고 0) | — |
| `pf_create_purchase` | `발주완료`로 생성 | — |
| `pf_set_purchase_status` | 재고 영향 없는 전이(이동·통관중 · 품절 · 취소) | — |
| `pf_receive_purchase` | 입고완료 | +received_qty, `구매입고` |
| `pf_cancel_receipt` | 입고취소 | −received_qty, `입고취소` |
| `pf_create_sale` | `주문접수`로 생성 | — |
| `pf_set_sale_status` | 출고대기 · 주문취소 | — |
| `pf_ship_sale` | 출고완료(주문접수에서 부르면 출고대기를 거쳐 한 번에) | −sold_qty, `실판매출고` |
| `pf_cancel_shipment` | 출고취소 | +sold_qty, `출고취소` |
| `pf_bulk_apply` | 일괄 등록 반영, 행마다 위 함수를 부르고 실패 행은 사유 반환 | 위와 같음 |
| `pf_reset_and_seed` | **본인 데이터만** 지우고 시드 재주입 | 초기 재고는 `재고조정` |
| `pf_purchase_transition_ok` · `pf_sale_transition_ok` | 구매 · 판매 상태 전이가 허용되는지 판정(03 3절). 오류와 부작용 없음 — 위 상태 변경 함수가 내부에서 부르며 authenticated에는 실행 권한을 주지 않음 | — |
| `pf_llm_take` · `pf_require_user` | LLM 일일 호출 상한 / 로그인 확인 | — |

그 밖에 `pf_touch_updated_at`(`updated_at` 갱신 트리거 전용 보조 함수)이 있으나 표에서는 생략했다.

## 6. API 계약

공통: Supabase 세션 쿠키, 변경 요청은 헤더 `X-PF: 1` + Origin 확인, 본문은 JSON, 성공 `{ "data": ... }`, 오류 `{ "error": { code, message, detail } }`, 남의 리소스는 404. 전체는 [04](../docs/04-api-contract.md).

### 오류 코드

| 코드 | HTTP | 언제 |
|---|---|---|
| `PF_UNAUTHENTICATED` | 401 | 로그인 안 함 |
| `PF_CSRF` | 403 | `X-PF` 없음 또는 다른 Origin |
| `PF_NOT_FOUND` | 404 | 없음 또는 남의 것 |
| `PF_VALIDATION` | 400 | 입력 형식 · 범위 오류 |
| `PF_INVALID_TRANSITION` | 409 | 전이표에 없는 상태 변경 |
| `PF_INSUFFICIENT_STOCK` | 409 | 재고보다 많이 출고 · 입고취소 |
| `PF_DUPLICATE_INVOICE` · `PF_DUPLICATE_SKU` | 409 | 같은 송장번호 · 품목코드 |
| `PF_QUOTA_EXCEEDED` | 429 | LLM 호출 상한 초과 |
| `PF_LLM_UNAVAILABLE` | 503 | LLM 오류 · 시간 초과 |
| `PF_NOT_IMPLEMENTED` | 501 | 구현 전(stub) |
| `PF_INTERNAL` | 500 | 예상 못 한 서버 오류(원문은 서버 로그에만) |

### 라우트

| 묶음 | 라우트 | DB 함수 |
|---|---|---|
| 상태 · 인증 | `GET /api/health`, `GET /api/me`, `POST /api/auth/logout`(세션 쿠키 삭제) | — |
| 품목 | `GET · POST /api/items`, `PATCH /api/items/{sku_id}` | `pf_create_item` |
| 구매 · 입고 | `GET · POST /api/purchases`, `POST /api/purchases/{id}/status · receive · cancel-receipt` | `pf_create_purchase` · `pf_set_purchase_status` · `pf_receive_purchase` · `pf_cancel_receipt` |
| 판매 · 출고 | `GET · POST /api/sales`, `POST /api/sales/{id}/status · ship · cancel-shipment` | `pf_create_sale` · `pf_set_sale_status` · `pf_ship_sale` · `pf_cancel_shipment` |
| 이력 · 대시보드 | `GET /api/stock-logs`(키셋 페이지네이션), `GET /api/dashboard` | 조회 |
| 일괄 등록 | `POST /api/bulk/preview`(저장 안 함, 500행 · 100KB 상한), `POST /api/bulk/commit` | `pf_bulk_apply` |
| 시연 데이터 | `POST /api/seed` (`demo` · `small` · `large`) | `pf_reset_and_seed` |
| AI 에이전트 | `POST /api/agent/draft-po`, `draft-po/confirm`, `chat`, `execute` | `pf_create_purchase`(source `agent`) · 허용 액션의 함수 |

### AI 허용 액션 (6개뿐)

`get_stock` · `list_low_stock` · `ship_quantity` · `ship_sale` · `set_sale_status` · `set_purchase_status`. LLM이 다른 `type`을 내면 거부한다. `ship_quantity`가 재고보다 크면 `chat` 단계에서 거부(남은 수량 안내)하고 `execute`에서 DB 함수가 한 번 더 막는다. `sku_id`는 LLM이 지은 값을 믿지 않고 서버가 사용자 품목에서 다시 찾는다.

### 입력 규칙

수량 1~100,000, 금액 0~1,000,000,000, 텍스트 칸은 빈 문자열 저장 금지(선택 칸은 `null`). 규칙 · 문구 원본은 [04 4절](../docs/04-api-contract.md), 코드는 `src/lib/validation/`(화면 · 서버 공용).

## 7. 보안

원본: [05](../docs/05-security.md). 교육용 결과물이라 상용 수준은 보장하지 않지만, 권한 거부 증거와 공개 저장소 · URL에서 사고가 나지 않을 만큼은 지킨다.

| 겹 | 규칙 |
|---|---|
| 화면 | 로그인 안 하면 `/login`. 버튼 숨김은 편의일 뿐 보안이 아님 |
| proxy | `/api/**` 미로그인 401, 변경 요청 `X-PF` · Origin 확인 |
| API 라우트 | 입력 검증, `user_id`를 요청 본문에서 받지 않음 |
| DB 함수 | `pf_require_user()`, 모든 쿼리에 `user_id = uid`, 전이 · 재고 검사 |
| DB 테이블 | RLS `user_id = auth.uid()`, 쓰기 권한 최소(재고 · 이력은 함수 전용) |

- **서비스 키 다섯 겹(D-20)**: 키 위치 제한(배포 · 팀원 PC에 없음) / `.gitignore`(`.env*`) / 스크립트 안전장치 / 비밀값 검사(pre-commit 훅 + Actions, 같은 스크립트 `scripts/check-secrets.sh`) / GitHub Secret scanning. `src/`에 서비스 키를 쓰는 코드를 만들지 않는다.
- **권한 테스트 T-AUTH-1~8**: 미로그인 401, B가 A의 구매 · 판매 id로 호출 시 404 · 변화 없음, B JWT로 직접 조회 시 B의 행만, REST로 재고 수정 · 이력 삭제 시 권한 오류, B의 seed가 A에 영향 없음, `X-PF` 없으면 403. 결과는 [eple-step2-evidence](../docs/records/eple-step2-evidence.md).
- **LLM 위험 대응**: 정해진 JSON(허용 액션 6개)만 받고 서버가 스키마로 검사, 품목명 · 메모는 프롬프트의 '자료' 구역에 넣어 지시로 읽지 않게 함, 수치는 서버 계산값과 대조, 쓰기는 확인 API에서 재검증, 호출 상한 `pf_llm_take()`, 응답은 글자로만 렌더링.
- 남는 위험: 역할별 권한 없음, 동시 출고 부하 검증 없음, 무료 티어 가용성, `security definer` 함수 실수(T-AUTH로 보완).
- 일괄 등록의 설계 한계(D-39, [02 결정](../docs/02-decisions.md) · [04 3.6](../docs/04-api-contract.md)): 송장번호가 빈 행은 같은 내용을 다시 반영하면 한 번 더 들어가고(중복은 송장번호로만 가림), 비고(`memo`)는 검사에만 쓰고 저장하지 않는다.
- Gemini 무료 티어는 응답 시간 편차가 크고(초안 1.4 ~ 12.6초) 가끔 503을 돌려준다. 재시도 로직이 없어 사용자가 다시 눌러야 한다([ai-limits](../docs/records/ai-limits.md) 1절).
- 알려진 버그(이슈 #77, 열림): 발주 확정 뒤 대시보드의 진행 단계 숫자가 새로고침하기 전까지 그대로다.

## 8. 비용 · 사용량 상한 · 실패 시 대안

- 비용 0원(Gemini · Supabase · Render 무료). 유료 전환은 팀 합의 후에만.
- LLM 호출 상한: 사용자당 하루 30회 · 앱 전체 하루 300회(P-09). 넘으면 안내 후 거절. 하루의 기준은 **한국 시간 날짜**라 한국 시간 자정에 새로 시작한다([llm-usage](../docs/records/llm-usage.md) 1절). 오류 문구도 "한국 시간 자정 이후"로 맞췄다(#83, 11/25).
- Gemini 오류 · 한도 초과: 에이전트 패널에 오류를 표시하고 코드가 계산한 발주 후보 표만 보여 준다(미리 만든 초안을 AI 결과처럼 보이지 않음). 입출고는 LLM과 무관하게 동작.
- Render 무료는 접속이 없으면 잠듦 → 시연 직전에 URL을 열어 둔다. Supabase는 1주일 미사용 시 일시정지 → 전날 · 당일 오전 접속.
- 라이브 시연 실패 대비 2분 백업 시연 영상.
- 외부로 나가는 데이터는 LLM에 보내는 품목명 · 수량 · 단가 · 거래처명(가상)뿐, 사용자 이메일은 보내지 않는다.

## 9. 성능 측정 (Step 4)

대량 시드(품목 10 · 이력 50)에서 대시보드 · 이력 응답 시간을 측정해 기록한다(첫 호출은 따로). 결과(2026-11-24 14:18, [performance.md](../docs/records/performance.md)): **로컬 서버(Windows의 Next.js 개발 서버 → Supabase dev)에서 측정했고 배포 URL(Render) 측정이 아니다.** 각 엔드포인트 첫 호출 뒤 10번의 p50 / 최대.

| 시드 | 대시보드 p50 / 최대 | 이력 1페이지(`limit=20`) p50 / 최대 |
|---|---|---|
| small(품목 5 · 이력 20) | 691ms / 762ms | 257ms / 270ms |
| large(품목 10 · 이력 50) | 665ms / 710ms | 236ms / 243ms |

배포 URL에서의 측정은 11/25 확인.

## 10. 코드 구조 · 소유

폴더 구조와 파일 소유 구역은 [06 작업 계획](../docs/06-work-plan.md), 코드 작성 규칙(파일 머리 · 이력 · 주석)은 [12 코딩 가이드](../docs/12-coding-guide.md), 결정 기록은 [02](../docs/02-decisions.md).
