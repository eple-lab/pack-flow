# 작업 단위 (Work Units)

작성일: 2026-11-20 · 규칙: [06 작업 계획](../06-work-plan.md) · 계약: [04 API 계약](../04-api-contract.md) · 테스트: [07 테스트 전략](../07-test-strategy.md)

## 쓰는 법

1. 아래 표에서 **내 WU**를 연다. 의존 칸의 WU가 병합됐는지 확인한다.
2. `git switch main && git pull` → `git switch -c feat/WU-번호-주제`
3. WU 문서의 **읽을 파일**만 읽고, **만들 · 고칠 파일(내 구역)**만 고친다.
4. AI 코딩 도구에 맡길 때는 WU 문서를 통째로 주고 이렇게 요청한다.
   > 이 WU 문서의 '읽을 파일'만 읽고, '만들 · 고칠 파일'만 고쳐 줘. '하지 말 것'은 지켜 줘. 끝나면 '다 됐다의 기준'의 명령을 돌리고, 한 것 / 직접 확인한 것 / 확인 못 한 것으로 보고해 줘.
5. **다 됐다의 기준**을 직접 돌려 확인한다(AI의 "다 됐어요"를 그대로 믿지 않는다).
6. WU 문서 맨 아래 **결과** 절을 채운다. AI가 틀렸다가 고친 일이 있으면 `docs/records/ai-cases-<내 계정>.md`에 한 건 남긴다(사람별 파일 — 병합 충돌 방지).
7. push → PR(본문 양식은 06 4절) → 검증자 리뷰 → merge commit.

하위 작업이 필요하면 자기 번호 범위 안에서 새 WU 문서를 만든다(`_template.md` 복사). jkspawn `1x`, sorek-charlie `2x`, skygaul `3x`, eple `0x · 4x`.

## 목록

| WU | 제목 | 담당 | 검증 | Wave · 날짜 | Step | 의존 |
|---|---|---|---|---|---|---|
| [WU-01~08](WU-00-skeleton.md) | 골격 (프로젝트 · DB · 인증 · stub · 화면 자리 · 배포 · 이 문서들 · 테스트 기반 · 초기화 함수) | eple | — (main 직접) | 0 · 11/20~22 | 2 일부 | — |
| [WU-11](WU-11-dashboard.md) | 대시보드 | jkspawn | skygaul | 1 · 11/23 | 1 | WU-04(목), WU-41 |
| [WU-12](WU-12-trades.md) | 입출고 화면 | jkspawn | skygaul | 1 · 11/23 | 1 | WU-04, WU-41 |
| [WU-16](WU-16-items.md) | 품목 화면 (목록 · 등록 · 수정) | jkspawn | skygaul | 1 · 11/23 오후 | 1 | WU-41 |
| [WU-13](WU-13-bulk.md) | 일괄 등록 (파싱 · 미리보기) | jkspawn | skygaul | 2 · 11/24 | 3 | WU-43, WU-23 |
| [WU-14](WU-14-history-cancel.md) | 이력 · 취소 · 상태 버튼 | jkspawn | skygaul | 2 · 11/24 | 3 | WU-23, WU-41 |
| [WU-15](WU-15-demo-polish.md) | 시연 동선 · 백업 영상 | jkspawn | skygaul | 3 · 11/25 | 4 | 전부 |
| [WU-21](WU-21-inventory-core.md) | 재고 함수 1 (등록 · 입고 · 출고) | sorek-charlie | jkspawn | 1 · 11/23 | 1 | WU-02 |
| [WU-22](WU-22-seed-e2e.md) | 시드 데이터 3벌 · 정답표 · E2E Step 1 · 2 | sorek-charlie | jkspawn | 1 · 11/23 | 1 · 2 · 4 | WU-08, WU-21 |
| [WU-23](WU-23-inventory-cancel-bulk.md) | 재고 함수 2 (취소 · 전이) + 일괄 반영 테스트 | sorek-charlie | jkspawn | 2 · 11/24 | 3 | WU-21, WU-43 |
| [WU-24](WU-24-regression.md) | E2E Step 3 · 회귀 실행 · 판정 · 측정 실행 | sorek-charlie | jkspawn | 3 · 11/25 | 4 | 전부, WU-45 |
| [WU-31](WU-31-llm.md) | LLM 호출층 · 호출 상한 | skygaul | eple | 1 · 11/23 | 5 | WU-02 |
| [WU-32](WU-32-reorder.md) | 발주 후보 계산 · 발주서 프롬프트 | skygaul | eple | 1 · 11/23 | 5 | — |
| [WU-33](WU-33-draft-po.md) | 발주서 초안 API · 에이전트 패널 | skygaul | eple | 2 · 11/24 | 5 | WU-31, WU-32, WU-21 |
| [WU-34](WU-34-chat.md) | 자연어 조회 · 출고 (허용 액션) | skygaul | eple | 2 · 11/24 | 5 | WU-31, WU-21 |
| [WU-35](WU-35-ai-ops.md) | Gemini 리허설 · 한계 문서 · AI 사례 | skygaul | eple | 3 · 11/25 | 5 | WU-33, WU-34 |
| [WU-41](WU-41-api-core.md) | 업무 API 실제 연결 | eple | sorek-charlie | 1 · 11/23 | 1 | WU-21 |
| [WU-42](WU-42-auth-tests-deploy.md) | 권한 테스트 · 배포 검증 | eple | sorek-charlie | 1 · 11/23 | 2 | WU-41 |
| [WU-43](WU-43-bulk-seed-api.md) | 일괄 반영 함수 · 일괄 등록 · 시드 API, 중간 점검 | eple | sorek-charlie | 2 · 11/24 | 3 | WU-21, WU-22 |
| [WU-45](WU-45-regression-runner.md) | 회귀 실행기 · 측정 스크립트 | eple | sorek-charlie | 2 · 11/24 | 4 | WU-08, WU-22 |
| [WU-44](WU-44-final.md) | 최종 병합 · DevelopDoc · 제출 | eple | sorek-charlie | 3 · 11/25 | 전부 | 전부 |

**11/24(화) 14시 이후 기능 추가 중단.** Wave 2의 WU가 14시까지 안 끝나면 범위를 줄여 'Step 3 일부 완료'처럼 기록한다.

## 사람별 하루 계획

| 날짜 | eple | sorek-charlie | jkspawn | skygaul |
|---|---|---|---|---|
| 11/20~22 | WU-01~08 (골격 · 테스트 기반) | — | — | — |
| 11/23(월) | WU-41 → WU-42 | WU-21 → WU-22 | WU-11 · WU-12 (목 → 실제) → WU-16 | WU-31 · WU-32 |
| 11/24(화) | WU-43(오전 `pf_bulk_apply` 먼저) → WU-45, 중간 점검 | WU-23 → 저녁 첫 회귀 실행 | WU-13 · WU-14 | WU-33 · WU-34 |
| 11/25(수) | WU-44 | WU-24 | WU-15 | WU-35 |

**분량 맞춤 (2026-11-20):** 처음 안에서 sorek-charlie 몫이 가장 컸다(재고 함수 2묶음 + 시드 + 초기화 함수 + 테스트 도구 + 회귀 실행기). 구조에 가까운 작업(테스트 기반 · 초기화 함수 · 시드 로더 → WU-08, 일괄 반영 래퍼 → WU-43, 회귀 실행기 · 측정 스크립트 → WU-45)을 eple로 옮겼다. sorek-charlie는 업무 규칙(재고 · 취소 · 전이 함수)과 QA(시드 데이터 · 정답표 · 테스트 케이스 · 회귀 판정)에 집중한다. 이제 팀원 셋은 각각 WU 4~6개(jkspawn은 품목 화면 WU-16 추가로 6개이나 화면 단위가 작다), 주로 코딩하는 날 3일씩으로 비슷하다.

**구조 집중 (2026-11-20, A안):** 골격을 eple이 만들므로, 여러 파트가 같이 쓰는 파일과 모양이 정해진 얇은 층도 골격에서 **완성본**으로 깐다 — 재고 호출 래퍼 `inventory.ts`, fetch 래퍼 `api-client.ts` · 목, 앱 뼈대(레이아웃 · `<AgentSlot />`) · 공통 조각(`common/`), 파트 간 계약(`types/agent.ts` · `open.ts`), 공통 유틸(`env` · `time` · `log`). 팀원 몫은 업무 로직만 남는다. `llm.ts` 제공자 층은 skygaul의 핵심 영역이라 그대로 둔다. 이유: 공통 파일을 여럿이 고치다 프로젝트가 망가지는 것보다, 한 사람이 쥐고 요청을 받는 편이 안전하다.
