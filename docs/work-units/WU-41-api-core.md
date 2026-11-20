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

- [ ] 목 없이(`NEXT_PUBLIC_USE_MOCK=0`) 화면에서 입고 → 출고 → 대시보드 갱신
- [ ] `/api/dashboard` 값 = DB 직접 집계 (T-S1-3의 API 쪽, `demo` 시드 `expected`와 비교)
- [ ] `large` 시드에서 `stock-logs` 20 · 20 · 10건으로 나뉨, 마지막 `next_cursor: null` (T-S4-2)
- [ ] lint · typecheck · test:unit 통과
- [ ] T-VAL-2 · T-VAL-3 · T-VAL-4 통과 (`tests/api/validation.test.ts`)

## 실제 동작 확인 항목 (리뷰어 sorek-charlie)

- [ ] `test:db`와 화면 결과가 같은 재고를 가리킴

## 결과

- 한 것 / 직접 확인한 것 / 확인 못 한 것 / PR:
