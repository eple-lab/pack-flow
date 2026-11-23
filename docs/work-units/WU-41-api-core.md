# WU-41 업무 API 실제 연결

- 담당: eple / 검증: sorek-charlie / Step 1 / Wave 1 · 11/23(월)
- 브랜치: `feat/WU-41-api-core` (11/23부터 eple도 PR)
- 의존: WU-21(재고 함수) — 함수가 오기 전에는 오류 매핑 · 조회 라우트부터

## 왜 (근거)

화면(WU-11 · 12)이 목에서 실제로 넘어가는 지점. P-02 "모든 변경은 API → 함수", P-03 "사용자 JWT 클라이언트만".

## 읽을 파일

- [04](../04-api-contract.md) 1~3.5절, [03](../03-data-model.md) 4절 오류 코드
- 내 파일 `src/lib/api/*`, `src/lib/supabase/server.ts`, `src/types/erp.ts`, `src/lib/inventory.ts`(골격에서 완성한 래퍼), `src/lib/time.ts`

## 만들 · 고칠 파일 (내 구역만)

- `src/app/api/{items,purchases,sales,stock-logs,dashboard,me}/**`
- `src/lib/queries/dashboard.ts`, `src/lib/queries/stockLogs.ts`
- `tests/api/stock-logs.test.ts`, 라우트 입력 검증 단위 테스트

## 하지 말 것

- 서비스 키 클라이언트 사용(그런 코드는 `src/`에 없어야 한다)
- 재고 계산을 TS에서 하기(함수 결과만 반환)

## 고치는 방법

1. 변경 라우트: 입력 검증(zod 등) → `inventory.ts` 래퍼 → `{data}` / 오류는 `errors.ts`
2. 조회 라우트: 사용자 JWT 클라이언트로 select(RLS가 거른다). `items`에 `below_safety` 계산 필드
3. `dashboard.ts`: KPI · 파이프라인 · 품목 · 품절 임박 · 최근 변경 5건. '오늘'은 `Asia/Seoul`
4. `stockLogs.ts`: `(created_at, log_id)` 키셋 페이지네이션, `limit` 1~50, 기본 20, `next_cursor` 불투명 문자열(base64)
5. `PATCH /api/items/{sku_id}`에 `stock_qty`가 오면 400

## 입력 · 오류 처리 ([04](../04-api-contract.md) 4절)

- 모든 변경 라우트는 `src/lib/validation/` 스키마를 **strict**로 쓴다(계약에 없는 필드 거부). JSON이 아니거나 100KB 초과면 400
- 예상하지 못한 오류는 `PF_INTERNAL`(원문은 `log.ts`로만)

## 다 됐다의 기준

- [x] 목 없이(`NEXT_PUBLIC_USE_MOCK=0`) 화면에서 입고 → 출고 → 대시보드 갱신
- [x] `/api/dashboard` 값 = DB 직접 집계 (T-S1-3의 API 쪽, `demo` 시드 `expected`와 비교)
- [x] `large` 시드에서 `stock-logs` 20 · 20 · 10건으로 나뉨, 마지막 `next_cursor: null` (T-S4-2)
- [x] lint · typecheck · test:unit 통과
- [x] T-VAL-2 · T-VAL-3 · T-VAL-4 통과 (`tests/api/validation.test.ts`)

## 실제 동작 확인 항목 (리뷰어 sorek-charlie)

- [ ] `test:db`와 화면 결과가 같은 재고를 가리킴

## 결과

(작성: eple 세션의 Claude, 2026-11-23. 구현은 하위 에이전트(Sonnet) 3개에 단계별로 맡기고, 관리 세션이 기준 명령을 다시 돌리고 핵심 파일을 읽은 뒤 커밋했다)

- 한 것:
  - 조회 라우트 items(`below_safety`) · purchases · sales(status 필터) · dashboard(KST 오늘, 상태별 head count) · stock-logs(`(created_at, log_id)` 키셋, base64url 커서 — 시각을 `Date`로 바꾸지 않아 마이크로초 보존)
  - 변경 라우트 9개가 `inventory.ts` 래퍼만 부름. receive는 구매를 먼저 읽어 `makeReceive(order_qty)`로 칸 오류. `PATCH items`는 JWT 클라이언트로 허용 5칸만 update
  - `src/lib/queries/`(dashboard · stockLogs · lists · items · pathParam · throwIfDbError, 시험 도우미 2개), `vitest.config.mts` db 묶음에 `tests/api/**` 추가(eple 결정)
  - 시험: 단위 C-01~C-55, `tests/api/` validation(T-VAL-2~4) · stock-logs(T-S4-2) · dashboard(T-S1-3)
- 직접 확인한 것:
  - `NEXT_PUBLIC_USE_MOCK=0` 로컬 + dev DB 화면: P-101 8개 입고(부분 입고 배지) → S-201 출고 → 대시보드 합계 53 → 55, 오늘 입고 1 · 출고 1, 최근 변경 −6 · +8
  - T-S1-3 API 쪽: 대시보드 kpi · 재고 = demo `expected` = DB 직접 집계, 입고 → 출고 뒤 갱신, 같은 판매 재출고 409
  - T-S4-2: 이력 50건(한 트랜잭션, 같은 시각) → 20 · 20 · 10, 마지막 `next_cursor: null`, 이어 붙이면 DB 순서와 같음
  - lint · typecheck 통과, test:unit 627개, test:db 38개(당시)
- 확인 못 한 것: 남의 품목 PATCH → 404는 단위(가짜 DB)로만 — 실제 계정 B 시험은 WU-42 T-AUTH-2b로 보완. T-S4-2는 `large.json` 전 같은 규모 시드로 만들었다(#40 뒤 `large`도 이력 50)
- AI가 틀린 것과 고친 과정: 하위 에이전트가 시험을 복제하다 판매 시험의 오류 field 기대값을 `fulfillment_status`로 잘못 바꿈 → 시험 실패로 잡아 기대값만 고침(코드는 맞았음). [ai-cases-eple](../records/ai-cases-eple.md) 사례 1
- PR: #38 (리뷰 sorek-charlie, 병합 11/23 18:16)
