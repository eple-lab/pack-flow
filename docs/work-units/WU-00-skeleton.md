# WU-01~08 골격 (Wave 0)

- 담당: eple / 검증: 없음(11/22까지 main 직접 push, D-13) — 팀원이 11/23 오전에 clone해서 확인
- Step: 2 일부(배포 · 인증 자리) / Wave 0 · 11/20(금) ~ 11/22(일)
- 목표: **팀원이 월요일 아침 clone → `npm ci` → 자기 WU 문서만 보고 바로 시작할 수 있는 상태.** 모든 파일의 자리, 타입, API stub, DB 스키마 · 권한, 배포 URL.

## 읽을 파일

- [01 아키텍처](../01-enterprise-architecture.md) 3절, [03 데이터 모델](../03-data-model.md) 전체, [04 API 계약](../04-api-contract.md) 전체, [05 보안](../05-security.md) 2 · 3절, [06 작업 계획](../06-work-plan.md) 1절, [07 테스트](../07-test-strategy.md) 1절

## 하지 말 것

- 팀원 구역의 **구현**을 하지 않는다. 자리(빈 파일, 함수 이름, 타입, stub)만 만든다. 구현을 해 버리면 팀원 WU가 사라진다
- 서비스 키를 Render에 넣지 않는다, demo 서비스 키를 저장하지 않는다 (D-20)
- 키 · 비밀번호 · 테스트 계정 정보를 커밋하지 않는다

---

## WU-01 프로젝트 골격 · 도구 · 보안 장치

1. Next.js(App Router) + TypeScript strict, 저장소 루트에 생성. 경로 별칭 `@/`
2. `.nvmrc`(24), `package.json` `engines.node`, 스크립트: `dev` `build` `start` `lint` `typecheck` `test:unit` `test:db` `test:e2e` `test:regression` `prepare`(`git config core.hooksPath .githooks`)
3. 개발 의존성: Vitest, Playwright, ESLint. 런타임: `@supabase/supabase-js`, `@supabase/ssr`, 입력 검증 라이브러리(zod 등) — 팀원이 쓸 것을 미리 넣어 월요일 lock 충돌을 줄인다. Gemini 호출용 패키지가 필요한지는 WU-31 전에 skygaul과 정한다
4. [06](../06-work-plan.md) 1절의 폴더를 모두 만든다(빈 파일은 `export {}` 또는 주석 한 줄)
5. `.gitignore`: `.env*` + `!.env.example`, `node_modules`, `.next`, `playwright-report`, `test-results`
6. `.env.example`: 이름과 설명만 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY`(eple 로컬 전용이라고 주석), `LLM_PROVIDER`, `LLM_MODEL`, `OLLAMA_BASE_URL`, `GEMINI_API_KEY`, `NEXT_PUBLIC_USE_MOCK`, `TEST_USER_A_EMAIL` 등 테스트 계정 변수, `E2E_BASE_URL`)
7. 비밀값 검사: `scripts/check-secrets.sh`(정규식은 여기 한곳), `.githooks/pre-commit`(스크립트 호출), `.githooks/allow-patterns`(첫 예외 `@packflow[.]test`와 이유 주석), 실행 권한 `git update-index --chmod=+x`
8. GitHub Actions `.github/workflows/ci.yml`: PR마다 `secret-check`(같은 스크립트, PR diff) · `lint` · `typecheck` · `test:unit`
9. `AGENTS.md` · 루트 `README.md`는 **초안이 이미 저장소에 있다(11/20)**. 골격의 실제 경로 · 명령과 맞는지 확인해 고치고, `CLAUDE.md`(`@AGENTS.md` 한 줄)를 추가한다
10. 이슈 양식 `.github/ISSUE_TEMPLATE/`(버그 · 결정 요청 · 구역 요청, [11 이슈 운영](../11-issues.md) 2절)과 라벨(`WU` · `bug` · `decision` · `request` · `docs` · `ai-case` · `step-1~5` · `blocked` · `after-mvp` · 담당자 아이디). 라벨 생성은 저장소 설정 변경이라 eple이 직접

**다 됐다의 기준**
- [ ] 새 폴더에 clone → `npm ci` → `npm run lint && npm run typecheck && npm run test:unit` 통과
- [ ] `git config core.hooksPath` → `.githooks`
- [ ] 가짜 키를 넣은 `.env.local`이 `git status`에 안 보임
- [ ] 가짜 JWT · 가짜 Supabase secret 키 · 가짜 Gemini 키를 넣은 파일 커밋이 로컬 훅에서 막힘, 같은 파일로 연 시험 PR에서 Actions `secret-check` 빨간불 (시험 PR은 닫고 브랜치 삭제)
- [ ] `@packflow.test` 예시가 있는 docs는 통과

## WU-02 Supabase 두 프로젝트 · 스키마 · 권한 · 계정

1. `packflow-dev`, `packflow-demo` 생성. dev는 이메일 확인 끄기(가짜 주소로 테스트 계정), demo는 회원가입 닫기
2. 마이그레이션(eple 소유): `<ts>_schema.sql`(4테이블 + `llm_usage`, 제약 · 복합 외래키 · 인덱스, **[04](../04-api-contract.md) 4.2절과 같은 범위의 CHECK** — 수량 · 금액 상한, 글자 수, 텍스트 칸 `length(btrim(x)) > 0`로 빈 문자열 금지), `<ts>_rls.sql`(RLS 켜기, SELECT 정책, `items` 컬럼 UPDATE 권한, anon 권한 회수), `<ts>_core_functions.sql`(`pf_require_user`, `pf_llm_take`)
3. sorek-charlie 소유 파일의 **자리**: `<ts>_inventory.sql`에 업무 함수(생성 · 입고 · 출고 · 취소 · 전이 판정)를 **이름 · 인자 · 반환형만** 두고 본문은 `raise exception 'PF_NOT_IMPLEMENTED'`. 파일 첫 줄에 "주인: sorek-charlie, 11/23부터 수정은 새 마이그레이션 또는 이 파일(적용 전)". `pf_bulk_apply` 자리는 eple 파일 `<ts>_bulk.sql`(WU-43에서 구현), `pf_reset_and_seed`는 WU-08에서 구현
4. Supabase CLI로 dev → demo 순서로 적용
5. 계정: demo에 시연 계정 A · B(대시보드에서 생성), dev에 테스트 계정 1인 2개 · 총 8개(`scripts/create-test-users.ts`: 환경변수에서만 읽음, `NEXT_PUBLIC_SUPABASE_URL`이 dev 프로젝트가 아니면 거부, 비밀번호 출력 안 함). 각자 계정 정보는 팀 비공개 채널로 개별 전달

**다 됐다의 기준**
- [ ] 두 프로젝트의 테이블 · 정책 · 함수 목록이 같음 (CLI `db diff` 또는 대시보드로 비교)
- [ ] dev에서 T-AUTH-4 · 5 · 6 통과 (REST 직접 호출: 남의 행 안 보임, `stock_qty` UPDATE 거부, `stock_logs` DELETE 거부)
- [ ] demo 주소로 계정 스크립트 실행 시 거부, 스크립트 출력 · 커밋에 키 · 비밀번호 없음

## WU-03 타입 · Supabase 클라이언트 · API 공통 · 인증

1. `src/types/erp.ts`: `Item` `Purchase` `Sale` `StockLog` `Dashboard` `BulkRow*`, 상태 · 사유 상수(`PURCHASE_STATUSES`, `SALE_STATUSES`, `PURCHASE_TRANSITIONS`, `SALE_TRANSITIONS`, `STOCK_REASONS`), `PfErrorCode`
2. `src/types/agent.ts` 완성(eple 소유 — 파트 간 계약, [04](../04-api-contract.md) 3.8 타입 그대로)
3. `src/lib/supabase/server.ts`(쿠키 → 사용자 JWT 클라이언트), `browser.ts`(로그인 화면용). 서비스 키를 읽는 코드는 `src/`에 두지 않는다
4. `src/lib/api/`: `errors.ts`(함수 예외 → `{error}` + HTTP, [04](../04-api-contract.md) 2절), `handler.ts`(라우트 공통: 로그인 확인, JSON 파싱, 오류 변환), `csrf.ts`(`X-PF` · Origin)
5. `src/middleware.ts`(화면 미로그인 → `/login`), `src/app/login/page.tsx`(이메일 · 비밀번호, 로그아웃 버튼은 레이아웃)
6. `src/lib/inventory.ts` **완성**(eple 소유): [03](../03-data-model.md) 4절 함수마다 `supabase.rpc(...)` 래퍼와 반환 타입. 함수 본문이 stub이라 지금은 `PF_NOT_IMPLEMENTED`가 그대로 올라오고, sorek-charlie가 SQL 본문을 채우면 바로 동작
7. 공통 유틸(eple 소유):
   - `src/lib/env.ts`: 필요한 환경변수를 한곳에서 읽고 없으면 시작 때 오류. 서버 전용 값(`GEMINI_API_KEY` 등)은 `server-only`로 표시해 화면 코드에서 가져오면 빌드가 실패하게
   - `src/lib/time.ts`: `todayRangeKst()` 등 한국 시간 기준 '오늘' 계산
   - `src/lib/log.ts`: 로그 함수. 키 · 비밀번호 · 이메일 · 프롬프트 전문은 남기지 않음(길이 · 코드 · 지연만)
8. 입력 검증 `src/lib/validation/`(eple 소유): [04](../04-api-contract.md) 4.1 정규화(공백 제거, 선택 칸 빈 값 → `null`, 숫자만, 대문자 품목코드, strict — 계약에 없는 필드 거부) + 4.2 필드 규칙을 zod 스키마로. 요청 종류마다 스키마 하나(`itemCreate`, `purchaseCreate`, `receive`, `saleCreate`, `bulkRow`, `chatMessage`, `poConfirm` …). 실패는 `PF_VALIDATION`의 `{field, reason, min, max}`(4.3)로
9. `src/lib/api/errors.ts`의 문구는 [04](../04-api-contract.md) 4.4 표 그대로(`PF_INTERNAL` 포함). 서버 원문 오류는 로그에만

**다 됐다의 기준**
- [ ] 로그인 · 로그아웃 동작, 미로그인 `GET /api/me` → 401, `X-PF` 없는 POST → 403 `PF_CSRF`
- [ ] `errors.ts` 단위 테스트: 함수 예외 코드 7종 → HTTP · 메시지 매핑
- [ ] `inventory.ts`의 래퍼가 [03](../03-data-model.md) 4절 함수 전부를 덮음, 호출 시 stub의 `PF_NOT_IMPLEMENTED`가 501로 보임
- [ ] 화면 컴포넌트에서 `env.ts`의 서버 전용 값을 가져오면 빌드 실패(한 번 시험 후 되돌림), `time.ts` 단위 테스트(자정 경계)
- [ ] T-VAL-7: 검증 스키마 단위 테스트 — 필드마다 최소 · 최대 · 하나 넘음 · 빈 값 · 형식, `""` → `null`, 계약에 없는 필드 거부

## WU-04 API stub · 목 데이터 · 에이전트 자리

1. [04](../04-api-contract.md) 3절의 **모든 라우트** 파일 생성. 각 라우트는 공통 handler를 거쳐 `501 PF_NOT_IMPLEMENTED`
2. `src/lib/mock/`(eple 소유): `dashboard.ts` `items.ts` `purchases.ts` `sales.ts` `stockLogs.ts` + 에이전트 응답 목(`PoDraft`, `ChatReply`) — 계획서 7절 시드 예시(PRD-001~003, P-101, S-201 · 202) 기준, 타입은 `erp.ts` · `agent.ts`. 품절 임박 · 오류 응답 사례도 하나씩
3. `src/lib/api-client.ts`(eple 소유, 화면 · 패널이 부르는 유일한 fetch 래퍼): `X-PF` 헤더 · `credentials` · 오류 `{error}` 해석을 여기서. `NEXT_PUBLIC_USE_MOCK=1`이면 목 응답, 아니면 실제 API. 라우트마다 함수 하나(`api.dashboard()`, `api.shipSale(id)` …). [04](../04-api-contract.md) 4.4 · 4.6대로: 15초 시간 초과 → `PF_TIMEOUT`, 연결 실패 → `PF_NETWORK`, 401 → `/login?next=<지금 경로>`, 오류 코드 → 문구
4. `src/components/agent/open.ts` **완성**(eple 소유, 파트 간 계약): `openAgentPanel({ mode: 'draft-po' | 'chat', sku_ids? })` — 화면이 패널을 여는 유일한 입구(이벤트 또는 컨텍스트로 `<AgentSlot />`에 전달)
5. 에이전트 자리(skygaul 소유): `src/lib/llm.ts`(함수 시그니처), `src/lib/agent/`(빈 파일), `src/app/api/agent/**`(501), `src/components/agent/AgentPanel.tsx`(빈 패널)

**다 됐다의 기준**
- [ ] 모든 라우트가 501 또는 목 응답, `typecheck` 통과
- [ ] `NEXT_PUBLIC_USE_MOCK=1`에서 `api-client`가 계약 모양의 목 응답을 돌려줌 (단위 테스트 1개)

## WU-05 화면 자리

1. `src/app/(app)/layout.tsx` + `src/components/layout/`(eple 소유): 상단 바(로그아웃 · 계정 표시 · 초기화 버튼 자리), 내비(대시보드 · 입출고 · 이력 · 품목), 오른쪽 `<AgentSlot />`(skygaul 패널이 들어갈 자리). 초기화 버튼 자리에는 jkspawn 폴더의 `src/components/demo/SeedResetButton.tsx`를 빈 컴포넌트로 만들어 꽂아 둔다(내용은 WU-15)
2. 공통 조각 `src/components/common/`(eple 소유, 화면 · 패널이 같이 씀): `ConfirmDialog`, `Toast`, `ErrorBanner`(`error.message` 표시, `PF_INSUFFICIENT_STOCK`이면 남은 수량 문장, 연결 실패 · 시간 초과면 [다시 시도], testid `error-banner`), `FieldError`(칸 아래 오류, 04 4.3 문구, testid `field-error-<필드>`), `SubmitButton`(요청 중 잠금 + "처리 중…"), `Loading`, `EmptyState`. 기본 스타일 토큰 `src/styles/`. 표시 형식 `src/lib/format.ts`(천 단위 쉼표, `+8` · `−6`, 한국 시간 날짜 — 04 4.6)
3. 빈 페이지: `src/app/(app)/page.tsx`(대시보드), `trades/page.tsx`, `history/page.tsx`, `items/page.tsx` — 제목과 "준비 중"만. **페이지 내용부터는 jkspawn 소유**

**다 됐다의 기준**
- [ ] 로그인 후 네 페이지(대시보드 · 입출고 · 이력 · 품목)가 열리고 내비로 이동됨, 미로그인 시 `/login`
- [ ] `openAgentPanel({mode:'chat'})`을 부르면 `<AgentSlot />`에 빈 패널이 열림
- [ ] 공통 조각 7종(`ConfirmDialog` · `Toast` · `ErrorBanner` · `FieldError` · `SubmitButton` · `Loading` · `EmptyState`)을 빈 페이지에서 한 번씩 써 봄(확인 후 지움), `format.ts` 단위 테스트
- [ ] 코드 전체에 `alert(` · `confirm(` · `prompt(` 호출 없음(검색)

## WU-06 Render 배포

1. Render Web Service(무료), Node 24, 빌드 `npm ci && npm run build`, 시작 `npm start`, `render.yaml`로 설정을 저장소에 둔다
2. 환경변수: demo 프로젝트의 URL · anon 키, `LLM_PROVIDER=gemini`, `GEMINI_API_KEY`(발급자가 직접 입력). **서비스 키 없음**
3. `GET /api/health` 실제 구현(DB 연결 확인)

**다 됐다의 기준**
- [ ] 배포 URL에서 시연 계정 A 로그인 → 빈 대시보드 (1일차 '최소 화면 배포' 해소)
- [ ] `/api/health` → `{status:"ok", db:"ok"}`
- [ ] Render 환경변수 목록에 서비스 키가 없음

## WU-08 테스트 기반 · 초기화 함수

sorek-charlie가 월요일에 **테스트 케이스만** 쓰면 되도록 구조를 미리 깐다.

1. `vitest.config.ts`(unit / db 두 프로젝트로 나눔: `test:unit`은 DB 없이, `test:db`는 `tests/db/**`), `playwright.config.ts`(`E2E_BASE_URL` 기본 `http://localhost:3000`)
2. `tests/db/helpers.ts`: `signIn('A' | 'B')`(환경변수의 테스트 계정으로 사용자 JWT 클라이언트), `resetAndSeed(client, dataset | data)`, `assertInvariants(client)`(03 6절 T-INV-1~4 검산), `makeItem(client, {...})`
3. `tests/e2e/helpers.ts`: 화면 로그인, API로 초기화
4. `<ts>_seed.sql`(eple 소유): `pf_reset_and_seed(data jsonb)` — 본인 데이터만 지우기 → 품목 + `재고조정` 기록 → 구매 · 판매 → `events`를 재고 함수로 차례대로 실행 → 건수 반환. 재고 함수가 아직 stub이면 `events`가 비어 있는 시드만 동작(월요일 WU-21 뒤 전부 동작)
5. `src/lib/seed/index.ts`: 이름(`demo` · `small` · `large`)으로 JSON 불러오기 + 형식 검사. 첫 판 `demo.json`은 계획서 7절 예시 그대로(이후 데이터 주인은 sorek-charlie)
6. 샘플 테스트 `tests/db/_sample.test.ts` 1개(로그인 → 초기화 → 품목 3개 확인 → 불변식) — 사용법 예시. sorek-charlie가 지워도 됨

**다 됐다의 기준**
- [ ] dev에서 `npm run test:db` → 샘플 통과
- [ ] 계정 A로 초기화 후 계정 B 데이터 건수 그대로 (T-AUTH-7)
- [ ] helpers에 키 · 비밀번호 · 이메일이 하드코딩돼 있지 않음(환경변수만)

## WU-07 작업 단위 문서

이 폴더의 문서들. 11/22 밤에 WU마다 GitHub 이슈를 하나씩 올리고(`WU` + 담당자 라벨, 본문은 WU 문서 링크), 11/23 오전 공유 때 각 담당자가 자기 WU를 읽고 질문 → 필요하면 eple이 고친다.

**다 됐다의 기준**
- [ ] 모든 WU 문서에 읽을 파일 · 만들 파일 · 다 됐다의 기준 · 테스트 방법이 있음

---

## Wave 0 끝 점검 (11/22 밤)

- [ ] WU-01~08 기준 모두 체크
- [ ] 비밀값 검사 통과 상태로 push, 계획서 2절 변경 이력에 한 줄
- [ ] 팀 채널에 공지: 저장소 주소, 배포 URL, "clone → `npm ci` → `.env.local` 채우기(값은 개별 전달) → 자기 WU 문서"

## 결과 (eple이 채움)

- 한 것:
- 직접 확인한 것:
- 확인 못 한 것:
- 커밋:
