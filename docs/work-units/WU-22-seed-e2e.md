# WU-22 시드 데이터 3벌 · 정답표 · E2E Step 1 · 2

- 담당: sorek-charlie / 검증: jkspawn / Step 1 · 2 · 4(정답표) / Wave 1 · 11/23(월) 오후
- 브랜치: `feat/WU-22-seed-e2e`
- 의존: WU-08(초기화 함수 · 로더 · 테스트 도우미 — eple, main에 있음), WU-21(재고 함수), WU-11 · 12(화면 testid — 없으면 E2E는 화면 병합 뒤 마무리)

## 왜 (근거)

계획서 7절 시드 규모, Step 4 "소량 · 대량 두 벌, **미리 구한 정답**과 일치". E2E는 완료 판정 1 · 2와 Step 2(재로그인 · B 격리)를 화면으로 증명한다. 초기화 함수 · 로더 · 도우미 같은 **구조는 eple이 만들어 두었고**, 이 WU는 **데이터와 정답, 테스트 케이스**만 맡는다.

## 읽을 파일

- [03](../03-data-model.md) 7절(시드 형식), 계획서 7절 시드 예시
- [07 테스트](../07-test-strategy.md) 2 · 3절
- `src/lib/seed/index.ts`(형식 검사 규칙), `tests/e2e/helpers.ts`, `tests/db/helpers.ts`(사용법만)
- WU-11 · WU-12 문서의 testid 표

## 만들 · 고칠 파일 (내 구역만)

- `src/lib/seed/demo.json`(eple의 첫 판을 넓힘), `small.json`, `large.json`
- `tests/db/seed.test.ts`, `tests/regression/seed-expected.test.ts`
- `tests/e2e/step1.spec.ts`, `tests/e2e/step2.spec.ts`

## 하지 말 것

- 실제 거래처명 · 상품 · 매출을 시드에 쓰지 않는다(가상)
- `pf_reset_and_seed` · 로더 · 도우미 수정(eple 구역 — 버그면 eple에게 알림)
- `expected`를 스크립트나 AI로 계산(손으로 구해야 검산이 된다)

## 고치는 방법

1. `demo.json`: 품목 8~12, 구매 4~5, 판매 6~8. 계획서 예시 PRD-001~003 · P-101 · S-201 · S-202를 그대로 포함(완료 판정이 바로 이어지게). PRD-003은 진행 중 구매 없이 둔다(완료 판정 5 시연용, WU-32 참고). `expected`에 KPI · 품목별 재고
2. `small.json`(품목 5 · 이력 20), `large.json`(품목 10 · 이력 50): `events`로 이력을 만든다. `expected`는 **손으로** 계산해 적는다
3. `seed.test.ts`: 세 벌 각각 초기화 → `assertInvariants` → 대시보드 집계 = `expected`
4. E2E `step1.spec.ts`: 초기화(demo) → S-201 출고 → 재고 4 · `alert-card-PRD-001` · 대시보드 숫자 → P-101 8개 입고 → 재고 12
5. E2E `step2.spec.ts`: A 로그인 → 출고 → 로그아웃 · 재로그인 → 같은 값 / B 로그인 → A 품목 안 보임

## 다 됐다의 기준

- [ ] 세 벌 각각 초기화 직후 T-INV-1 0행, 대시보드 API 값 = `expected` (T-S4-1 정답 부분)
- [ ] `npm run test:e2e -- step1 step2` 통과 (로컬)
- [ ] 시드 파일에 실제 이름 · 이메일 없음

## 테스트 방법

- 자동: `npm run test:db -- tests/db/seed.test.ts`, `npm run test:e2e -- tests/e2e/step1.spec.ts tests/e2e/step2.spec.ts`
- 배포 URL 확인은 WU-42에서 `E2E_BASE_URL`로 한 번

## 실제 동작 확인 항목 (리뷰어 jkspawn)

- [ ] `large`의 `expected`를 아무 품목 하나 골라 손으로 다시 계산해 일치 확인
- [ ] E2E 직접 실행 → 통과

## 결과 (담당자가 채움)

- 한 것:
- 직접 확인한 것:
- 확인 못 한 것:
- AI가 틀린 것과 고친 과정:
- PR:
