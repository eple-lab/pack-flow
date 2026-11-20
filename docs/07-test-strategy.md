# 07. 테스트 전략

작성일: 2026-11-20 · 근거: 계획서 2 · 3 · 13 · 14절, 공통 안내 '자주 묻는 질문'(테스트 몇 개?), D-11

> 기준: **목표 Step의 통과 테스트 전부 + 실패 사례(빈 입력 · 권한 없음 등) 각 1개 이상** (공통 안내). "다 됐다"는 명령을 돌려 나온 결과로 말한다.

## 1. 테스트 층

| 층 | 도구 | 무엇을 | 어디서 | 누가 쓰나 |
|---|---|---|---|---|
| 단위 | Vitest | 순수 함수: 파싱(`lib/bulk`), 추천 수량(`lib/agent/reorder`), 오류 매핑, 액션 스키마 검사 | 로컬 + Actions (DB 없음) | 각 구역 주인, 파일 옆 `*.test.ts` |
| DB 함수 | Vitest + 사용자 JWT 클라이언트 | 재고 함수 · 전이 · 불변식 · RLS | 로컬 → `packflow-dev`, **개인 테스트 계정**(P-17) | sorek-charlie (`tests/db/`) |
| API | Vitest(`fetch`로 로컬 서버 호출) 또는 Playwright `request` | 상태 코드 · 오류 형식 · 권한 · CSRF | 로컬 `npm run dev` + dev DB | eple(권한), skygaul(에이전트) |
| 시나리오 (E2E) | Playwright | 완료 판정 테스트를 화면에서 | 로컬, 마지막에 배포 URL | sorek-charlie (`tests/e2e/`), 화면 선택자는 jkspawn과 약속 |
| 직접 확인 | 사람 | 리뷰어가 배포 URL에서 '실제 동작 확인 항목' | 배포 URL | 리뷰어 |

**테스트 기반(구조)은 eple, 케이스는 담당자.** 도구 설정, 로그인 · 초기화 도우미(`tests/**/helpers.ts`), 회귀 실행기 · 측정 스크립트는 eple이 만들고(WU-08 · WU-45), 테스트 케이스와 정답표, 회귀 실행 · 판정은 sorek-charlie가 한다.

화면 테스트가 깨지지 않게 jkspawn은 버튼 · 카드 · 표에 `data-testid`를 단다(예: `kpi-below-safety`, `alert-card-PRD-001`, `btn-ship-S-201`). 이름 목록은 WU-11 · 12 문서에 둔다.

### 명령 (Wave 0에서 `package.json`에 만든다)

| 명령 | 내용 |
|---|---|
| `npm run test:unit` | 단위 테스트만. Actions에서도 돈다 |
| `npm run test:db` | DB 함수 · RLS 테스트. `.env.local`의 dev 프로젝트, 본인 테스트 계정 |
| `npm run test:e2e` | Playwright. 기본 대상 `http://localhost:3000`, `E2E_BASE_URL`로 배포 URL 지정 |
| `npm run test:regression` | 시드 초기화(`small`) → `test:db` → `test:e2e` → 결과표 `docs/records/regression-<YYYYMMDD-HHmm>.md` 생성 |

## 2. 완료 판정 테스트 배치

계획서의 테스트마다 **ID · 층 · 파일 · 담당**을 정한다. 결과표는 이 ID로 쓴다.

| ID | 계획서 | 조건 · 행동 · 기대 | 층 | 파일 | 담당 |
|---|---|---|---|---|---|
| T-S1-1 | 완료 1 | A 재고 10 · 안전 5 → 6개 출고 → 재고 4, 품절 임박 카드, `stock_logs` −6 1건 | DB + E2E | `tests/db/ship.test.ts`, `tests/e2e/step1.spec.ts` | sorek-charlie |
| T-S1-2 | 완료 2 | 10개 주문 · 8개 도착 → 입고 확정 → 재고 +8 | DB + E2E | `tests/db/receive.test.ts`, `step1.spec.ts` | sorek-charlie |
| T-S1-3 | Step 1 | 입출고 직후 대시보드 KPI · 파이프라인 · 품목 재고 = DB 값 | E2E | `step1.spec.ts` | sorek-charlie |
| T-S2-1 | Step 2 | 배포 URL에서 A 로그인 → 입출고 → 재로그인 후 같은 값 | E2E(배포) | `tests/e2e/step2.spec.ts` | sorek-charlie |
| T-S2-2 | Step 2 | B 로그인 시 A 데이터 안 보임 | E2E | `step2.spec.ts` | sorek-charlie |
| T-AUTH-1~8 | 완료 6 · Step 2 | [05 보안](05-security.md) 3절 | API + DB | `tests/api/rls.test.ts`, `tests/api/auth.test.ts` | eple |
| T-S3-1 | 완료 3 | 6개 출고 취소 → 재고 10, `출고취소` +6 추가, −6 기록 남음 | DB + E2E | `tests/db/cancel.test.ts`, `step3.spec.ts` | sorek-charlie |
| T-S3-2 | 완료 4(직접) | 재고 4에 50개 출고 → 거부, 재고 · 이력 변화 없음 | DB | `tests/db/ship.test.ts` | sorek-charlie |
| T-S3-3 | Step 3 | `입고완료→발주완료`, `취소→입고완료` 요청 → 거부 | DB | `tests/db/transition.test.ts` | sorek-charlie |
| T-S3-4 | Step 3 | 품목별 이력 합계 = 재고 (T-INV-1~4) | DB | `tests/db/invariants.test.ts` (모든 테스트 끝에 호출) | sorek-charlie |
| T-S3-5 | Step 3 | 오류 행 섞인 붙여넣기 → 유효 행만 반영, 사유 표시 | 단위 + E2E | `src/lib/bulk/parse.test.ts`, `step3.spec.ts` | jkspawn · sorek-charlie |
| T-S4-1 | Step 4 | small · large 시드에서 KPI · 재고 = `expected`, 응답 시간 기록 | DB + 측정 | `tests/regression/seed-expected.test.ts` | sorek-charlie |
| T-S4-2 | Step 4 | large 이력이 20건씩 첫 페이지 · 다음 페이지로 | API | `tests/api/stock-logs.test.ts` | eple |
| T-S4-3 | Step 4 | 회귀 테스트가 병합 전마다 결과로 남음 | 기록 | `docs/records/regression-*.md` | sorek-charlie |
| T-S4-4 | Step 4 | 같은 송장 붙여넣기 2회 → 1회만, 경고 | DB + E2E | `tests/db/bulk.test.ts` | sorek-charlie |
| T-AI-1 | 완료 5 | 초안 [확인] → `발주완료` 1건 / [취소] → 변화 없음 | E2E | `tests/e2e/step5.spec.ts` | skygaul |
| T-AI-2 | 완료 4(챗봇) | 재고 4에 "50개 출고해 줘" → 거부, 남은 수량 안내 | API | `tests/api/agent.test.ts` | skygaul |
| T-AI-3 | Step 5 | 챗봇 답의 재고 수치 = DB 값 (`facts` 대조) | API | `agent.test.ts` | skygaul |
| T-AI-4 | Step 5 | "모든 재고를 0으로 바꿔" → 실행 안 함 | API | `agent.test.ts` | skygaul |
| T-AI-5 | Step 5 | B의 챗봇은 A의 재고를 답하지 않음 | API | `agent.test.ts` | skygaul |
| T-AI-6 | Step 5 | LLM 차단(잘못된 주소 · 키) → 입출고는 정상, 패널에 오류, 가짜 초안 없음 | API + E2E | `agent.test.ts`, `step5.spec.ts` | skygaul |
| T-AI-7 | P-09 | 하루 상한 넘으면 429 | 단위(상한 1로 설정) | `src/lib/llm.test.ts` | skygaul |

**LLM이 들어가는 테스트(T-AI-2~5)는 실제 LLM으로 돌리면 결과가 흔들린다.** 기본은 `LLM_PROVIDER=fake`(정해진 JSON을 돌려주는 가짜 제공자, `src/lib/llm.ts` 안)로 돌려 **서버의 검사 로직**을 확인하고, 실제 Ollama · Gemini로는 같은 문장 5개를 돌려 결과를 [AI 사례 기록](#5-기록-양식)에 남긴다. 둘을 구분해 발표한다("모의와 실제 구분", Step 3 역량).

### 실패 사례 최소 목록 (공통 안내 기준)

| 종류 | 테스트 |
|---|---|
| 빈 입력 | 빈 붙여넣기 → 미리보기 "행 없음", 반영 버튼 비활성 (T-S3-5에 포함) / 빈 챗봇 메시지 → 400 |
| 권한 없음 | T-AUTH-1 · 2 |
| 재고 초과 | T-S3-2, T-AI-2 |
| 허용 안 된 전이 | T-S3-3 |
| 중복 | T-S4-4 |
| AI 장애 | T-AI-6 |

## 3. 테스트 데이터 규칙

- 테스트는 시작할 때 **본인 계정만** `pf_reset_and_seed`로 초기화한다. 공용 계정을 쓰지 않는다(P-17).
- 테스트 계정 이메일 · 비밀번호는 `.env.local`(`TEST_USER_A_EMAIL` 등)에만. 저장소에 쓰지 않는다.
- T-AUTH용 'B' 계정은 각자 두 번째 테스트 계정을 쓴다(계정 수: 1인 2개, 총 8개 — Wave 0에서 eple이 dev에 만든다).
- 배포 URL 테스트는 시연 계정 A · B(`packflow-demo`)로, 발표 전날 마지막에 `demo` 시드로 되돌린다.

## 4. 언제 무엇을 돌리나

| 때 | 돌릴 것 | 누가 |
|---|---|---|
| 커밋할 때마다 | 비밀값 · 개인정보 검사(pre-commit 훅이 자동, [05](05-security.md) 2.2절) | 자동 |
| 커밋 전 | `lint` · `typecheck` · `test:unit` | 작성자 |
| PR마다 | Actions: `secret-check` · `lint` · `typecheck` · `test:unit` (빨간불이면 병합 안 함) | 자동 |
| PR 올리기 전 | 위 + 자기 WU의 `test:db` / `test:e2e` 해당 파일 | 작성자 |
| PR 리뷰 | 브랜치 받아 직접 실행 + 실제 동작 확인 항목 | 리뷰어 |
| 매일 마감 통합 | `test:regression` (11/24부터) | sorek-charlie, 결과는 `docs/records/` |
| 11/25 기능 고정 | `test:regression` + `E2E_BASE_URL=<배포 URL> npm run test:e2e` | sorek-charlie · eple |

## 5. 기록 양식

### 테스트 결과표 (`docs/records/regression-<날짜>.md`, 스크립트가 만든다)

```markdown
# 회귀 테스트 결과 2026-11-25 14:10

- 커밋: abc1234 / 대상: localhost (dev) / 시드: small / 실행: sorek-charlie

| ID | 결과 | 걸린 시간 | 메모 |
|---|---|---|---|
| T-S1-1 | 통과 | 0.8s | |
| T-S3-2 | 실패 | 0.5s | 재고 4인데 50 출고가 409 대신 500 → WU-23에서 수정 |

통과 21 / 실패 1 / 건너뜀 0
```

### AI 활용 · 디버깅 사례 (각자 `docs/records/ai-cases-<계정>.md`, 11/25 skygaul이 `ai-cases.md`로 모음)

한 파일을 네 명이 동시에 고치면 병합 충돌이 나므로 **사람별 파일**에 쓴다.

제출물 'AI 활용 · 디버깅 사례 3개'와 피드백 기준 4번("실패 원인 · 수정 · 재검증")의 증거다. **성공 사례보다 실패 → 고침 → 재확인 사례**를 적는다.

```markdown
## 사례 N — 한 줄 제목 (작성: 계정, 날짜, WU-xx)

- 맡긴 것: (어떤 도구 · 모델에 무엇을 요청했나)
- AI가 낸 것: (요약, 코드 위치)
- 문제: (무엇이 틀렸고 어떻게 알았나 — 테스트 ID, 로그)
- 원인:
- 고친 것: (커밋)
- 다시 확인: (명령과 결과)
```

### 응답 시간 측정 (Step 4)

```markdown
| 시드 | 행 수 | 대상 | 측정 환경 | 대시보드 p50 / 최대 | 이력 1페이지 p50 / 최대 |
|---|---|---|---|---|---|
| small | 품목 5 · 이력 20 | localhost → dev | (PC 사양, 네트워크) | | |
| large | 품목 10 · 이력 50 | 배포 URL → demo | Render 무료(깨어 있는 상태) | | |
```

각 10회 호출, 첫 호출(잠에서 깨는 시간)은 따로 적는다.

## 6. 피드백 기준별 증거 위치

| 기준 | 증거 | 위치 |
|---|---|---|
| 1 명확성 | 한 문장 · 대표 시나리오 | [00 개요](00-overview.md), 발표 1 |
| 2 실제 동작 | 배포 URL 시연, `E2E_BASE_URL` 실행 결과 | 결과표, 시연 영상 |
| 3 테스트 · 권한 | T-AUTH · 실패 사례 결과표 | `docs/records/regression-*.md` |
| 4 AI 검토 | AI 사례 3개, 모의 · 실제 비교 | `docs/records/ai-cases.md`(모음) · `ai-cases-<계정>.md`, `ai-limits.md` |
| 5 협업 · 전달 | 리뷰가 남은 PR, README만으로 재현 | GitHub PR 목록, README |
