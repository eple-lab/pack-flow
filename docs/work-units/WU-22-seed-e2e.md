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

## 입력 · 오류 처리 ([04](../04-api-contract.md) 4절)

- `step2.spec.ts`에 T-VAL-6을 넣는다: 로그인 → 세션 쿠키 삭제 → [출고] → `/login?next=/trades` → 다시 로그인 → `/trades`로 돌아옴

## 다 됐다의 기준

- [ ] 세 벌 각각 초기화 직후 T-INV-1 0행, 대시보드 API 값 = `expected` (T-S4-1 정답 부분)
- [ ] `npm run test:e2e -- step1 step2` 통과 (로컬)
- [ ] 시드 파일에 실제 이름 · 이메일 없음
- [ ] T-VAL-6 통과

## 테스트 방법

- 자동: `npm run test:db -- tests/db/seed.test.ts`, `npm run test:e2e -- tests/e2e/step1.spec.ts tests/e2e/step2.spec.ts`
- 배포 URL 확인은 WU-42에서 `E2E_BASE_URL`로 한 번

## 실제 동작 확인 항목 (리뷰어 jkspawn)

- [x] `large`의 `expected`를 아무 품목 하나 골라 손으로 다시 계산해 일치 확인 — 11/24 eple(실제 PR #40 승인자): `LRG-003` = 10 + 6 + 3 − 2 − 3 = **14** = `large.json` 정답 14 (다른 이벤트 없음 확인)
- [ ] E2E 직접 실행 → 통과 — 11/24 eple 회귀(배포 URL): T-S1-1 · T-S1-2 · T-VAL-6 등 통과, **T-S4-1은 시드 JSON import 오류로 실패 → #69로 수정, 재실행 확인 남음**

## 결과 (담당자가 채움)

- 한 것: demo 품목 8개 · 구매 4건 · 판매 6건, small 품목 5개 · 이력 20건, large 품목 10개 · 이력 50건 초안 작성. DB · 회귀 · E2E 케이스 추가.
- 직접 확인한 것:

| ID | 시험 | 기대 | 실제 | 판정 |
|---|---|---|---|---|
| C-01 | 시드 규모 검산 | demo 8품목, small 5품목·20이력, large 10품목·50이력 | 3건 일치 | 통과 |
| C-02 | `lint` → `typecheck` → `test:unit` | 모두 통과 | 시드 로더 등록 및 기존 demo 가정 갱신 후 lint·typecheck·단위 688건 통과 | 통과 |
| T-S4-1 | 회귀 정답 비교 · `test:db -- tests/db/seed.test.ts` | 세 시드의 재고·원장이 정답과 일치 | 회귀 6건 통과. dev DB에서 테스트 계정 A로 세 시드를 적재하고 재고·원장 검사 3건 통과 | 통과 |
| C-03 | E2E 목록 확인 | 케이스 수집 | step1·step2에서 6건 수집 | 통과 |
| T-S1-1 · T-S1-2 | 로컬 Chrome에서 로그인 후 출고·부분 입고 | 로그인 후 시드 초기화 및 입출고 완료 | localhost에서 테스트 계정 A 로그인 성공. `POST /api/seed`가 501 `PF_NOT_IMPLEMENTED`를 반환해 시드 초기화 단계에서 중단 | 미확인 |
| C-04 | PR #38(`e2c7bec`) 격리 서버에서 직접 DB 시드 후 Chrome 검증 | 세 시드 대시보드 정답 일치, 출고·부분 입고·계정 격리·세션 복귀 | 대시보드 세 벌 일치, PRD-001 10→4→12 및 품절 임박, A 재로그인 후 4개 유지·B에서 미표시, 세션 삭제 후 로그인·판매 탭 복귀 확인 | 통과 |
| C-05 | 배포 URL에서 테스트 계정 A·B로 Step 1·2 확인 | 화면 입고 → 출고 → 대시보드 갱신, 다른 계정 조회·수정 거부 | DB 함수로 demo를 적재한 뒤 Chrome에서 PRD-001 재고 10→18→12, 전체 재고 120 확인. B 구매 목록에 A 구매가 없고, B 입고 요청은 404 `PF_NOT_FOUND`, A 구매·재고 유지 | 통과 |
| C-06 | 통합 브랜치 `test:db` | 기존 API·DB 테스트와 WU-22 검증 모두 통과 | dev 테스트 계정으로 12파일 61건 통과 | 통과 |

- 확인 못 한 것: 이 PR이 반영된 배포본에서 `POST /api/seed`로 세 시드를 초기화하는 E2E 6건. C-04·05는 테스트 계정 JWT로 DB 시드 함수를 직접 호출했다.
- AI가 틀린 것과 고친 과정:
- PR:
