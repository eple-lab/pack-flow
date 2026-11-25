# WU-12 입출고 화면

- 담당: jkspawn / 검증: skygaul / Step 1 / Wave 1 · 11/23(월)
- 브랜치: `feat/WU-12-trades`
- 의존: WU-04(목), WU-41(실제 API)

## 왜 (근거)

계획서 Step 1 "구매 입고 확정, 판매 출고 처리 … 입출고 등록은 간단한 입력 폼으로 시작". 완료 판정 1 · 2를 **화면에서** 재현할 수 있어야 한다.

## 읽을 파일

- [04 API 계약](../04-api-contract.md) 1 · 2 · 3.3 · 3.4절
- `src/types/erp.ts`(상태 상수 · 전이표 상수), `src/lib/api-client.ts`, `src/lib/mock/{purchases,sales,items}.ts`
- [03 데이터 모델](../03-data-model.md) 3절 전이도(어떤 버튼을 보일지)

## 만들 · 고칠 파일 (내 구역만)

- `src/app/(app)/trades/page.tsx`
- `src/components/trades/PurchaseTable.tsx`, `SaleTable.tsx`, `PurchaseForm.tsx`, `SaleForm.tsx`, `ReceiveDialog.tsx`
- 확인 창 · 토스트 · 오류 배너는 eple의 `src/components/common/`을 **가져다 쓴다**(고치지 않음). 없는 조각은 eple에게 요청

## 하지 말 것

- 재고 · 상태 판정을 화면에서 하지 않는다. 버튼 표시는 `PURCHASE_TRANSITIONS` · `SALE_TRANSITIONS` 상수로 하되, **결과는 항상 서버 응답**을 따른다
- 상태 문자열을 코드에 직접 적지 않는다(상수 사용)
- 취소 버튼 · 이력 화면은 WU-14, 일괄 등록 탭은 WU-13

## 고치는 방법

1. 탭 두 개: **구매 · 입고** / **판매 · 출고**. URL `?tab=purchase|sale&status=...`로 필터(대시보드 파이프라인에서 넘어옴)
2. 구매 표: 번호 · 품목 · 거래처 · 주문 · 도착 수량 · 상태 · 버튼. `received_qty < order_qty`면 '부분 입고' 배지
3. 구매 등록 폼: 품목(목록에서 선택) · 거래처 · 수량 · 금액 · 송장번호(선택) → `POST /api/purchases`
4. [입고 확정] → 도착 수량 입력 창(기본값 = 주문 수량, 1 ~ 주문 수량) → `POST /api/purchases/{id}/receive`
5. 판매 표 · 등록 폼(품목 · 채널 · 수량 · 금액 · 송장번호) → `POST /api/sales`. [출고대기로], [출고] 버튼
6. 오류: `api-client`가 던진 오류를 공통 `ErrorBanner`에 넘긴다(남은 수량 문장 · testid `error-banner`는 배너가 처리)
7. 성공하면 목록을 다시 불러오고 "재고 10 → 4" 같은 짧은 알림
8. `data-testid`

| 요소 | testid |
|---|---|
| 탭 | `tab-purchase`, `tab-sale` |
| 구매 행 · 버튼 | `purchase-row-<purchase_id>`, `btn-receive-<purchase_id>`, 도착 수량 입력 `input-received-qty`, 확인 `btn-receive-confirm` |
| 판매 행 · 버튼 | `sale-row-<sale_id>`, `btn-ready-<sale_id>`, `btn-ship-<sale_id>` |
| 등록 폼 | `form-purchase`, `form-sale`, 제출 `btn-submit-purchase`, `btn-submit-sale` |
| 오류 배너 | `error-banner` |

## 입력 · 오류 처리 ([04](../04-api-contract.md) 4절)

- 폼은 `src/lib/validation/`의 `purchaseCreate` · `saleCreate` · `receive` 스키마로 보내기 전에 검사하고, 틀린 칸 아래 `FieldError`(문구는 [04](../04-api-contract.md) 4.3). 서버가 `detail.field`로 거부해도 같은 칸 아래에
- 선택 칸(송장번호)을 비우면 `null`로 보낸다. 숫자 칸의 쉼표 · 공백은 지우고 정수로
- 저장 · 입고 확정 · 출고 버튼은 `SubmitButton`(요청 중 잠금). 성공하면 `Toast` + 폼 비우기, 실패하면 입력값 유지
- 비어 있는 도착 수량 · 송장번호 · 시각은 `—` (4.5)

## 다 됐다의 기준

> 11/26 eple 사후 확인: 개발 종료 뒤 소스 · 시험 · 기록으로 확인한 칸만 체크

- [x] lint · typecheck · test:unit 통과 — (11/26 eple 사후 확인: 11/26 `npm run lint` · `typecheck` · `test:unit` 직접 재실행 — 오류 0, unit 49파일 869개 통과)
- [x] 실제 API(dev, `demo` 시드): S-201 출고 → 재고 10 → 4 알림, P-101 8개 입고 확정 → '부분 입고' 배지 (완료 판정 1 · 2를 화면으로) — (11/26 eple 사후 확인: tests/e2e/step1.spec.ts T-S1-1 · T-S1-2(회귀 11/25 배포 dev 통과) · review-skygaul.md Step 1(알림 재고 10 → 4, 입고 뒤 4 → 12). '부분 입고' 배지는 PurchaseTable.tsx:139 · trades.test.tsx T-02로 확인(배포 화면 기록에는 배지 문구가 없음))
- [x] 재고보다 많은 출고 시 `error-banner`에 남은 수량 안내, 목록 변화 없음 — (11/26 eple 사후 확인: T-S3-2(회귀 통과, 재고 · 이력 변화 없음) · trades.test.tsx E-04 · review-skygaul.md · review-eple.md Step 3(demo 배포 화면 거부 배너 "남은 수량 12개"))
- [x] 위 testid 전부 있음 — (11/26 eple 사후 확인: trades.test.tsx T-01 · T-04 · T-06 · T-07 · 11/26 소스 grep으로 14종 모두 있음 · step1.spec.ts가 이 testid로 배포에서 통과)
- [x] 수량 0 · 소수 · 10만 초과 입력 → 칸 아래 범위 · 정수 문구, 요청 안 나감 — (11/26 eple 사후 확인: trades.test.tsx F-01~F-03 · B-02(요청 안 나감) · T-VAL-5(회귀 통과) — 11/26 재실행 통과)
- [x] 송장번호를 비운 판매 두 건이 모두 등록됨 (T-VAL-1 화면 쪽) — (11/26 eple 사후 확인: trades.test.tsx F-06(화면 쪽) · T-VAL-1(회귀 통과, tests/db/validation.test.ts:18))
- [x] testid `field-error-<필드>`가 칸 아래 오류에 있음 — (11/26 eple 사후 확인: trades.test.tsx F-01 · B-02 · src/components/common/FieldError.tsx)

## 테스트 방법

- 자동: E2E `tests/e2e/step1.spec.ts`(sorek-charlie)가 위 testid로 실행
- 직접: '다 됐다' 2 · 3번을 dev에서 순서대로

## 실제 동작 확인 항목 (리뷰어 skygaul)

- [x] 출고 → 대시보드 품절 임박 카드까지 이어짐
- [x] 같은 [출고]를 빠르게 두 번 눌러도 한 번만 처리(버튼 잠금)

## 결과 (담당자가 채움)

- 한 것:
- 탭 두 개 **구매 · 입고 / 판매 · 출고**, 주소 `?tab=purchase|sale&status=...`로 필터. 대시보드 파이프라인처럼 `?status=`만 와도 상태로 탭을 고른다(탭에 안 맞는 상태 · 없는 상태는 버림). 필터 칩에 [전체 보기]
- 구매 등록 폼(품목 선택 · 거래처 · 수량 · 금액 · 송장번호) → `POST /api/purchases`
- 판매 등록 폼(품목 선택 · 채널 · 수량 · 금액 · 송장번호) → `POST /api/sales`
  - 보내기 전에 `purchaseCreate` · `saleCreate` 스키마로 검사, 틀린 칸 아래 `FieldError`(04 4.3 문구) — 그때는 요청을 보내지 않음
  - 숫자 칸은 천 단위 쉼표(`1,000`) · 공백만 지우고 정수로(`8,5`는 not_integer), 품목코드 대문자, 송장번호 빈 값은 `null`
  - 서버 칸 오류(`PF_VALIDATION`의 `field`, `PF_DUPLICATE_INVOICE`)도 같은 칸 아래, 그 밖은 `ErrorBanner`
  - 성공하면 `Toast` + 폼 비움 + 첫 칸에 커서, 실패하면 입력값 유지
- 구매 표: 번호 · 품목 · 거래처 · 주문 · 도착 수량(없으면 `—`) · 상태 · 처리. 주문보다 적게 도착하면 **부분 입고** 배지
- [입고 확정] 창: 도착 수량 기본값 = 주문 수량, 1 ~ 주문 수량(`makeReceive`) → `POST /api/purchases/{id}/receive`
- 판매 표: 번호 · 품목 · 채널 · 수량 · 금액(원) · 송장번호(없으면 `—`) · 상태 · [출고대기로] · [출고]
- 버튼 표시는 `PURCHASE_TRANSITIONS` · `SALE_TRANSITIONS` 상수로만, 결과는 항상 서버 응답. 저장 · 출고 버튼은 `SubmitButton`(요청 중 잠금)
- 성공 알림 "S-201 출고 — PRD-001 재고 10 → 4": 작업 전 품목 목록 값 → 서버 응답 `stock_qty` 그대로(화면에서 계산하지 않음)
- 실패는 `ErrorBanner`에 `error.message` 그대로. 재고 부족이면 목록 그대로, 전이 오류면 목록 새로고침(04 4.4)
- WU 목록 밖 새 파일 5개 — 모두 내 구역(`src/components/trades/`):
  - `TradesView.tsx`: `page.tsx`가 metadata를 내보내는 서버 컴포넌트라 불러오기 · 작업 처리를 클라이언트 컴포넌트로 나눔
  - `query.ts`: 주소 읽기 · 만들기(서버 page와 클라이언트가 같이 씀 — 'use client' 없음)
  - `form-utils.ts`: 칸 오류 고르기 · 재고 변화 알림 문구(순수 함수)
  - `trades.module.css`: CSS 모듈 + 토큰(D-31)
  - `trades.test.tsx`: 시험 Q · F · E · T 25개

- 직접 확인한 것:
- [x] npm run lint / typecheck / test:unit 통과 (unit 19파일 467개)
- [x] 다 됐다의 기준
  - [x] lint · typecheck · test:unit 통과
  - [x] 실제 API(dev, `demo` 시드): S-201 출고 → 재고 10 → 4 알림, P-101 8개 입고 확정 → '부분 입고' 배지 — **WU-41 병합 뒤 확인** (목으로는 같은 알림 · 배지 확인: B-04 · B-05 · T-02) — (11/26 eple 사후 확인: tests/e2e/step1.spec.ts T-S1-1 · T-S1-2(회귀 11/25 배포 dev 통과) · review-skygaul.md Step 1(알림 재고 10 → 4, 입고 뒤 4 → 12). '부분 입고' 배지는 PurchaseTable.tsx:139 · trades.test.tsx T-02로 확인(배포 화면 기록에는 배지 문구가 없음))
  - [x] 재고보다 많은 출고 시 `error-banner`에 남은 수량 안내, 목록 변화 없음 — **WU-41 병합 뒤 확인** (문구는 E-04, 목록 유지 처리는 코드) — (11/26 eple 사후 확인: T-S3-2(회귀 통과, 재고 · 이력 변화 없음) · trades.test.tsx E-04 · review-skygaul.md · review-eple.md Step 3(demo 배포 화면 거부 배너 "남은 수량 12개"))
  - [x] testid 전부 있음 (T-01 · T-04 · T-06 · T-07)
  - [x] 수량 0 · 소수 · 10만 초과 입력 → 칸 아래 범위 · 정수 문구, 요청 안 나감 (F-01~F-03, B-02)
  - [x] 송장번호를 비운 판매 두 건이 모두 등록됨 (T-VAL-1 화면 쪽) — 화면 쪽은 통과(F-06, B-06), DB 등록은 **WU-41 병합 뒤 확인** — (11/26 eple 사후 확인: trades.test.tsx F-06(화면 쪽) · T-VAL-1(회귀 통과, tests/db/validation.test.ts:18))
  - [x] testid `field-error-<필드>`가 칸 아래 오류에 있음 (F-01, B-02)
- [x] 실제 동작 확인: `NEXT_PUBLIC_USE_MOCK=1`로 `npm run dev`, 로그인 뒤 `/trades`에서 확인 (아래 B-01~B-07)

| ID | 조건 · 행동 | 기대 | 실제 | 판정 |
|---|---|---|---|---|
| Q-01 | `?status=이동·통관중` | 구매 탭 + 그 상태 필터 | 같음 | 통과 |
| Q-02 | `?status=출고대기` | 판매 탭 + 그 상태 필터 | 같음 | 통과 |
| Q-03 | `tab=sale&status=발주완료`, 없는 상태 · 탭 (실패해야 함) | 상태 버림, 기본 구매 탭 | 같음 | 통과 |
| Q-04 | 쿼리 없음 · 주소 만들기 | 구매 탭, 한글 상태 인코딩 | 같음 | 통과 |
| F-01 | 구매 수량 0 (실패해야 함) | `field-error-order_qty` "1 ~ 100,000 사이로 입력해 주세요" | 같음 | 통과 |
| F-02 | 구매 수량 1.5 (실패해야 함) | "숫자(정수)로 입력해 주세요" | 같음 | 통과 |
| F-03 | 구매 수량 100,001 (실패해야 함) | 범위 밖 | 같음 | 통과 |
| F-04 | ` prd-001 ` · `80,000` · 송장 공백 | `PRD-001` · 80000 · `null` | 같음 | 통과 |
| F-05 | 품목 안 고름 (실패해야 함) | `sku_id` required | 같음 | 통과 |
| F-06 | 송장 빈 판매 두 건 | 둘 다 통과, `invoice_no` null | 같음 | 통과 |
| F-07 | 판매 수량 0 · 빈 채널 (실패해야 함) | `sold_qty` 범위 밖 · `channel` required | 같음 | 통과 |
| F-08 | 주문 10에 도착 8 / 0 · 11 | 8 통과, 0 · 11은 "1 ~ 10" 범위 밖 | 같음 | 통과 |
| F-09 | 금액 · 수량 `8,5` · `1,5` (실패해야 함) / `1,000` | `8,5` · `1,5`는 not_integer, `1,000`은 1000 | 처음엔 `toNumberInput`이 쉼표를 모두 지워 85로 통과 → 천 단위 쉼표만 지우는 `toIntegerInput`(form-utils) 추가 | 통과(수정 후) |
| E-01 | 서버 `PF_DUPLICATE_INVOICE` | 송장번호 칸 아래 "이미 등록된 송장번호예요 (INV-1)" | 같음 | 통과 |
| E-02 | 서버 `PF_VALIDATION` field=supplier | 거래처 칸 아래 | 같음 | 통과 |
| E-03 | field=body · 재고 부족 (실패해야 함) | 칸 오류 아님 → 배너 | 같음 | 통과 |
| E-04 | 재고 부족 오류 문구 | "재고가 부족해요. PRD-003 남은 수량 3개" | 같음 | 통과 |
| E-05 | 알림 문구 | "S-201 출고 — PRD-001 재고 10 → 4" | 같음 | 통과 |
| T-01 | 구매 표(P-101 이동·통관중) | 행 · [입고 확정], 도착 `—`, 배지 없음 | 같음 | 통과 |
| T-02 | 8 / 10 입고완료 | 부분 입고 배지, [입고 확정] 없음 | 같음 | 통과 |
| T-03 | 10 / 10 입고완료 | 배지 없음 | 같음 | 통과 |
| T-04 | 판매 표(S-201 출고대기, S-202 주문접수) | S-201 [출고]만, S-202 [출고대기로]만, 송장 `—` | 같음 | 통과 |
| T-05 | 출고완료 판매 (실패해야 함) | 버튼 없음 | 같음 | 통과 |
| T-06 | 등록 폼 렌더 | `form-*` · `btn-submit-*` testid, 품목 선택 목록 | 같음 | 통과 |
| T-07 | 입고 확정 창 렌더 | 기본값 10, `input-received-qty` · `btn-receive-confirm` | 같음 | 통과 |
| B-01 | 브라우저 `/trades?status=이동·통관중` | 구매 탭 + 필터 칩 | 같음 | 통과 |
| B-02 | 구매 수량 0으로 등록 | 칸 아래 오류, 알림 없음 | 같음 | 통과 |
| B-03 | 구매 수량 10으로 등록 | "구매 P-102 등록했어요", 폼 비움, 첫 칸 커서 | 같음 | 통과 |
| B-04 | [입고 확정] → 11 → 8 | 기본값 10, 11은 "1 ~ 10 사이로…", 8은 "P-101 입고 확정 — PRD-001 재고 10 → 18" | 같음 | 통과 |
| B-05 | 판매 탭 S-201 [출고] | "S-201 출고 — PRD-001 재고 10 → 4" | 같음 | 통과 |
| B-06 | 송장 빈 판매 등록 | "판매 S-203 등록했어요" | 같음 | 통과 |
| B-07 | 화면 폭 375px | 페이지 375 그대로, 표만 가로 스크롤 | 페이지 375, 표 640 → 310 상자 안 스크롤 | 통과 |

- 확인 못 한 것:
- 실제 API(`NEXT_PUBLIC_USE_MOCK=0`, `demo` 시드): S-201 출고 재고 10 → 4, P-101 8개 입고 부분 입고 배지, 재고 초과 출고 배너 · 목록 유지, 송장 없는 판매 두 건 DB 등록 — WU-41 병합 뒤 확인하고 이 PR에 결과를 덧붙인다
- 재고 부족 배너를 화면에서 띄우기: 목으로는 화면 버튼에서 재현할 수 없음(문구는 E-04로만)
- [출고] 빠르게 두 번 누르기: 목 응답이 즉시라 눈으로 확인 못 함. 잠금은 공통 `SubmitButton`
- E2E(`tests/e2e/step1.spec.ts`)는 sorek-charlie 몫이라 돌리지 않음
- 참고: 목의 `setSaleStatus`가 항상 첫 판매 번호를 돌려줘 [출고대기로] 알림이 S-202 대신 "S-201"로 보임. 화면은 서버 응답을 쓰므로 실제 API에서는 S-202 (목은 eple 구역이라 손대지 않음)

- AI가 틀린 것과 고친 과정:
| F-09 | 금액 · 수량 `8,5` · `1,5` (실패해야 함) / `1,000` | `8,5` · `1,5`는 not_integer, `1,000`은 1000 | 처음엔 `toNumberInput`이 쉼표를 모두 지워 85로 통과 → 천 단위 쉼표만 지우는 `toIntegerInput`(form-utils) 추가 | 통과(수정 후) |

- PR:#5
