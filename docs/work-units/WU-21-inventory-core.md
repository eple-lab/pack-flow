# WU-21 재고 함수 1 — 등록 · 입고 · 출고

- 담당: sorek-charlie / 검증: jkspawn / Step 1 / Wave 1 · 11/23(월) **오전 우선**(eple · jkspawn이 기다린다)
- 브랜치: `feat/WU-21-inventory-core`
- 의존: WU-02(스키마 · 함수 자리, main에 있음)

## 왜 (근거)

D-10: 재고 증감 · 전이 검사 · 이력 기록은 Postgres 함수 하나에서 한 트랜잭션으로. 설계 원칙 "재고는 이력의 합". 완료 판정 1 · 2와 마이너스 재고 방지(Step 3 일부)가 이 함수들에 달려 있다.

## 읽을 파일

- [03 데이터 모델](../03-data-model.md) 2 · 3 · 4 · 6절 (특히 4절 '함수 안 순서')
- [05 보안](../05-security.md) 3절(함수 안 `user_id` 조건)
- `supabase/migrations/*_schema.sql`, `*_rls.sql`, `*_core_functions.sql`(읽기만), `*_inventory.sql`(내 파일, 자리)
- `src/lib/inventory.ts`(eple이 완성해 둔 호출 래퍼 — 읽기만), `src/types/erp.ts`, `tests/db/helpers.ts` · `tests/db/_sample.test.ts`(사용법)

## 만들 · 고칠 파일 (내 구역만)

- `supabase/migrations/*_inventory.sql`의 아래 함수 본문
- `tests/db/receive.test.ts`, `tests/db/ship.test.ts`, `tests/db/invariants.test.ts` — 로그인 · 초기화 · 불변식 검사는 eple의 `tests/db/helpers.ts`(WU-08)를 **가져다 쓴다**. 도우미가 더 필요하면 eple에게 요청

## 하지 말 것

- 스키마 · RLS 파일 수정(eple). 컬럼이 더 필요하면 eple에게 요청
- 함수 안에서 `user_id` 조건 빠뜨리기 — `security definer`라 RLS가 안 막는다
- 서비스 키로 테스트하기 — 반드시 **테스트 계정 로그인(사용자 JWT)**으로
- 마이그레이션을 직접 demo에 적용(적용은 eple, P-06). dev 적용은 eple과 맞춰서

## 고치는 방법

함수(모두 `security definer`, `set search_path = public`, 첫 줄 `uid := pf_require_user()`):

1. `pf_create_item` — 재고 0으로 생성, `PF_DUPLICATE_SKU`
2. `pf_create_purchase` — `발주완료`, 번호 `P-` + 사용자별 다음 숫자, 품목 없으면 `PF_NOT_FOUND`, 송장 중복 `PF_DUPLICATE_INVOICE`
3. `pf_receive_purchase(id, received_qty)` — 행 잠금 → 주인 확인 → 전이(`발주완료`·`이동·통관중` → `입고완료`) → `0 < received_qty ≤ order_qty` → 품목 잠금 → `stock_qty += received_qty` → `stock_logs (+, '구매입고', 'purchase', purchase_id)` → `received_at`
4. `pf_create_sale` — `주문접수`, 번호 `S-…`
5. `pf_set_sale_status(id, to)` — `출고대기` · `주문취소`만
6. `pf_ship_sale(id)` — [03](../03-data-model.md) 4절 순서 그대로. `주문접수`에서 불리면 `출고대기`를 거친 것으로 처리. 재고 부족이면 `PF_INSUFFICIENT_STOCK` + detail `{sku_id, stock_qty, requested}`
7. 전이 판정은 `pf_purchase_transition_ok` · `pf_sale_transition_ok` 한곳(WU-23도 이걸 쓴다)
8. 오류는 `raise exception '<코드>' using detail = json_build_object(...)::text`
9. 호출 래퍼 `src/lib/inventory.ts`는 eple이 골격에서 완성해 두었다. 함수 인자 · 반환 모양을 [03](../03-data-model.md) 4절과 다르게 바꿔야 하면 **먼저 eple에게 요청**(래퍼와 계약을 같이 고친다)

## 다 됐다의 기준

- [ ] `npm run test:db` 통과 (dev, 본인 테스트 계정)
  - T-S1-1: 재고 10 · 안전 5 → 6개 출고 → 재고 4, 이력 −6 1건
  - T-S1-2: 10개 주문 · 8개 입고 → 재고 +8, `received_qty` 8
  - T-S3-2: 재고 4에 50개 출고 → `PF_INSUFFICIENT_STOCK`, 재고 · 이력 그대로
  - 남의 구매 · 판매 id(두 번째 테스트 계정)로 호출 → `PF_NOT_FOUND`, 변화 없음
  - `received_qty` 0 · 주문 초과 → `PF_VALIDATION`
  - 매 테스트 끝 T-INV-1(이력 합계 = 재고) 0행
- [ ] eple이 dev에 마이그레이션 적용 후 다시 통과

## 테스트 방법

- 자동: `npm run test:db -- tests/db/ship.test.ts tests/db/receive.test.ts`
- `.env.local`에 본인 테스트 계정 2개(`TEST_USER_A_*`, `TEST_USER_B_*`) — 값은 eple이 개별 전달

## 실제 동작 확인 항목 (리뷰어 jkspawn)

- [ ] 브랜치 받아 `npm run test:db` 직접 실행 → 통과
- [ ] 함수 본문의 모든 `select` · `update` · `insert`에 `user_id = uid`가 있는지 눈으로 확인

## 결과 (담당자가 채움)

- 한 것:
- 직접 확인한 것:
- 확인 못 한 것:
- AI가 틀린 것과 고친 과정:
- PR:
