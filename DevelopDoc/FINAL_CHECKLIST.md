# PackFlow 최종 체크리스트 (FINAL_CHECKLIST)

작성일: 2026-11-23 · 근거: [계획서](../docs/pack-flow-plan.md) 13 · 14절, [07 테스트 전략](../docs/07-test-strategy.md) 6절, [WU-44](../docs/work-units/WU-44-final.md) · 상태: **제출본(11/26)** · 11/24 밤 사실 대조 · 11/26 오전 최종 점검 반영

사용법: 최종 점검(11/25 – 26 오전) 때 eple이 증거를 직접 열어 확인한 뒤 `[ ]`를 `[x]`로 바꾼다. 11/24 밤에 근거 파일을 열어 확인한 일부 칸(GitHub 저장소 · 팀 목표 합의서 · Step 2 · 3 · 5 증거)과 11/25 아침에 근거를 열어 본 칸(AI 사례 · 라이선스 · Step 4)만 `[x]`로 바꿨고, 나머지는 **아직 체크하지 않은 상태**다. 이미 증거가 있는 항목은 링크만 달아 두었다(링크가 있어도 최종 확인 전에는 체크하지 않는다). 증거가 없는 칸은 "(11/25 확인)". 제출 마감은 11/26(목) 10:00.

## 1. 필수 제출물 (상위 페이지 4절)

- [x] GitHub 저장소 링크 — https://github.com/eple-lab/pack-flow
- [x] `README.md`(저장소 최상단) — 서비스 소개, 배포 URL, 현업 적용, 테스트 방법, 제출 정보 — [README.md](../README.md)(상태: 제출본 11/26. 제출 커밋 해시는 제출 양식에 기록)
- [x] `DevelopDoc/PRD.md` — 문제 · 사용자 · 시나리오 · Step · 하지 않을 기능 — [PRD.md](PRD.md)
- [x] `DevelopDoc/TECH_SPEC.md` — 아키텍처 · 데이터 구조 · 상태 전이 · 스택 · 비용 — [TECH_SPEC.md](TECH_SPEC.md)
- [x] `DevelopDoc/WORK_UNITS.md` — 작업 단위별 완료 조건 체크리스트 — [WORK_UNITS.md](WORK_UNITS.md)(11/26 오전 다시 셈)
- [x] `DevelopDoc/FINAL_CHECKLIST.md` — 이 문서(11/26 오전 최종 점검)
- [x] 시연 · 체험 URL(Render) — dev https://pack-flow.onrender.com · 시연 https://pack-flow-demo.onrender.com (11/26 오전 두 서비스 `/api/health` 정상 확인. 평가용 시연 계정은 담당 퍼실리테이터에게 따로 전달)
- [x] 발표 자료 — 역할 분담, 개발 일정 포함 — 발표 원고 v3(26장, 5번 역할 분담 · 6번 일차별 일정, 11번 시연 영상 포함 pptx)

## 2. 공통 안내 '제출과 시연' (README나 개발 문서에 함께)

- [x] 팀 목표 합의서와 변경 이력 — [계획서 2절](../docs/pack-flow-plan.md), 일자별 기록 [day-01](../docs/daily/day-01.md) · [day-02](../docs/daily/day-02.md) · [day-03](../docs/daily/day-03.md) · [day-04](../docs/daily/day-04.md)(4일차는 11/24 밤에 만든 뼈대, 11/25에 채움)
- [x] 테스트 결과표(완료 판정 테스트 + 실패 사례: 빈 입력 · 재고 초과 · 권한 없음 각 1개 이상) — 제출용 결과서 [test-report.md](../docs/records/test-report.md)(총 68줄 · 통과 65 · 해당 없음 3, 실패 사례 표시), 근거 회귀 결과표 [regression-20261125-1056.md](../docs/records/regression-20261125-1056.md)
- [x] AI 활용 · 디버깅 사례 3개 — 발표용 모음 [ai-cases.md](../docs/records/ai-cases.md)(사례 3개, 원인 · 수정 · 재검증), 계정별 [eple](../docs/records/ai-cases-eple.md) · [jkspawn](../docs/records/ai-cases-jkspawn.md) · [skygaul](../docs/records/ai-cases-skygaul.md) (11/25 skygaul 최종 취합 뒤 링크만 다시 확인)
- [x] 팀원별 기여 · 회고 — 4명 모두 회고 · 리뷰 · AI 활용 현황: `docs/records/retrospective-<아이디>.md` · `review-<아이디>.md` · `ai-usage-<아이디>.md`(양식 `docs/records/templates/`)
- [x] 짧은 시연 영상(백업용 2분 영상 겸용) — 약 134초(skygaul v3) · 180초(sorek-charlie) 두 본, 화면 · 음성 확인(eple · skygaul · sorek-charlie). 파일은 비공개 작업 공간 · 발표 pptx 11번에 포함
- [x] 외부 코드 · 데이터 · 모델의 출처와 라이선스 — [README.md](../README.md)의 '외부 코드 · 데이터 · 모델의 출처와 라이선스' 항목 · 저장소 자체의 이용 범위: 루트 [LICENSE](../LICENSE), 의존 패키지 라이선스 정리 [docs/LICENSES.md](../docs/LICENSES.md)
- [x] 시연 계정 비밀번호 · API 키가 공개 문서 · 저장소 이력에 없음 — 점검 기록 [security-check-1125.md](../docs/records/security-check-1125.md)(키 · 실명 · 사용자 경로 0건)

## 3. 피드백 기준 5개 — 증거 위치

기준 정의는 [계획서 14절](../docs/pack-flow-plan.md), 위치는 [07 6절](../docs/07-test-strategy.md). 판정은 11/26 오전 최종 점검(eple 세션) — 근거 파일을 열어 확인한 범위에서 적었다.

| 기준 | 증거 | 위치 | 체크 | 판정 |
|---|---|---|---|---|
| 1 명확성 | 한 문장 · 대표 시나리오, 팀원 모두 같게 설명 | [PRD.md](PRD.md), [00 개요](../docs/00-overview.md), 발표 v4 4 · 5번 | [x] | 달성 |
| 2 실제 동작 | 배포 URL에서 시나리오 재현, `E2E_BASE_URL` 실행 결과, 시연 영상 | 최종 회귀(배포 dev) [test-report.md](../docs/records/test-report.md), 화면 직접 확인 [review-eple](../docs/records/review-eple.md) · [review-skygaul](../docs/records/review-skygaul.md), 시연 영상(발표 v4 15번) | [x] | 달성 |
| 3 테스트 · 권한 | T-AUTH · 실패 사례 결과표 | [test-report.md](../docs/records/test-report.md)(T-AUTH-1~8 · 실패 사례), [eple-step2-evidence](../docs/records/eple-step2-evidence.md), [security-check-1125](../docs/records/security-check-1125.md) | [x] | 달성 |
| 4 AI 검토 | AI 사례 3개(실패 원인 · 수정 · 재검증), 모의 · 실제 비교 | [ai-cases.md](../docs/records/ai-cases.md), `ai-cases-<계정>.md`, [ai-limits.md](../docs/records/ai-limits.md), `ai-usage-<아이디>.md` 4명 | [x] | 달성 |
| 5 협업 · 전달 | 리뷰가 남은 PR, README만으로 재현, 기여 분산 | GitHub PR 목록(승인 리뷰 뒤 병합), [README.md](../README.md), 회고 · 리뷰 4명, [13 고친 기록](../docs/13-fixes.md), README 새 설치 확인([6절](#6-wu-44-완료-기준-1125--1126)) | [x] | 달성 — README만으로 새 설치: 팀원 1명(skygaul) 본인 PC(로그인 · 시연 데이터 초기화까지), eple 새 폴더, 처음 보는 사람 점검(키 없는 단계 통과) (11/26 제출 뒤) |

## 4. Step별 증거

- [x] Step 1 — 입고 → 출고 → 대시보드 갱신 시연, 테스트 전후 DB 값 — [day-02](../docs/daily/day-02.md) 저녁 판정, [WU-22](../docs/work-units/WU-22-seed-e2e.md) 결과, 최종 회귀 T-S1-1 · 2 · 3a~c 통과([제출용 테스트 결과서](../docs/records/test-report.md)), 화면 직접 확인 [review-eple](../docs/records/review-eple.md)(118 → 112 → 120)
- [x] Step 2 — 데이터 구조도, RLS 정책 설명 — [03 데이터 모델](../docs/03-data-model.md) 1 · 5절, [TECH_SPEC.md](TECH_SPEC.md) 3 · 7절, 권한 테스트 [eple-step2-evidence](../docs/records/eple-step2-evidence.md)
- [x] Step 3 — 상태 전이표 — [03 3절](../docs/03-data-model.md), [TECH_SPEC.md](TECH_SPEC.md) 4절
- [x] Step 4 — 대량 데이터 측정 결과, 회귀 테스트 결과표 — 측정 [performance.md](../docs/records/performance.md)(로컬 서버 측정), 회귀 [regression-20261124-1600.md](../docs/records/regression-20261124-1600.md)(배포 dev, 통과 66 · 실패 0). 최종 회귀 [regression-20261125-1056.md](../docs/records/regression-20261125-1056.md)(배포 dev, 통과 66 · 실패 0)
- [x] Step 5 — AI 에이전트 허용 액션 목록 — [04 3.8절](../docs/04-api-contract.md), [TECH_SPEC.md](TECH_SPEC.md) 6절

## 5. 완료 판정 테스트 (계획서 2절)

자동화 위치는 [07 2절](../docs/07-test-strategy.md). 마지막 확인 결과: 11/25 10:56 최종 회귀(배포 dev, `45c4763`) — [제출용 테스트 결과서](../docs/records/test-report.md)

- [x] 1. 재고 10 · 안전재고 5 · 6개 출고 → 재고 4, 품절 임박 카드, 이력 -6 한 건 (T-S1-1 통과)
- [x] 2. 구매 10개 주문, 8개 도착 입고 확정 → 재고 +8 (T-S1-2 통과)
- [x] 3. 1번 출고 취소 → 재고 10 복원, '취소' 기록 남고 원래 기록 유지 (T-S3-1 통과)
- [x] 4. 재고 4에서 챗봇 "50개 출고" → 거부, 남은 수량 안내 (T-AI-2 통과)
- [x] 5. 발주서 초안 [확인] → '발주완료' 1건 / [취소] → 변화 없음 (T-AI-1a 통과)
- [x] 6. 사용자 B가 A의 ID로 API 호출 → 거부, A의 데이터 변화 없음 (T-AUTH-1~8 통과)

## 6. WU-44 완료 기준 (11/25 ~ 11/26)

- [x] 이 문서의 전 항목 체크 — 11/26 README 새 설치 확인 뒤 전 항목 체크(제출 뒤)
- [x] 다른 PC(팀원)에서 README만 보고 실행 성공(피드백 기준 5) — 팀원 4명이 각자 PC에서 로컬 실행 · 개발함([day-02](../docs/daily/day-02.md)). 11/26 새 설치 확인 — ① eple(README 작성자)이 같은 PC의 새 폴더에 새로 clone해 README 순서대로 실행 성공: `npm ci`(4분) · 훅 자동 설치 · `npm run dev` · `/api/health` 200 · `/login` 이동 · 로그인 뒤 대시보드(품목 8 · 재고 합계 118) 확인. `.env.local`은 기존 값을 복사함(값은 원래 전달받는 단계, `.env.example` 16개 키에 설명 있음) ② 처음 보는 사람 관점 점검(eple 세션의 하위 에이전트, 새 clone · README와 `.env.example`만 읽음): 키 없이 `npm ci` · `lint` · `typecheck` · `test:unit`(49파일 · 869개) 통과, 키가 필요한 단계는 하지 않음. README에서 보완할 곳 12개 · `.env.example` 애매한 키 8개를 찾음(README 보완은 제출 뒤 별도) ③ 팀원 1명(skygaul)이 본인 PC의 새 폴더에 새로 clone해 README 순서대로 `npm ci`(385개 · 취약점 0) · 훅 · `.env.local` · `npm run dev` · 로그인 · 대시보드 · [시연 데이터 초기화](재고 합계 115 → 118 복원)까지 성공. Node 26이라 `EBADENGINE` 경고만 남, 첫 `npm ci`에서 일시적 다운로드 재시도 1회, README 2단계 `cd` 순서 혼동 1회 — README 보완 목록에 더함. Node 24 다른 PC 확인은 없음
- [x] 저장소 전체(커밋 이력 포함)에 키 · 비밀번호 · 실제 이메일 · 실명 없음 — 보안 점검 기록 참고(커밋 작성자 메일 3건은 알고 둠)
- [x] 11/25 오전: 열린 PR 정리 · 병합 → 기능 고정 선언 — 기능 동결은 11/24 14:00, 이후 버그 수정(#84 · #90 · #94) · 문서만 병합
- [x] 회귀 테스트 전부 통과 + 배포 URL E2E 1회 — 11/25 10:56 배포 dev 통과 66 · 실패 0
- [x] 보안 점검(`eple-security-check`) → [security-check-1125.md](../docs/records/security-check-1125.md)
- [x] 발표 자료에 역할 분담 · 개발 일정 확인 — v3 5 · 6번
- [x] 11/26 오전: demo를 `demo` 시드로 초기화, Render · Supabase 깨워 두기 — eple이 demo 계정 A로 [시연 데이터 초기화] 실행, 대시보드 품목 8 · 재고 합계 118 · 안전재고 미만 3 확인(화면 캡처). dev · demo `/api/health` 200
- [x] 제출 커밋 해시를 제출 양식에 기록(README에는 "제출 시점 main 마지막 병합 커밋"으로 안내) → 10:00 전 제출 — 11/26 10:00 전 제출 완료(eple), 제출 커밋 `afbc8cd`(afbc8cdb28502992b7d8293952b120263792c671, #102까지)
