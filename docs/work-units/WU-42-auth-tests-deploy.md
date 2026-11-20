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

- [ ] T-AUTH-1~8 모두 통과 (로컬 dev)
- [ ] 배포 URL에서 Step 1 · 2 E2E 통과
- [ ] 증거 문서에 키 · 비밀번호 · 이메일 없음

## 결과

- 한 것 / 직접 확인한 것 / 확인 못 한 것 / PR:
