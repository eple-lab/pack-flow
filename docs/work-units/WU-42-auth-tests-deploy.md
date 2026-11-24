# WU-42 권한 테스트 · 배포 검증 (Step 1 · 2 완료 판정)

- 담당: eple / 검증: sorek-charlie / Step 2 / Wave 1 · 11/23(월) 마감 전
- 브랜치: `feat/WU-42-auth-tests`
- 의존: WU-41, WU-22(E2E Step 1 · 2)

## 왜 (근거)

완료 판정 6 "B가 A의 품목 ID로 API를 직접 호출 → 거부", 피드백 기준 3 '권한 거부 증거', 공통 진행표 2일차 "다른 팀원이 배포 URL에서 테스트".

## 읽을 파일

- [05](../05-security.md) 3절 T-AUTH-1~8, [07](../07-test-strategy.md) 2절

## 만들 · 고칠 파일 (내 구역만)

- `tests/api/auth.test.ts`(T-AUTH-1~3 · 7 · 8), `tests/api/rls.test.ts`(T-AUTH-4~6: Supabase REST 직접 호출)
- `docs/records/eple-step2-evidence.md`(RLS 정책 원문 요약, 테스트 결과)

## 고치는 방법

1. T-AUTH 자동화(테스트 계정 A · B 두 개 로그인 → 서로의 id로 호출)
2. main을 Render에 배포(demo 마이그레이션 최신인지 확인)
3. 검증자 sorek-charlie가 **배포 URL에서** WU-22 E2E 실행: `E2E_BASE_URL=<배포 URL> npm run test:e2e -- step1 step2`
4. 결과를 계획서 2절 변경 이력에 "Step 1 · 2 완료/일부"로 기록

## 다 됐다의 기준

- [x] T-AUTH-1~8 모두 통과 (로컬 dev)
- [x] 배포 URL에서 Step 1 · 2 E2E 통과
- [x] 증거 문서에 키 · 비밀번호 · 이메일 없음

## 테스트 방법

- 자동: `npm run test:db -- tests/api/auth.test.ts` (T-AUTH: 테스트 계정 A · B 두 개로 로그인 → 서로의 id로 호출)
- 직접: 배포 URL에서 `E2E_BASE_URL=<배포 URL> npm run test:e2e -- step1 step2` (검증자 sorek-charlie). 결과를 계획서 2절 변경 이력에 "Step 1 · 2 완료/일부"로 기록
- 준비: `.env.local`의 테스트 계정 A · B (값은 적지 않는다). E2E 대상 주소는 환경변수 `E2E_BASE_URL`로만 지정하고 파일에 적지 않는다

## 결과

(작성: eple 세션의 Claude, 2026-11-23)

- 한 것: `tests/api/auth.test.ts`(T-AUTH-1 · 2 · 3 · 7 · 8 + 2b — 라우트를 계정 A · B로 실제 dev에 호출), `tests/api/rls.test.ts`(T-AUTH-4 · 5 · 6 + 6b — B의 JWT로 Supabase REST 직접), 증거 [records/eple-step2-evidence.md](../records/eple-step2-evidence.md)(겹별 권한 · RLS 정책 요약 · 함수 실행 권한 실측)
- 직접 확인한 것: T-AUTH 10건 dev 통과(작성자), 리뷰어 sorek-charlie가 자기 계정으로 10건 독립 실행 통과. T-AUTH-7은 #41에서 실제 `POST /api/seed` 라우트로 바꿔 통과. 배포 URL(Render `pack-flow`) Playwright E2E Step 1 · 2 6건 통과(sorek-charlie, 11/23 19시 30분 무렵 — day-02 판정 3). 증거 문서 비밀값 검사 통과
- 확인 못 한 것: 없음(배포 E2E는 검증자 실행 결과를 옮김)
- AI가 틀린 것과 고친 과정: 없음
- PR: #39 (리뷰 sorek-charlie, 병합 11/23 18:49)
