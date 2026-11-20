# WU-14 이력 화면 · 취소 · 상태 버튼

- 담당: jkspawn / 검증: skygaul / Step 3 (페이지네이션은 Step 4) / Wave 2 · 11/24(화) **14시 전**
- 브랜치: `feat/WU-14-history-cancel`
- 의존: WU-23(취소 · 전이 함수), WU-41(stock-logs 라우트)

## 왜 (근거)

계획서 Step 3 "취소는 원래 기록을 지우지 않고 반대 기록 추가" — 증거가 **품목 A의 이력 화면(출고 −6 · 출고취소 +6)**이다. Step 4 "이력은 나눠 받기(20건씩)".

## 읽을 파일

- [04](../04-api-contract.md) 3.3 · 3.4(취소 · status 라우트) · 3.5(`stock-logs` 페이지네이션)
- [03](../03-data-model.md) 3절 전이도, `src/types/erp.ts` 전이 상수
- 내 파일 `src/components/trades/*`(WU-12)

## 만들 · 고칠 파일 (내 구역만)

- `src/app/(app)/history/page.tsx`, `src/components/history/LogTable.tsx`(새 폴더 — 06 화면 구역에 포함)
- `src/components/trades/PurchaseTable.tsx`, `SaleTable.tsx`(버튼 추가)

## 하지 말 것

- 이력 행을 수정 · 삭제하는 버튼을 만들지 않는다(원장은 추가만)
- 버튼을 숨기는 것으로 권한을 대신하지 않는다(서버가 거부해도 화면이 오류를 잘 보여 주면 된다)

## 고치는 방법

1. 이력 화면: 품목 선택(또는 `?sku_id=`) → 표(시각 · 변화량 `+8`/`−6` · 사유 · 참조 번호) 최근순 20건, [더 보기]로 `next_cursor` 다음 페이지
2. 표 위에 "현재 재고 4 = 이력 합계 4" 한 줄(서버 값 두 개를 나란히 — 계산하지 않고 `GET /api/items`의 재고와 이력 화면 합계를 보여 줌)
3. 구매 표 버튼: 상태별로 `PURCHASE_TRANSITIONS`의 다음 상태만 — [이동·통관중으로], [품절], [발주 취소], `입고완료`면 [입고 취소]
4. 판매 표 버튼: [주문 취소], `출고완료`면 [출고 취소]
5. 취소류는 확인 창("출고를 취소하면 재고가 6개 돌아오고, 기록은 남아요")
6. testid: `history-sku-select`, `log-row-<log_id>`, `btn-more-logs`, `btn-cancel-shipment-<sale_id>`, `btn-cancel-receipt-<purchase_id>`, `btn-purchase-to-<상태>-<purchase_id>`, `btn-order-cancel-<sale_id>`, `confirm-ok`

## 다 됐다의 기준

- [ ] dev에서 S-201 출고 → 출고 취소 → PRD-001 이력에 `−6 실판매출고`, `+6 출고취소` 두 줄, 재고 10 (T-S3-1)
- [ ] `large` 시드에서 이력 첫 20건 → [더 보기] → 다음 20건 (T-S4-2 화면 쪽)
- [ ] 허용 안 된 전이는 버튼이 없고, API로 보내도 서버 오류가 배너에 표시됨

## 테스트 방법

- 자동: E2E `step3.spec.ts`(sorek-charlie)
- 직접: 위 '다 됐다' 순서대로

## 실제 동작 확인 항목 (리뷰어 skygaul)

- [ ] 입고 확정 → 재고보다 많이 출고된 상태에서 [입고 취소] → 거부 메시지 (재고 부족)

## 결과 (담당자가 채움)

- 한 것:
- 직접 확인한 것:
- 확인 못 한 것:
- AI가 틀린 것과 고친 과정:
- PR:
