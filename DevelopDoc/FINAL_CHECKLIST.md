# PackFlow 최종 체크리스트 (FINAL_CHECKLIST)

작성일: 2026-11-23 · 근거: [계획서](../docs/pack-flow-plan.md) 13 · 14절, [07 테스트 전략](../docs/07-test-strategy.md) 6절, [WU-44](../docs/work-units/WU-44-final.md) · 상태: **초안 — 11/25 최종 점검에서 갱신** · 11/24 밤 사실 대조 반영

사용법: 11/25 최종 점검 때 eple이 증거를 직접 열어 확인한 뒤 `[ ]`를 `[x]`로 바꾼다. 11/24 밤에 근거 파일을 열어 확인한 일부 칸(GitHub 저장소 · 팀 목표 합의서 · Step 2 · 3 · 5 증거)만 `[x]`로 바꿨고, 나머지는 **아직 체크하지 않은 상태**다. 이미 증거가 있는 항목은 링크만 달아 두었다(링크가 있어도 최종 확인 전에는 체크하지 않는다). 증거가 없는 칸은 "(11/25 확인)". 제출 마감은 11/26(목) 10:00.

## 1. 필수 제출물 (상위 페이지 4절)

- [x] GitHub 저장소 링크 — https://github.com/eple-lab/pack-flow
- [ ] `README.md`(저장소 최상단) — 서비스 소개, 배포 URL, 테스트 방법, 제출 커밋 식별자 — [README.md](../README.md) (제출 커밋은 11/26 기록)
- [ ] `DevelopDoc/PRD.md` — 문제 · 사용자 · 시나리오 · Step · 하지 않을 기능 — [PRD.md](PRD.md) (초안)
- [ ] `DevelopDoc/TECH_SPEC.md` — 아키텍처 · 데이터 구조 · 상태 전이 · 스택 · 비용 — [TECH_SPEC.md](TECH_SPEC.md) (초안)
- [ ] `DevelopDoc/WORK_UNITS.md` — 작업 단위별 완료 조건 체크리스트 — [WORK_UNITS.md](WORK_UNITS.md) (초안, 11/25에 다시 셈)
- [ ] `DevelopDoc/FINAL_CHECKLIST.md` — 이 문서
- [ ] 시연 · 체험 URL(Render) — dev https://pack-flow.onrender.com · 시연 https://pack-flow-demo.onrender.com (11/26 오전 시연용 URL 동작 확인)
- [ ] 발표 자료 — 역할 분담, 개발 일정 포함 — (11/25 확인)

## 2. 공통 안내 '제출과 시연' (README나 개발 문서에 함께)

- [x] 팀 목표 합의서와 변경 이력 — [계획서 2절](../docs/pack-flow-plan.md), 일자별 기록 [day-01](../docs/daily/day-01.md) · [day-02](../docs/daily/day-02.md) · [day-03](../docs/daily/day-03.md) · [day-04](../docs/daily/day-04.md)(4일차는 11/24 밤에 만든 뼈대, 11/25에 채움)
- [ ] 테스트 결과표(완료 판정 테스트 + 실패 사례: 빈 입력 · 재고 초과 · 권한 없음 각 1개 이상) — `docs/records/regression-<날짜>.md`, 양식 [07 5절](../docs/07-test-strategy.md). 11/24 결과: [14:15 로컬](../docs/records/regression-20261124-1415.md) · [16:00 배포 dev, 커밋 2e5ef63, 통과 66 / 실패 0 / 건너뜀 0](../docs/records/regression-20261124-1600.md). 최종 결과표는 11/25 확인
- [ ] AI 활용 · 디버깅 사례 3개 — 계정별 [jkspawn](../docs/records/ai-cases-jkspawn.md) · [skygaul](../docs/records/ai-cases-skygaul.md), eple 사례(문서 PR 병합 후 `docs/records/ai-cases-eple.md`), 모음 `docs/records/ai-cases.md` (11/25 확인)
- [ ] 팀원별 기여 · 회고 — (11/25 확인)
- [ ] 짧은 시연 영상(백업용 2분 영상 겸용) — (11/25 확인)
- [ ] 외부 코드 · 데이터 · 모델의 출처와 라이선스 — [README.md](../README.md) 해당 절 · 저장소 자체의 이용 범위: 루트 [LICENSE](../LICENSE), 의존 패키지 라이선스 정리 [docs/LICENSES.md](../docs/LICENSES.md) (최종 확인은 11/25)
- [ ] 시연 계정 비밀번호 · API 키가 공개 문서 · 저장소 이력에 없음 — 점검 기록 `docs/records/security-check-1125.md` (11/25 작성)

## 3. 피드백 기준 5개 — 증거 위치

기준 정의는 [계획서 14절](../docs/pack-flow-plan.md), 위치는 [07 6절](../docs/07-test-strategy.md). 판정(달성 / 부분 달성 / 미달성)은 11/25에 적는다.

| 기준 | 증거 | 위치 | 체크 | 판정 |
|---|---|---|---|---|
| 1 명확성 | 한 문장 · 대표 시나리오, 팀원 모두 같게 설명 | [PRD.md](PRD.md), [00 개요](../docs/00-overview.md), 발표 1 | [ ] | (11/25 확인) |
| 2 실제 동작 | 배포 URL에서 시나리오 재현, `E2E_BASE_URL` 실행 결과, 시연 영상 | [day-02 저녁 판정](../docs/daily/day-02.md)(2일차 Step 1 · 2 E2E 6건), 결과표 · 시연 영상(11/25 확인) | [ ] | (11/25 확인) |
| 3 테스트 · 권한 | T-AUTH · 실패 사례 결과표 | [eple-step2-evidence](../docs/records/eple-step2-evidence.md), `docs/records/regression-*.md` (11/25 확인) | [ ] | (11/25 확인) |
| 4 AI 검토 | AI 사례 3개(실패 원인 · 수정 · 재검증), 모의 · 실제 비교 | `ai-cases-<계정>.md`, `docs/records/ai-cases.md`, `docs/records/ai-limits.md` (11/25 확인) | [ ] | (11/25 확인) |
| 5 협업 · 전달 | 리뷰가 남은 PR, README만으로 재현, 기여 분산 | GitHub PR 목록, [README.md](../README.md), 다른 PC 재현 확인(11/25 확인) | [ ] | (11/25 확인) |

## 4. Step별 증거

- [ ] Step 1 — 입고 → 출고 → 대시보드 갱신 시연, 테스트 전후 DB 값 캡처 — [day-02](../docs/daily/day-02.md) 저녁 판정, [WU-22](../docs/work-units/WU-22-seed-e2e.md) 결과 (캡처: 11/25 확인)
- [x] Step 2 — 데이터 구조도, RLS 정책 설명 — [03 데이터 모델](../docs/03-data-model.md) 1 · 5절, [TECH_SPEC.md](TECH_SPEC.md) 3 · 7절, 권한 테스트 [eple-step2-evidence](../docs/records/eple-step2-evidence.md)
- [x] Step 3 — 상태 전이표 — [03 3절](../docs/03-data-model.md), [TECH_SPEC.md](TECH_SPEC.md) 4절
- [ ] Step 4 — 대량 데이터 측정 결과, 회귀 테스트 결과표 — `docs/records/regression-*.md` (11/25 확인)
- [x] Step 5 — AI 에이전트 허용 액션 목록 — [04 3.8절](../docs/04-api-contract.md), [TECH_SPEC.md](TECH_SPEC.md) 6절

## 5. 완료 판정 테스트 (계획서 2절)

자동화 위치는 [07 2절](../docs/07-test-strategy.md). 마지막 확인 결과: (11/25 확인)

- [ ] 1. 재고 10 · 안전재고 5 · 6개 출고 → 재고 4, 품절 임박 카드, 이력 -6 한 건
- [ ] 2. 구매 10개 주문, 8개 도착 입고 확정 → 재고 +8
- [ ] 3. 1번 출고 취소 → 재고 10 복원, '취소' 기록 남고 원래 기록 유지
- [ ] 4. 재고 4에서 챗봇 "50개 출고" → 거부, 남은 수량 안내
- [ ] 5. 발주서 초안 [확인] → '발주완료' 1건 / [취소] → 변화 없음
- [ ] 6. 사용자 B가 A의 ID로 API 호출 → 거부, A의 데이터 변화 없음

## 6. WU-44 완료 기준 (11/25 ~ 11/26)

- [ ] 이 문서의 전 항목 체크
- [ ] 다른 PC(팀원)에서 README만 보고 실행 성공(피드백 기준 5)
- [ ] 저장소 전체(커밋 이력 포함)에 키 · 비밀번호 · 실제 이메일 · 실명 없음
- [ ] 11/25 오전: 열린 PR 정리 · 병합 → 기능 고정 선언
- [ ] 회귀 테스트 전부 통과 + 배포 URL E2E 1회
- [ ] 보안 점검(`eple-security-check`) → `docs/records/security-check-1125.md`
- [ ] 발표 자료에 역할 분담 · 개발 일정 확인
- [ ] 11/26 오전: demo를 `demo` 시드로 초기화, Render · Supabase 깨워 두기
- [ ] 제출 커밋 해시를 README에 기록 → 10:00 전 제출
