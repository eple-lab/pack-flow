# WU-24 회귀 테스트 · E2E Step 3 · 응답 시간 측정

- 담당: sorek-charlie / 검증: jkspawn / Step 4 / Wave 3 · 11/25(수) (회귀 실행은 11/24 저녁부터)
- 브랜치: `feat/WU-24-regression`
- 의존: Wave 1 · 2 병합, WU-45(회귀 실행기 · 측정 스크립트 — eple)

## 왜 (근거)

계획서 Step 4 "Step 1~3 · 5의 통과 테스트를 '시드 초기화 → 실행 → 결과표' 회귀 테스트로 묶어 병합 전마다", "대량 데이터 응답 시간 기록". 제출물 '테스트 결과표'의 원본이다.

## 읽을 파일

- [07 테스트 전략](../07-test-strategy.md) 전체 (특히 2절 표와 5절 양식)
- WU-13 · WU-14 testid, 기존 `tests/**`

## 만들 · 고칠 파일 (내 구역만)

- `tests/e2e/step3.spec.ts`(취소 · 거부 · 일괄 등록 화면)
- 회귀 실행기 `tests/regression/run.ts` · 측정 스크립트 `measure.ts`는 eple 구역(WU-45). 이 WU는 **실행하고 결과를 판정 · 기록**한다
- `docs/records/regression-<YYYYMMDD-HHmm>.md`(스크립트 출력), `docs/records/performance.md`
- `package.json`의 스크립트 이름이 필요하면 eple에게 요청(이미 `test:regression` 자리 있음)

## 하지 말 것

- 실패한 테스트를 지워서 통과시키기. 실패는 결과표에 그대로 남기고 담당자에게 알린다
- 결과표에 계정 이메일 · 비밀번호 쓰기

## 고치는 방법

1. `step3.spec.ts`: 출고 취소 → 이력 −6 · +6 / 재고 초과 출고 → `error-banner` / 일괄 등록 10행 → 7행
2. `npm run test:regression`(WU-45 실행기) → 생성된 결과표의 실패 항목마다 메모에 원인 추정 · 담당 WU를 적는다
3. `measure.ts` 실행: 로컬 → dev, 배포 URL → demo 두 대상. 결과 `docs/records/performance.md`에 측정 환경(PC · 네트워크) 한 줄 덧붙임
4. 11/24 저녁부터 매일 마감 통합 때 `npm run test:regression` → 결과 파일 커밋
5. 실패 항목은 결과표 메모에 담당 WU를 적고 팀 채널에 공유

## 다 됐다의 기준

- [ ] [07](../07-test-strategy.md) 2절 표의 모든 ID가 결과표에 한 줄씩 (통과 · 실패 · 건너뜀 중 하나)
- [ ] 11/25 기능 고정 시점 결과표 **전부 통과**, 배포 URL 대상 E2E 1회 통과
- [ ] `performance.md`에 측정 환경 · 행 수 · p50 · 최대 · 첫 호출
- [ ] 회귀 결과표가 병합 전 결과로 2개 이상 남아 있음 (T-S4-3)

## 테스트 방법

- 자동: `npm run test:regression`, `E2E_BASE_URL=<배포 URL> npm run test:e2e`

## 실제 동작 확인 항목 (리뷰어 jkspawn)

- [ ] `npm run test:regression`을 자기 PC에서 한 번 돌려 같은 결과

## 결과 (담당자가 채움)

- 한 것:
- 직접 확인한 것:
- 확인 못 한 것:
- PR:
