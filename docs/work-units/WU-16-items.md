# WU-16 품목 화면 (목록 · 등록 · 수정)

- 담당: jkspawn / 검증: skygaul / Step 1 / Wave 1 · 11/23(월) 오후 (WU-11 · 12 다음)
- 브랜치: `feat/WU-16-items`
- 의존: WU-41(`/api/items` 실제 연결), WU-05(내비의 '품목' 자리)

## 왜 (근거)

계획서 5절 "품목 · 거래처 마스터 (최소화): 시드 데이터 기반 품목 · 안전재고 · 거래처 목록 조회". 처음에는 시드로 대체하려 했으나(09 F-05), 시연 · 실사용에서 품목을 추가하고 안전재고를 고칠 수 있어야 해서 **최소 화면을 추가**했다(2026-11-20 eple 결정). 재고 수량은 이 화면에서 바꿀 수 없다 — 설계 원칙 "재고는 이력의 합".

## 읽을 파일

- [04 API 계약](../04-api-contract.md) 3.2절(품목 라우트), 2절(오류 코드 `PF_DUPLICATE_SKU` · `PF_VALIDATION`)
- [화면 구성](../wireframes.html) 5.4절 `id="items"`(이 화면 그림 · 설명)
- `src/types/erp.ts`(`Item`), `src/lib/api-client.ts`, `src/components/common/`(eple 소유 — 읽기만)
- 내 파일 `src/components/trades/PurchaseForm.tsx`(폼 모양을 맞추려고)

## 만들 · 고칠 파일 (내 구역만)

- `src/app/(app)/items/page.tsx`
- `src/components/items/ItemTable.tsx`, `ItemForm.tsx`, `ItemEditDialog.tsx`

## 하지 말 것

- 재고 수량 입력 칸을 만들지 않는다. 서버도 `stock_qty`를 받으면 400으로 거부한다(T-AUTH-5와 같은 원칙)
- 품목 삭제 버튼을 만들지 않는다(이력 · 거래가 품목을 참조한다 — 고도화 후보)
- 거래처 마스터 화면은 만들지 않는다(거래처는 구매 · 판매 행의 글자로만, MVP)
- 내비 · 레이아웃 수정(eple 구역 — '품목' 링크는 WU-05에서 이미 있음)

## 고치는 방법

1. 목록: 품목코드 · 이름 · 매입단가 · 판매가 · 안전재고 · 현재 재고(읽기 전용) · 상태(안전재고 미만 배지) · [수정]. 검색 칸(코드 · 이름, 화면에서 거르기)
2. 등록 폼: 품목코드(`PRD-` 형식 안내) · 이름 · 매입단가 · 판매가 · 안전재고 · 구매처 메모(선택) → `POST /api/items` → 새 품목은 재고 0으로 목록에 추가
3. 수정 창: 이름 · 단가 · 판매가 · 안전재고 · 구매처 메모만 → `PATCH /api/items/{sku_id}`. 품목코드는 읽기 전용
4. 화면 검증(편의): 단가 · 안전재고는 0 이상 정수, 이름 1~100자. 최종 판정은 서버 — 서버 오류는 공통 `ErrorBanner`
5. 구매처 메모(`source_url`)는 글자로만 보여 준다(링크로 열지 않음, [05](../05-security.md) 5절)
6. 품목 행의 [이력] 링크 → `/history?sku_id=`
7. testid

| 요소 | testid |
|---|---|
| 목록 행 · 재고 칸 | `item-row-<sku_id>`, `item-stock-<sku_id>` |
| 등록 폼 · 제출 | `form-item`, `btn-submit-item` |
| 수정 버튼 · 창 · 저장 | `btn-edit-item-<sku_id>`, `dialog-edit-item`, `btn-save-item` |
| 검색 | `item-search` |

## 입력 · 오류 처리 ([04](../04-api-contract.md) 4절)

- 등록 · 수정 폼은 `itemCreate` · `itemUpdate` 스키마로 검사, 틀린 칸 아래 `FieldError`. 품목코드는 입력 중 대문자로 바꾼다
- 단가 칸은 쉼표를 지우고 정수로. 구매처 메모를 비우면 `null`
- `PF_DUPLICATE_SKU`는 품목코드 칸 아래에(04 4.4). 저장 버튼은 `SubmitButton`

## 다 됐다의 기준

- [ ] lint · typecheck · test:unit 통과
- [ ] dev에서 새 품목 `PRD-101` 등록 → 목록에 재고 0으로 보임 → 구매 탭 품목 선택 목록에도 나타남
- [ ] 같은 품목코드 다시 등록 → `ErrorBanner`에 중복 안내, 목록 변화 없음
- [ ] 안전재고를 5 → 20으로 수정 → 대시보드 '안전재고 미만' 수와 품절 임박 카드가 바뀜
- [ ] 화면 어디에도 재고 수량 입력 칸이 없음
- [ ] 단가에 `8,5`(소수) → "숫자(정수)로 입력해 주세요", 품목코드 소문자 입력 → 대문자로 저장

## 테스트 방법

- 자동: E2E는 sorek-charlie가 필요하면 `step1.spec.ts`에 위 testid로 추가(선택). 본인은 `npm run test:unit`
- 직접: '다 됐다' 2~4번을 순서대로

## 실제 동작 확인 항목 (리뷰어 skygaul)

- [ ] 등록한 품목이 에이전트 대화에서 "PRD-101 재고 몇 개야?"로 조회됨(0개)
- [ ] 휴대폰 폭에서 목록이 깨지지 않음(가로 스크롤 허용)

## 결과 (담당자가 채움)

- 한 것:
- 직접 확인한 것:
- 확인 못 한 것:
- AI가 틀린 것과 고친 과정:
- PR:
