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

## 다 됐다의 기준

- [ ] lint · typecheck · test:unit 통과
- [ ] 실제 API(dev, `demo` 시드): S-201 출고 → 재고 10 → 4 알림, P-101 8개 입고 확정 → '부분 입고' 배지 (완료 판정 1 · 2를 화면으로)
- [ ] 재고보다 많은 출고 시 `error-banner`에 남은 수량 안내, 목록 변화 없음
- [ ] 위 testid 전부 있음

## 테스트 방법

- 자동: E2E `tests/e2e/step1.spec.ts`(sorek-charlie)가 위 testid로 실행
- 직접: '다 됐다' 2 · 3번을 dev에서 순서대로

## 실제 동작 확인 항목 (리뷰어 skygaul)

- [ ] 출고 → 대시보드 품절 임박 카드까지 이어짐
- [ ] 같은 [출고]를 빠르게 두 번 눌러도 한 번만 처리(버튼 잠금)

## 결과 (담당자가 채움)

- 한 것:
- 직접 확인한 것:
- 확인 못 한 것:
- AI가 틀린 것과 고친 과정:
- PR:
