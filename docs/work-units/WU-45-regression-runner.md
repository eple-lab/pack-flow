# WU-45 회귀 실행기 · 측정 스크립트

- 담당: eple / 검증: sorek-charlie / Step 4 / Wave 2 · 11/24(화) 오후 (11/24 저녁 첫 회귀 실행 전)
- 브랜치: `feat/WU-45-regression-runner`
- 의존: WU-08(테스트 도우미), WU-22(시드 `small` · `large`)

## 왜 (근거)

계획서 Step 4 "Step 1~3 · 5의 통과 테스트를 '시드 초기화 → 실행 → 결과표' 회귀 테스트로 묶어 병합 전마다", "대량 데이터에서 응답 시간 기록". 실행기는 구조 작업이라 eple이 만들고, 실행 · 판정은 sorek-charlie(WU-24)가 한다.

## 읽을 파일

- [07 테스트 전략](../07-test-strategy.md) 1절 명령 표, 5절 결과표 · 측정 양식
- 내 파일 `tests/db/helpers.ts`, `tests/e2e/helpers.ts`, `vitest.config.ts`, `playwright.config.ts`

## 만들 · 고칠 파일 (내 구역만)

- `tests/regression/run.ts`, `tests/regression/measure.ts`
- `package.json` 스크립트 `test:regression`, `measure`

## 하지 말 것

- 결과표 · 측정 기록에 계정 이메일 · 비밀번호 · URL의 키 쓰기
- 테스트 케이스 파일 수정(sorek-charlie 구역)

## 고치는 방법

1. `run.ts`: `small` 시드 초기화 → Vitest(`test:db`) · Playwright(`test:e2e`)를 JSON 리포터로 실행 → 테스트 이름 앞의 ID(`T-S1-1` 등)로 묶어 [07](../07-test-strategy.md) 5절 양식의 표를 `docs/records/regression-<YYYYMMDD-HHmm>.md`로 생성. 머리에 커밋 해시 · 대상(로컬/배포) · 시드 · 실행자 계정 아이디
2. 테스트 이름 규칙을 sorek-charlie와 맞춘다: `it('T-S1-1 재고 10에서 6개 출고 …')`처럼 ID로 시작. ID 없는 테스트는 표의 '기타'로
3. `measure.ts`: `small` · `large` 각각 `GET /api/dashboard` · `GET /api/stock-logs`를 10회, 첫 호출은 따로, p50 · 최대 → `docs/records/performance.md`에 행 추가. 대상은 `E2E_BASE_URL`(로컬 또는 배포)
4. 종료 코드: 실패가 하나라도 있으면 1 (나중에 Actions에 붙일 수 있게)

## 다 됐다의 기준

- [x] `npm run test:regression` → 결과표 파일 생성, 일부러 실패시킨 테스트 1개가 '실패'로 표시되고 종료 코드 1 (확인 뒤 되돌림)
- [x] `npm run measure` → `performance.md`에 두 시드 행 추가
- [x] 생성 파일에 이메일 · 키 없음(비밀값 검사 통과)

## 테스트 방법

- 자동: `npm run test:regression` → `docs/records/regression-<YYYYMMDD-HHmm>.md` 생성. 일부러 실패시킨 테스트 1개가 '실패'로 나오고 종료 코드가 1인지 확인한 뒤 되돌린다. `npm run measure` → `docs/records/performance.md`에 두 시드 행 추가
- 직접: 자기 PC에서 `npm run test:regression`을 돌려 같은 형식의 결과표가 나오는지 본다 (리뷰어 sorek-charlie, 아래 확인 항목)
- 준비: 실행 파일(`tests/regression/run.ts` · `tests/regression/measure.ts`)은 이 브랜치에 없다. PR #49(`feat/WU-45-regression-runner`, 커밋 `faa6897`)에 있으니 그 PR을 받은 뒤 돌린다. `test:db`가 필요하므로 `.env.local`의 dev 프로젝트와 본인 계정을 준비한다

## 실제 동작 확인 항목 (리뷰어 sorek-charlie)

- [ ] 자기 PC에서 `npm run test:regression` → 같은 형식의 결과표

## 결과

(작성: eple 세션의 Claude, 2026-11-23. 구현은 하위 에이전트(Sonnet), 확인은 관리 세션)

- 한 것: `tests/regression/run.ts`(small 시드 → test:db · test:e2e · seed-expected → ID별 결과표 `docs/records/regression-<시각>.md`, 실패 시 종료 1, E2E 대상이 없으면 '미실행'), `tests/regression/measure.ts`(small · large, 대시보드 · 이력 첫 호출 + 10회 p50 · 최대 → `performance.md`), 순수 함수 `scripts/regression/report.ts`(시험 23개) · 세션 `session.ts`(쿠키 세션, 서비스 키 없음), 기록 파일 가리기, `npm run measure`
- 직접 확인한 것: 회귀 실행 통과 52 · 실패 0 · E2E 미실행 1(종료 0), 임시 실패 시험 C-99 → 표에 실패 · 종료 1 → 지운 뒤 종료 0. dev 배포 측정: small 대시보드 p50 669ms · 이력 213ms, large 640ms · 212ms. 생성 파일 비밀값 검사 통과(시험 산출물은 커밋 안 함). lint · typecheck · unit 724개 통과(관리 세션 재실행)
- 확인 못 한 것: E2E(Playwright) 실행 경로 — 이 PC에 브라우저 · 로컬 서버가 없어 리뷰어 PC에서 첫 확인. import 4곳 `@ts-expect-error TS5097`(tsconfig `allowImportingTsExtensions`는 eple 결정)
- AI가 틀린 것과 고친 과정: 테스트 ID 정규식이 `T-AI-1a` 같은 접미사를 못 잡아 '기타'가 24줄 → 기대 시험을 먼저 추가해 실패를 확인한 뒤 정규식 수정, 기타 0줄. [ai-cases-eple](../records/ai-cases-eple.md) 사례 3
- PR: #49 (리뷰 sorek-charlie) — 병합 11/24 12:31 (`65d72d1`)
