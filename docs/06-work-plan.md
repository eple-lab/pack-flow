# 06. 작업 계획 — 병렬로, 충돌 없이

작성일: 2026-11-20 · 근거: D-09 · D-13 · D-14 · D-15, 계획서 10 · 11절

네 명이 같은 날 같은 저장소에 push해도 충돌이 나지 않게 하는 방법은 하나다. **파일마다 주인을 정하고, 남의 파일은 고치지 않는다.** 서로 기대는 부분은 [04 API 계약](04-api-contract.md)과 타입 파일로 미리 약속하고, Wave 0에서 eple이 모든 파일의 자리를 만들어 둔다.

## 1. 파일 소유 구역

주인만 그 파일을 고친다. 다른 사람이 고쳐야 하면 주인에게 요청하거나, 주인이 리뷰하는 PR로 한다.

| 구역 | 경로 | 주인 |
|---|---|---|
| 설정 · 의존성 · 스크립트 | `scripts/**`, `.gitignore`, `.githooks/**`(훅 · `allow-patterns`), `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.*`, `eslint` · `vitest` · `playwright` 설정, `.github/`, `render.yaml`, `.env.example`, `AGENTS.md`, `README.md` | eple |
| DB 스키마 · 권한 | `supabase/migrations/*_schema.sql`, `*_rls.sql`, `*_llm_usage.sql` | eple |
| DB 재고 함수 · 시드 함수 | `supabase/migrations/*_inventory.sql`, `*_seed.sql` | sorek-charlie |
| 공통 타입 | `src/types/erp.ts` | eple |
| 에이전트 타입 | `src/types/agent.ts` | skygaul |
| 인증 · DB 클라이언트 · API 공통 | `src/middleware.ts`, `src/lib/supabase/**`, `src/lib/api/**`, `src/app/login/**` | eple |
| 업무 API 라우트 | `src/app/api/{health,me,items,purchases,sales,stock-logs,dashboard,bulk,seed}/**` | eple |
| 조회 집계 | `src/lib/queries/**` (대시보드 · 이력 쿼리) | eple |
| 재고 함수 호출층 | `src/lib/inventory.ts` | sorek-charlie |
| 시드 데이터 · 정답표 | `src/lib/seed/**` | sorek-charlie |
| 테스트 | `tests/db/**`, `tests/e2e/**`, `tests/regression/**`, `tests/fixtures/**` | sorek-charlie |
| API 테스트 | `tests/api/auth.test.ts`, `tests/api/stock-logs.test.ts` / `tests/api/agent.test.ts` | eple / skygaul |
| 각자 단위 테스트 | 자기 구역 파일 옆 `*.test.ts` | 그 구역 주인 |
| 화면 | `src/app/(app)/**` (`/login` 제외), `src/components/{layout,dashboard,trades,bulk,common}/**`, `src/styles/**` | jkspawn |
| 일괄 등록 파싱 | `src/lib/bulk/**` | jkspawn |
| 화면용 목 데이터 | `src/lib/mock/**` | jkspawn (Wave 0 첫 판은 eple) |
| 에이전트 | `src/lib/llm.ts`, `src/lib/agent/**`, `src/app/api/agent/**`, `src/components/agent/**`, `src/lib/agent/prompts/**` | skygaul |
| 문서 | `docs/` 00~08, `DevelopDoc/` | eple |
| 작업 단위 문서 · 기록 | `docs/work-units/WU-xx-*.md`의 '결과' 절, `docs/records/<계정>-*.md` | 그 WU 담당자 |

### 충돌이 나기 쉬운 곳과 규칙

| 파일 | 규칙 |
|---|---|
| `package.json` · lock | 11/23부터 새 패키지는 **eple에게 요청**하고, eple이 하루 한 번(오전) 모아서 넣는다. 각자 lock 파일을 커밋하지 않는다 |
| `src/types/erp.ts` | 바꿔야 하면 이 문서가 아니라 [04](04-api-contract.md)와 함께 eple PR로 먼저. 병합 뒤 각자 `main`을 받아 쓴다 |
| 마이그레이션 | 파일 이름 앞 타임스탬프가 달라 이름 충돌은 없다. 이미 적용된 파일은 고치지 않고 **새 파일**로 바꾼다. 적용은 eple(P-06) |
| 화면 공통 레이아웃 | `src/components/layout/`은 jkspawn. 에이전트 패널을 넣을 자리(`<AgentSlot />`)는 Wave 0에서 미리 만든다 |

## 2. Wave별 작업 단위

WU 번호: `0x` eple 골격, `1x` jkspawn, `2x` sorek-charlie, `3x` skygaul, `4x` eple(합류 후). 작업 단위 문서는 `docs/work-units/`에 쓴다(Wave 0 마지막 작업).

### Wave 0 — 골격 (11/20 금 ~ 11/22 일, eple 혼자, main 직접 push)

목표: **팀원이 월요일 아침에 clone하면 바로 자기 구역을 채울 수 있는 상태.** 모든 파일의 자리, 타입, API stub, DB 스키마, 배포 URL.

| WU | 내용 | 다 됐다의 기준 |
|---|---|---|
| WU-01 | Next.js + TS 골격, 폴더 구조(1절 경로 전부 빈 파일 · 자리), lint · typecheck · `test:unit` 스크립트, `.nvmrc`, `.env.example`, `AGENTS.md`, `CLAUDE.md`(AGENTS.md 불러오기), Actions(P-11), `.gitignore`(`.env*` 무시 · `!.env.example`), 비밀값 검사 `.githooks/` + `scripts/check-secrets.sh` + Actions `secret-check`, `prepare` 스크립트로 훅 자동 설치([05](05-security.md) 2.2절) | 새 폴더에 clone → `npm ci` → `npm run lint && npm run typecheck && npm run test:unit` 통과 / `git config core.hooksPath`가 `.githooks` / 가짜 키를 넣은 `.env.local`이 `git status`에 안 보임 / 가짜 JWT · `sb_secret_` · `AIza` 키를 넣은 파일 커밋이 **로컬 훅과 Actions 양쪽에서** 막힘 / `@packflow.test` 예시는 통과 |
| WU-02 | Supabase `packflow-dev` · `packflow-demo` 생성, 마이그레이션 `schema` · `rls` · `llm_usage`, 재고 함수 **이름 · 인자만 있는 stub**(`PF_NOT_IMPLEMENTED`), 시연 계정 A · B(demo, 대시보드에서 생성), 팀원 테스트 계정 1인 2개 · 총 8개(dev, `scripts/create-test-users.ts`, P-17), 스크립트 안전장치(D-20 ③) | 두 프로젝트에 같은 마이그레이션 적용, T-AUTH-4~6이 dev에서 통과 / demo 주소로 스크립트 실행 시 거부 / 스크립트 출력 · 커밋에 키 · 비밀번호 없음 |
| WU-03 | `src/types/erp.ts`, `src/lib/supabase/{server,browser}.ts`, `src/lib/api/{errors,handler,csrf}.ts`, middleware, `/login` | 로그인 · 로그아웃, 미로그인 `/api/me` 401 |
| WU-04 | [04](04-api-contract.md)의 모든 라우트 stub(계약 모양 + 501), `src/lib/mock/` 첫 판, `src/lib/llm.ts` · `src/lib/agent/` · `src/components/agent/` 빈 자리 | 모든 라우트가 501 또는 목 응답, typecheck 통과 |
| WU-05 | 화면 자리: 레이아웃 · 내비 · `<AgentSlot />`, 빈 대시보드 · 입출고 · 이력 페이지 | 로그인 후 세 페이지가 열린다 |
| WU-06 | Render 배포(`packflow-demo` 연결), `GET /api/health` | **배포 URL에서 로그인 → 빈 대시보드**. 1일차 '최소 화면 배포' 해소 |
| WU-07 | 작업 단위 문서 `docs/work-units/WU-11~44`, `_template.md` | 팀원이 문서만 보고 시작할 수 있다(검토: 각 담당자가 월요일 오전에 읽고 질문) |

### Wave 1 — Step 1 · 2 (11/23 월)

| WU | 담당 | 내용 | 다 됐다의 기준 (요약) | 기대는 것 |
|---|---|---|---|---|
| WU-21 | sorek-charlie | `pf_create_item` · `pf_create_purchase` · `pf_receive_purchase` · `pf_create_sale` · `pf_set_sale_status` · `pf_ship_sale`, `src/lib/inventory.ts` | 완료 테스트 1 · 2가 `tests/db`에서 통과, T-INV-1 통과 | WU-02 |
| WU-22 | sorek-charlie | 시드 3벌(demo · small · large) + `expected` 정답표, `pf_reset_and_seed` | 세 벌 모두 넣은 직후 T-INV-1 통과, `expected`와 일치 | WU-21 |
| WU-11 | jkspawn | 대시보드: KPI 카드 · 파이프라인 · 품목별 재고 표 · 품절 임박 카드 | 목 데이터로 화면 완성 → `NEXT_PUBLIC_USE_MOCK=0`에서 실제 값 표시 | WU-04 목, WU-41 |
| WU-12 | jkspawn | 입출고 화면: 구매 · 판매 목록, 등록 폼, 입고 확정 · 출고 버튼, 오류 메시지 표시 | 화면에서 완료 테스트 1 · 2 재현 | WU-41 |
| WU-31 | skygaul | `src/lib/llm.ts`(Ollama · Gemini, 시간 초과, 오류 → `PF_LLM_UNAVAILABLE`), `pf_llm_take` 연동, 팀 공통 Ollama 모델 확정 | 두 제공자 모두 같은 함수로 호출, 상한 초과 429 | WU-02 |
| WU-32 | skygaul | `src/lib/agent/reorder.ts` 추천 수량 계산(순수 함수) + 단위 테스트, 발주서 프롬프트 초안 | 계산 단위 테스트 통과(DB 없이) | — |
| WU-41 | eple | 업무 API 라우트 실제 연결(items · purchases · sales · dashboard · stock-logs), 함수 오류 → HTTP 매핑 | 목 없이 화면에서 입고 → 출고 → 대시보드 갱신 | WU-21 |
| WU-42 | eple | 권한 테스트 T-AUTH-1~8 자동화 지원, Render 재배포, 검증자가 배포 URL에서 테스트 | **Step 1 · 2 완료 판정** (배포 URL) | WU-41 |

### Wave 2 — Step 3 · 5 (11/24 화, **14시 기능 추가 중단**)

| WU | 담당 | 내용 | 다 됐다의 기준 (요약) |
|---|---|---|---|
| WU-23 | sorek-charlie | `pf_cancel_receipt` · `pf_cancel_shipment` · `pf_set_purchase_status` · 전이 판정 함수 · `pf_bulk_apply` | Step 3 통과 테스트 5개 중 화면 무관 4개가 `tests/db`에서 통과 |
| WU-13 | jkspawn | 일괄 등록 탭: `src/lib/bulk/parse.ts`(TSV · CSV) + 미리보기 표 + 오류 사유 + 반영 | 오류 3행 섞인 10행 → 7행 반영, 사유 표시 |
| WU-14 | jkspawn | 이력 화면(페이지네이션), 취소 버튼, 허용 전이 버튼만 표시 | 품목 A 이력에 −6 · +6 둘 다 보임 |
| WU-33 | skygaul | `/api/agent/draft-po` · `/confirm`, 에이전트 패널(초안 표 · 문안 · 수정 · 확인/취소) | 완료 테스트 5, P-08(LLM 실패 시 계산 표만) |
| WU-34 | skygaul | `/api/agent/chat` · `/execute`, 허용 액션 검사, 인젝션 · 수치 검증 | T-AI-1~6 통과 |
| WU-43 | eple | bulk · seed 라우트 실제 연결, 중간 점검 기록(계획서 2절 변경 이력), demo DB에 마이그레이션 적용 | 배포 URL에서 Step 3 · 5 시연 가능 |

### Wave 3 — Step 4 · 마무리 (11/25 수)

| WU | 담당 | 내용 | 다 됐다의 기준 (요약) |
|---|---|---|---|
| WU-24 | sorek-charlie | 회귀 테스트 묶음 `npm run test:regression`(시드 초기화 → 전체 실행 → 결과표 파일), 소량 · 대량 응답 시간 측정 | 결과표가 `docs/records/regression-<날짜>.md`로 남고 전부 통과 |
| WU-15 | jkspawn | 시연 동선 정리(초기화 버튼 · 확인 창), 모바일 폭 확인, 백업 시연 영상 촬영 | 2분 영상, 시연 순서대로 끊김 없이 |
| WU-35 | skygaul | Gemini 리허설(배포 URL), AI 한계 문서, 요청량 · 비용 기록, AI 디버깅 사례 정리 | `docs/records/ai-limits.md`, 사례 3개 |
| WU-44 | eple | 최종 병합, `DevelopDoc/` 4개 파일, README(배포 URL · 테스트 방법 · 제출 커밋), 보안 점검 | FINAL_CHECKLIST 전부 체크 |
| — | 전원 | 상호 리뷰 마무리, 발표 자료(역할 분담 · 개발 일정 포함), 개인 회고 | 계획서 12 · 13절 |

## 3. 서로 기다리지 않는 방법

| 기대는 것 | 기다리는 동안 할 일 |
|---|---|
| 화면 ← API | `NEXT_PUBLIC_USE_MOCK=1`로 목 응답(같은 타입)에 화면을 만든다. API가 붙으면 환경변수만 끈다 |
| API ← DB 함수 | 함수 stub이 `PF_NOT_IMPLEMENTED`를 던지므로 API는 오류 매핑부터 만든다 |
| 에이전트 ← 재고 함수 | 추천 수량 계산 · 프롬프트 · LLM 호출은 DB 없이 단위 테스트. 실행 액션은 `src/lib/inventory.ts`의 함수 이름만 보고 연결 |
| 테스트 ← 기능 | sorek-charlie가 완료 판정 테스트를 **먼저 실패하는 테스트로** 써 둔다. 기능이 붙으면 통과로 바뀐다 |

## 4. 브랜치 · 커밋 · PR (11/23부터)

0. 처음 한 번: clone → `npm ci`(이때 비밀값 검사 훅이 자동으로 켜진다). `git config core.hooksPath`가 `.githooks`로 나오는지 확인
1. `main`에서 시작: `git switch main && git pull` → `git switch -c feat/WU-11-dashboard`
2. 자기 구역 파일만 고친다. 커밋은 작게, 메시지 `feat: 대시보드 KPI 카드 (WU-11)` / `fix: ...` / `test: ...` / `docs: ...`
3. 하루에 한 번 이상 `main`을 받아 합친다: `git fetch origin && git merge origin/main` (rebase는 쓰지 않는다 — 이미 push한 커밋이 바뀐다)
4. push → PR 생성. 제목 `WU-11 대시보드 KPI · 재고 표`, 본문은 아래 양식
5. 검증자(역할표)가 리뷰한다. 리뷰어는 **브랜치를 받아 직접 실행**해 보고 승인한다
6. 작성자 또는 eple이 **"Create a merge commit"**으로 병합한다(D-14). 병합 메시지 본문은 아래 양식
7. 병합 뒤 브랜치를 지운다

| 작성자 | 검증자(리뷰어) |
|---|---|
| jkspawn (프론트) | skygaul |
| sorek-charlie (재고 · QA) | jkspawn |
| skygaul (AI) | eple |
| eple (백엔드) | sorek-charlie |

(계획서 11절의 '검증' 열을 작성자 기준으로 뒤집은 표다.)

### PR 본문 양식

```markdown
## WU-11 대시보드 KPI · 재고 표

### 한 것
- 

### 확인한 것 (명령과 결과)
- [ ] npm run lint / typecheck / test:unit 통과
- [ ] 다 됐다의 기준: (WU 문서에서 그대로 옮김)
- [ ] 실제 동작 확인: (화면 · 배포 URL에서 본 것)

### 확인 못 한 것

### 다른 구역 파일을 건드렸나
- 없음 / 있음: (파일, 주인 승인 여부)

### 커밋 전 점검 (공개 저장소)
- [ ] diff · 스크린샷 · 테스트 기록에 키 · 비밀번호 · 실제 이메일 · 실명 · 사용자 폴더 경로 없음
- [ ] `.env*` 파일이 커밋에 없음 (`.env.example` 제외), pre-commit 검사를 `--no-verify`로 넘기지 않음
```

### 병합(merge commit) 메시지 양식

GitHub이 첫 줄을 `Merge pull request #12 from jkspawn/feat/WU-11-dashboard`로 채운다. 본문을 이렇게 바꾼다.

```text
WU-11 대시보드 KPI · 재고 표
리뷰: skygaul
테스트: npm run test:unit 통과, 완료 판정 1번 화면 확인
남은 것: 없음 (또는 한 줄)
```

## 5. 매일의 리듬

| 시각 | 할 일 |
|---|---|
| 오전 시작 | 짧은 공유(어제 한 것 · 오늘 할 것 · 막힌 것), eple이 패키지 요청 반영 |
| 점심 전 | 1차 병합 → eple이 `main`을 demo에 배포 |
| 오후 | 리뷰 · 수정 |
| 마감 전 | 2차 병합 → **통합 버전 실행**(공통 안내 "매일 한 번은 합친 버전을 실행") → 결과를 계획서 2절 변경 이력에 한 줄 |

막혔을 때: 15분 혼자(에러 읽고 재현 단계 줄이기) → 15분 팀과(가설 3개) → 멘토 · 운영진(계획서 11절).

## 6. 작업 단위 문서 양식 (`docs/work-units/_template.md`)

각자 이 양식으로 자기 WU 문서의 '결과' 절을 채우고, 필요하면 하위 작업을 직접 쪼개 새 WU 문서를 만든다(번호는 자기 범위 안에서: jkspawn `1x`, sorek-charlie `2x`, skygaul `3x`).

```markdown
# WU-xx 제목

- 담당: / 검증: / Step: / Wave:
- 브랜치: feat/WU-xx-주제

## 왜 (근거)
계획서 · 문서의 어느 절을 구현하나

## 읽을 파일
- (이 파일만 읽고 시작한다)

## 만들 · 고칠 파일 (내 구역만)
-

## 하지 말 것
- 남의 구역 파일 수정, 새 패키지 직접 추가, 계약(04) 임의 변경

## 고치는 방법
1.

## 다 됐다의 기준
- [ ] lint · typecheck · test:unit 통과
- [ ] (기능 기준)

## 테스트 방법
- 자동: 실행할 명령, 테스트 파일 위치, 기대 결과
- 직접: 화면에서 할 일과 보여야 할 것

## 실제 동작 확인 항목 (리뷰어가 배포 URL에서)
- [ ]

## 결과 (담당자가 채움)
- 한 것 / 직접 확인한 것 / 확인 못 한 것
- AI가 틀린 것과 고친 과정 (있으면 → docs/records/ai-cases.md에도)
```

AI 코딩 도구에 맡길 때는 이 WU 문서를 통째로 주고 "읽을 파일만 읽고, 만들 · 고칠 파일만 고치고, 다 됐다의 기준을 돌려서 보고해"라고 요청한다(공통 안내 'AI 요청': 목적 · 현재 구조 · 작은 범위 · 완료 테스트).
