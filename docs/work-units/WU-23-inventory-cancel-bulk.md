# WU-23 재고 함수 2 — 취소 · 상태 전이 (+ 일괄 반영 테스트 케이스)

- 담당: sorek-charlie / 검증: jkspawn / Step 3 · 4(중복 송장) / Wave 2 · 11/24(화) **오전 우선**(jkspawn WU-13 · 14가 기다린다)
- 브랜치: `feat/WU-23-inventory-cancel-bulk`
- 의존: WU-21. 일괄 반영 테스트는 eple의 `pf_bulk_apply`(WU-43, 같은 날 오전)

## 왜 (근거)

계획서 Step 3 "취소 · 수량 변경은 원래 기록을 지우지 않고 반대 기록", "전이표에 있는 변화만 서버에서 허용", 일괄 등록 "유효한 행만 반영". jkspawn의 사전 질문 희망 기능 '입출고 취소와 변경 이력'이 여기다. `pf_bulk_apply`는 재고 함수를 묶어 부르는 구조 래퍼라 eple이 만들고(WU-43), 이 WU는 그 **테스트 케이스**를 QA로서 쓴다.

## 읽을 파일

- [03](../03-data-model.md) 3 · 4절, [02](../02-decisions.md) P-15 · P-16
- [04](../04-api-contract.md) 3.6절(`BulkRowInput`, 오류 사유)
- 내 파일 `*_inventory.sql`, `tests/db/helpers.ts`

## 만들 · 고칠 파일 (내 구역만)

- `*_inventory.sql`(또는 새 마이그레이션 `<ts>_inventory_cancel.sql` — WU-21 파일이 이미 demo에 적용됐으면 **새 파일**)
- (`src/lib/inventory.ts` 래퍼는 eple이 골격에서 이미 만들어 둠 — 본문만 채우면 동작)
- `tests/db/cancel.test.ts`, `tests/db/transition.test.ts`, `tests/db/bulk.test.ts`

## 하지 말 것

- 원래 이력 행 수정 · 삭제 (반대 기록만 추가)
- 이미 demo에 적용된 마이그레이션 파일 수정

## 고치는 방법

1. `pf_cancel_receipt(id)` — `입고완료` → `입고취소`, `−received_qty`, 이력 `입고취소`. 현재 재고 < `received_qty`면 `PF_INSUFFICIENT_STOCK`
2. `pf_cancel_shipment(id)` — `출고완료` → `출고취소`, `+sold_qty`, 이력 `출고취소`
3. `pf_set_purchase_status(id, to)` — `이동·통관중` · `품절` · `취소`만 (재고 영향 없음)
4. 전이 판정 함수가 [03](../03-data-model.md) 3절 전이도와 정확히 같은지 표로 테스트
5. `bulk.test.ts`: eple의 `pf_bulk_apply`(WU-43)를 대상으로 아래 '다 됐다'의 일괄 반영 사례를 쓴다. WU-43이 병합되기 전에는 **먼저 실패하는 테스트**로 올려 둔다(06 3절)

## 다 됐다의 기준

- [ ] `npm run test:db` 통과
  - T-S3-1: 6개 출고 → 출고 취소 → 재고 10, 이력 −6 · +6 둘 다 존재
  - T-S3-3: `입고완료→발주완료`, `취소→입고완료`, `출고취소→출고완료` 요청 → `PF_INVALID_TRANSITION`
  - 입고 확정 8 → 6개 출고 → 입고 취소 → 재고 부족 거부
  - 같은 출고를 두 번 취소 → 두 번째 `PF_INVALID_TRANSITION`
  - T-S3-5(DB 쪽): 10행 중 3행 오류(미등록 품목 · 재고 초과 출고 · 중복 송장) → 7행 반영
  - T-S4-4: 같은 rows 두 번 → 두 번째 `applied 0`, 송장 중복 사유
  - 매 테스트 끝 T-INV-1 ~ T-INV-4 0행
- [ ] 남의 id로 취소 → `PF_NOT_FOUND`

## 테스트 방법

- 자동: `npm run test:db -- tests/db/cancel.test.ts tests/db/transition.test.ts tests/db/bulk.test.ts`

## 실제 동작 확인 항목 (리뷰어 jkspawn)

- [ ] 테스트 직접 실행, 일괄 반영 실패 행이 있어도 성공 행은 남는지 확인

## 결과 (담당자가 채움)

- 한 것: 새 `20261123130000_inventory_cancel.sql`에 구매 상태 변경·입고 취소·출고 취소 구현. 취소 시 원본 이력을 보존하고 반대 이력을 추가한다. 취소·전이·일괄 반영 DB 시험 9건 작성.
- 직접 확인한 것: main `5b34d0f` 반영 후 lint·typecheck·단위 테스트 689건 통과. 적용 전 dev에서 취소·일괄 반영 함수가 `PF_NOT_IMPLEMENTED`를 반환하는 기준선 확인. 격리된 로컬 PostgreSQL(PGlite)에 마이그레이션 8개를 순서대로 적용하고 아래 항목을 실행했다.

| ID | 시험 | 기대 | 실제 | 판정 |
|---|---|---|---|---|
| T-S3-1 · C-01 | 출고·부분 입고를 각각 취소 | 재고 복원, 원본과 반대 이력 보존 | 재고 12→18→10, 원장 −8·−6·+6·+8 | 통과 |
| T-S3-3 · C-02 | 구매 상태 전이, 중복 취소, 재고 부족 | 허용 전이만 반영, 재고·원장 일치 | 허용 상태 3개 반영, 잘못된 전이·중복 취소·재고 부족 거부, 불변식 위반 0건 | 통과 |
| C-03 | 다른 사용자와 미로그인 역할로 호출 | 타 계정 행 접근 및 미로그인 실행 거부 | 다른 사용자 요청 `PF_NOT_FOUND`, anon 취소 호출 권한 오류 | 통과 |

- 확인 못 한 것: eple과 새 마이그레이션의 dev 적용을 조율한 뒤 취소·전이 시험 재실행. 일괄 반영 2건은 WU-43의 `pf_bulk_apply` 적용 뒤 재실행.
- AI가 틀린 것과 고친 과정:
- PR:
