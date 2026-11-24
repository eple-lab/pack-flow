# eple 이어받기 노트

마지막 갱신: 2026-11-23 밤 · 쓴 세션: eple의 Wave 0 마무리 세션 → WU-41 세션(Claude, 11/23) · **다음 세션은 0절의 '최신' 블록부터 읽는다.**

팀원이 여러 명이라 파일 이름 앞에 `eple-`을 붙였다. 이 노트는 **eple의 작업 흐름**을 이어받기 위한 것이다(팀원 각자의 진행은 work-units와 이슈로 본다).

## 세션 정보

| 항목 | 내용 |
|---|---|
| 목적 | 해커톤 계획서(`pack-flow-plan.md`)를 엔터프라이즈 아키텍처 관점의 작업 문서로 나누고, 4명이 **파일이 겹치지 않게 병렬로** 일하며 각자 에이전트가 문서만 보고 움직일 수 있게 한다 |
| 작업 위치 | 저장소 `eple-lab/pack-flow`(공개), 폴더 `docs/`, 루트 `AGENTS.md` · `README.md` |
| 참고한 곳 | `assignment/바이브 코딩 해커톤`(해커톤 안내 · ERP 주제), `task-hive`(문서 구조 · 파일 머리 · 고친 기록), `healing-forest-trip`(이슈 양식 · 바꾼 줄 주석 · 훅), `pack-flow-workspace/concept`(화면 시안, 참고만) |
| 관련 세션 | 11/19~20 문서 정리 세션 → 11/20~23 골격 세션(코드 2~6단계는 Sonnet 하위 세션이 작성, 관리 세션이 검토 · 커밋) → 11/23 Wave 0 마무리 세션(demo · Render · 이슈 · 리뷰 · 1차 병합) → 다음: WU-41 세션. 팀원 세션은 11/23부터 각자 |
| 남은 기간 | 11/22(일)까지 골격 → 11/23(월) 팀원 합류 → 11/24 14시 기능 동결 → 11/26 10:00 제출 |

## 0. 최신 상태 (2026-11-23 오후 — 다음 세션은 여기부터)

### 최신 (11/23 20시 무렵, WU-41 세션 마감) — 아래 16시 스냅샷보다 이것이 우선

- **2일차 완료 판정 1~4 모두 충족**(day-02 · 계획서 변경 이력 반영, #42). 배포 URL Playwright E2E Step 1 · 2 6건 통과(sorek-charlie)
- **오늘 병합(merge commit):** #28 · #29 · #31 · #32 · #34 · #35 · #36 · #37 · #38(WU-41) · #39(WU-42) · #40(WU-22 시드 3벌, demo 8품목) · #41(WU-43 1/2 `/api/seed`) · #42 · #43(seed C-65) · #44(WU-23 취소 · 상태 전이) · #45(WU-33 후속) · #51(WU-34 챗봇, 밤) → main `02b8ce2`
- **DB 마이그레이션 현황 — 다시 적용하지 않는다:**

  | 파일 | dev | demo |
  |---|---|---|
  | `20261123120000_inventory.sql`(WU-21) | 적용 | 적용 |
  | `20261123130000_inventory_cancel.sql`(WU-23) | 적용 | **미적용** |
  | `20261124090000_bulk_apply.sql`(WU-43, #46) | 적용(병합 전, eple 승인) | **미적용** |

  → **#46 병합 뒤 demo에 2개를 한 번에 적용**(eple 결정). 그 전까지 demo 서비스의 취소 · 상태 변경 · 일괄 반영은 501. CLI link는 dev
- **열린 PR(밤):** #46 WU-43 (2/2) `pf_bulk_apply` · bulk 라우트(리뷰 sorek-charlie — dev에서 `test:db` 76건 통과, WU-23 시험 포함) / #47 04 계약 3.8 `saved_count` · `saved`(리뷰 skygaul) / #48 이 노트 / #49 WU-45 / #50 WU-41 · 42 · 43 · 45 결과 절 · `ai-cases-eple.md` / #52 WU 문서 8개 테스트 방법 절(**#50 다음 병합**) / #53 DevelopDoc 4개 · README 초안 — #47 말고는 모두 리뷰 sorek-charlie
- **WU-45 회귀 실행기 · 측정:** PR 올림(`feat/WU-45-regression-runner`, 리뷰 sorek-charlie). `npm run test:regression` · `npm run measure` — E2E(Playwright) 경로는 브라우저 · 로컬 서버가 없어 미확인, 리뷰어 PC에서 첫 확인. tsconfig `allowImportingTsExtensions`를 켜고 우회 주석 4곳 제거(eple 결정, #49에 포함)
- **다음 단계 (11/24, 14시 기능 동결):**
  1. #46 리뷰 · 병합 → demo 마이그레이션 2개 적용(dry-run으로 2개만 확인) → demo 서비스 취소 · 일괄 반영 확인
  2. WU-45 리뷰 · 병합 → sorek-charlie 첫 회귀(WU-24)
  3. 중간 점검 기록(계획서 2절, 오후) — 완료 · 미완료 · 범위 조정(A/B안)
  4. 팀원: jkspawn WU-13 일괄 등록 화면(`src/lib/bulk/parse.ts` 채우면 `/api/bulk/preview` 501 해소) · WU-14 이력 · 취소 화면, skygaul WU-34 챗봇, sorek-charlie WU-24
- **위험(11/23 밤):** jkspawn의 WU-13(일괄 등록 화면) · WU-14(이력 · 취소 화면) · WU-15 브랜치가 아직 없다. API는 준비됨. 11/24 아침에 진행 확인 → 늦으면 줄일 순서 A/B안(일괄 등록은 미리보기까지 / 취소만) 팀 결정
- **eple 결정 대기:** ① 병합된 WU 이슈 닫기 — 팀 규칙(docs/11-issues.md 96~102)은 '리뷰어가 실제 동작 확인 항목을 체크한 뒤 **담당자**가 닫는다' ② LICENSE(README '미정') — 나중에 다시 묻기로
- **이력 비밀값 점검(11/23 밤, 읽기만):** 147커밋에서 실제 키 · 토큰 · 비밀번호 · 사용자 경로 · 프로젝트 ref 0건. 커밋 작성자 메타데이터에 개인 Gmail 2종(eple 공개 주소 — 레이어 2에서 허용 / 팀원 1명 — 본인에게 noreply 설정 안내 권장). 실명은 목록 없이 자동 판정 못 함 — 11/25 보안 점검 때 실명 목록으로 다시
- **주의:**
  - 대시보드 주소는 `/`. PowerShell 실행 정책으로 `npm.ps1`이 막히면 `npm.cmd`
  - 마이그레이션 적용은 별도 임시 worktree에서(작업 폴더의 미검토 마이그레이션이 같이 올라가지 않게, 로컬에 원격 버전 파일이 모두 있어야 CLI가 받음) → dry-run → `--yes`
  - 하위 에이전트 worktree에서 `npm ci`가 2분 제한에 걸리면 node_modules가 깨진다 — DB · 시험이 필요한 일은 원래 폴더에서
  - 테스트 계정은 사람마다 A · B. 한 팀원 계정은 로그 노출로 11/23 재생성
  - 병합된 WU 이슈(#7 · #8 · #9 · #13 · #14 · #15 · #17 · #18 · #19 · #22 · #23 · #24)는 열린 채(Refs 규칙) — 닫을지 eple 결정
- **AI 사례 후보(eple, `docs/records/ai-cases-eple.md` 기록 여부 eple 판단):** 판매 시험 field 복제 실수 · `/api/seed` 시험에 가짜 클라이언트 대신 도우미 객체 전달 · 하위 에이전트 bulk 시험 tsv 끝 칸 문제 — 모두 시험이 잡음

### 끝난 것 (Wave 0)

- 골격 WU-01~05 · 08, Supabase dev(마이그레이션 6개 · 테스트 계정 8개 · 권한 시험 10건) — [records/eple-skeleton-review.md](records/eple-skeleton-review.md), [records/eple-supabase-setup.md](records/eple-supabase-setup.md)
- **WU-06 배포 끝 (기준 3개 모두 체크)** — [records/eple-wu06-checks.md](records/eple-wu06-checks.md)
  - Render 서비스 두 개(D-37): `pack-flow` https://pack-flow.onrender.com (Supabase **dev**, 팀 테스트 · 배포 URL E2E) / `pack-flow-demo` https://pack-flow-demo.onrender.com (Supabase **demo**, 시연). `render.yaml` · `render.demo.yaml`, main 병합 때마다 둘 다 재배포
  - Supabase demo(`pack-flow-demo`, 싱가포르): 마이그레이션 6개 적용 · dev와 구조 지문 같음, 회원가입 끔, 시연 계정 A · B(주소 · 비밀번호는 eple 비밀번호 관리자), 계정 스크립트 거부 확인. eple 로컬 `.env.demo`(git 무시 확인)
  - CLI link는 **dev**로 돌려 둠
- **WU-07:** WU 이슈 20건 #7~#26(라벨 `WU` · 담당자 · `step-N`, 담당 지정 없음). 남은 것: WU 문서 7개(WU-15 · 35 · 41~45)에 '테스트 방법' 절 없음, WU-44는 '읽을 파일'도 없음
- 팀 안내: workspace 저장소 `guide/01-start-notice.md`(시작 공지) · `guide/02-commit-review-rules.md`(커밋 · 리뷰 규칙), 디스코드 파트별 공지
- 리뷰 · 병합: eple이 PR #3(WU-32) · #6(WU-31) 리뷰 · 승인(브랜치를 받아 실행 + 리뷰용 임시 시험). **1차 병합 6건**(#27 · #30 · #3 · #6 · #4 · #5, merge commit) → 합친 main `4fb5626`에서 lint · typecheck · test:unit 517 통과
- 결정: D-36(11/23 Wave 0 마무리 main 직접 — 예외, 지금은 끝), D-37(Render dev · demo 두 서비스). 계획서 최종 판정 기준 겹침 정리(PR #31)

### 열린 PR · 기다리는 것 (11/23 16시 무렵)

| PR | 내용 | 상태 |
|---|---|---|
| #31 | WU-44 일자별 기록 `docs/daily/day-01 · 02`(공개용 사본, 실명 → GitHub 아이디) · 계획서 판정 기준 | sorek-charlie 리뷰 대기 |
| #32 | WU-06 demo 적용 · 시연 서비스 확인 기록 | sorek-charlie 리뷰 대기 |
| (이 노트) | 이어받기 노트 갱신 | 리뷰 대기 |
| #29 | **WU-21 재고 함수 1 (sorek-charlie)** — 새 마이그레이션 `20261123120000_inventory.sql` | jkspawn 리뷰 대기 |
| #28 | WU-16 품목 화면 (jkspawn) | 승인됨, 병합 전 |

- jkspawn이 **병합 뒤** `feat/WU-11-dashboard`(3개) · `feat/WU-12-trades`(1개)에 결과 절 문서 커밋을 더 push함 → main에 안 들어감. 새 PR 필요(전달할 것)
- 일자별 기록은 이제 `docs/daily/`가 원본(assignment 저장소의 원본 양식은 eple 관리). 3~5일차도 여기에

### 다음 세션: WU-41 업무 API 실제 연결 (eple, 리뷰 sorek-charlie, 이슈 #22)

- 문서: [work-units/WU-41-api-core.md](work-units/WU-41-api-core.md), 계약 [04](04-api-contract.md) 1~3.5 · 4절, 테스트 ID [07](07-test-strategy.md)(T-S1-3 · T-S4-2 · T-VAL-2~4)
- 골격에 있는 것: 라우트 13개가 `createHandler` + 검증 스키마로 묶여 있고 `run: stubRun()`(501)만 바꾸면 된다. 재고 래퍼 `src/lib/inventory.ts` 완성. 없는 것: `src/lib/queries/`, `tests/api/`
- 브랜치 `feat/WU-41-api-core`. 단계(각 단계 기대 결과 먼저 — D-34):
  1. 조회 라우트(items + `below_safety`, items/[sku_id], purchases · sales status 필터) — WU-21 불필요
  2. `src/lib/queries/dashboard.ts` + 라우트(KPI · 파이프라인 · 품절 임박 · 최근 5건, 오늘 = Asia/Seoul)
  3. `src/lib/queries/stockLogs.ts` 키셋 페이지네이션(limit 1~50 기본 20, `next_cursor` base64, 잘못된 값 400) · T-S4-2
  4. 변경 라우트 8개 → `inventory.ts`(가짜 rpc 단위 시험), `PATCH items`의 `stock_qty` → 400
  5. `tests/api/validation.test.ts` T-VAL-2 · 3 · 4
  6. 통합: **#29 병합 → eple 확인 후 dev에 새 마이그레이션 적용**(`npx supabase@3.2.0 db push --remote`, 에이전트 실행이면 확인 뒤 `--yes`) → `test:db` → 로컬 `NEXT_PUBLIC_USE_MOCK=0`으로 입고 → 출고 → 대시보드 갱신 → **demo에도 같은 마이그레이션 적용**(link를 demo로 바꿨다 되돌림)
  7. lint · typecheck · test:unit → PR(리뷰어 sorek-charlie, `Refs #22`)
- 방식(추천): 관리 세션이 단계마다 기준을 주고 Sonnet 하위 에이전트에 구현을 맡기고, 반복 검사는 Haiku. 결과는 관리 세션이 기준 명령을 다시 돌려 확인한 뒤 커밋(아래 '배운 것')

### 그 밖에 남은 일 (eple)

- WU-42 권한 테스트 · 배포 검증(WU-41 · WU-22 뒤, 배포 URL `pack-flow`에서 sorek-charlie가 E2E)
- WU 문서 7개 '테스트 방법' 절 보충(WU-07 기준) — Haiku에 맡기기 좋음
- WU-00 'Wave 0 끝 점검' 체크리스트 체크 · 결과 절
- 저녁: 2차 병합(#28 · #29 · 문서 PR들) → 합친 버전 실행 → `docs/daily/day-02.md` 저녁 갱신(완료 판정 체크) · 계획서 변경 이력 한 줄
- 3일차(11/24 14시 기능 동결) 줄일 순서 A/B안 — 팀 결정(`decision` 이슈)

### 주의

- CLI는 `npx supabase@3.2.0 … --remote`(빼면 로컬 Docker를 찾음 — 11/23에도 한 번 빠뜨림). 원격 변경은 에이전트 실행에서 확인 단계가 있어 eple 승인 뒤 `--yes`, 읽기 조회는 `db query --remote --read-only`
- `.env.local` · `.env.demo`는 열거나 출력하지 않는다(읽기 시도는 권한 확인에서 거부됨). demo 값이 필요한 시험은 eple 터미널에서 돌린다
- 시연 계정 주소는 공개 문서 · 캡처에 넣지 않는다(비밀값 훅이 이메일로 잡음)
- 병합할 때 브랜치를 지워도 작성자가 다시 push할 수 있다 — 병합 뒤 남은 커밋 확인
- 승인 · 병합 · 이슈 같은 외부 작업은 매번 확인받는다. 리뷰 댓글 문구도 먼저 보여 준다

### 골격 세션에서 배운 것 (11/20~23)

- **밤새 맡기기 실패:** 관리 세션이 토큰 한도로 멈추면 하위 세션도 시작되지 않는다. 오래 걸리는 일은 하위 세션을 먼저 띄우고 나서 다른 일을 한다
- **Sonnet + Haiku 방식이 잘 됐다:** 단계마다 다 됐다의 기준을 주고, Sonnet은 반복 작업을 Haiku에 기준과 함께 위임, 관리 세션이 기준 명령 재실행 · 핵심 파일 읽기 후 커밋. Sonnet이 Haiku를 백그라운드로 띄운 채 턴을 끝내면 멈추므로 "끝까지 마치고 보고"를 지시에 넣는다
- **시험이 결함을 잡았다:** 비밀값 훅 4건(WU-01), 함수 PUBLIC 권한 1건(WU-02), SubmitButton Promise 1건(5단계) — 모두 기대 결과를 먼저 적은 중간 시험에서(D-34)
- **Supabase CLI 3.x:** 원격은 `--remote` 필수, `link` 전에 `login`. 대시보드 프로젝트 이름이 `packflow-dev`가 아니라 `pack-flow`로 보임 — demo 만들 때 이름 확인
- 이 세션의 결정: D-27~35 (Gemini 키 · 계정 주인 · Node 확인 · proxy.ts · CSS 모듈 · 캐시 컴포넌트 끔(D-32는 eple 확인 대기로 적혀 있음) · 버전 고정 · 중간 시험 · Data API 설정)

## 1. 지금 어디까지 왔나

| 항목 | 상태 |
|---|---|
| 기획 · 설계 문서 `docs/00~13`, `wireframes.html`, `work-units/`(WU 22개 + 양식) | 끝. 로컬 main에 커밋 |
| 루트 `AGENTS.md` · `README.md` | 초안. 골격 경로 · 명령에 맞춰 WU-01에서 다듬는다 |
| 코드 | 2026-11-23: WU-01 · 02 · 03 · 04 · 05 · 08 코드 커밋 끝(`b757e8b`까지). 남은 것: Supabase 연결 · 적용 · 실제 로그인 확인, WU-06 Render 배포, WU-07 이슈. 검토 기록 [records/eple-skeleton-review.md](records/eple-skeleton-review.md) |
| 원격(origin) | 2026-11-20 push 완료. Claude 커밋은 모두 작성자 `eple-lab (Claude)`(push 전에 folia로 잘못 된 18개를 정리함) |
| Supabase · Render · Gemini 계정 | 아직 안 만듦 |

## 2. 다음에 할 일 (순서대로)

1. **[08](08-open-questions.md) 1절을 정한다** — Q-02 Gemini 키 발급자, Q-03 Supabase · Render 계정 주인 · 팀원 초대, Q-05 팀원 Node 24 확인 요청
2. **[WU-00 골격](work-units/WU-00-skeleton.md)을 WU-01 → 08 순서로** (main 직접 push, D-13). 각 WU의 "다 됐다의 기준"을 직접 돌려 확인
   - WU-01 골격 · 훅 · CI · `.gitignore` → WU-02 Supabase 두 개 · 스키마 · RLS · 함수 자리 · 계정 → WU-03 타입 · 인증 · 검증 스키마 · 공통 유틸 · 호출 래퍼 → WU-04 API stub · 목 · `api-client` → WU-05 앱 뼈대 · 공통 조각 → WU-06 Render 배포 → WU-08 테스트 기반 · 초기화 함수 → WU-07 WU 이슈 올리기
   - 범위가 커서(D-21) **WU 하나씩 하위 세션에 맡기고 결과를 직접 확인**하는 방식을 추천한다(task-hive HANDOFF 방식: 한 번에 하나, 규모를 먼저 알리고)
3. 11/22 밤 [WU-00 끝 점검](work-units/WU-00-skeleton.md) — 배포 URL, 팀 공지, WU 이슈
4. 11/23 오전: 팀 공유 → 08 2절(Q-11~17) 결정 → 이후 eple도 브랜치 + PR(리뷰어 sorek-charlie)

## 3. 다음 세션이 읽을 순서

1. 이 노트
2. [docs/README.md](README.md) — 목차
3. [02 결정 기록](02-decisions.md) — D-01~26, P-01~19 (모두 확정)
4. [06 작업 계획](06-work-plan.md) 1절(파일 소유 구역) · 4절(브랜치 · PR · 병합)
5. [WU-00 골격](work-units/WU-00-skeleton.md) — 지금 할 일
6. 필요할 때: [03 데이터 모델](03-data-model.md), [04 API 계약](04-api-contract.md)(4절 입력 규칙 포함), [05 보안](05-security.md), [12 코드 작성 가이드](12-coding-guide.md)

## 4. 이 세션에서 정한 것 (요약 — 원본은 02)

- 데이터 4테이블 + 재고는 **Postgres 함수(RPC) 한 트랜잭션**(D-10), Supabase 두 개(dev · demo) + Vitest · Playwright(D-11)
- 브랜치: 11/22까지 eple main 직접, 11/23부터 전원 `feat/WU-번호-주제` + PR + merge commit(D-13~15)
- 서비스 키 다섯 겹 · git 훅 자동 설치 · Actions 같은 검사(D-20)
- **구조 작업은 eple로**(D-21): 골격에서 공통 층을 완성본으로 깐다 → eple Wave 0 분량이 크다
- 품목 화면 추가(D-22), 화면 원본 `wireframes.html`(D-23), 입력 규칙 04 4절(D-24), 코드 작성 가이드(D-25), 시연 순서 출고 → 카드 → 입고(D-26)

## 5. 주의할 점 (이 세션에서 배운 것)

- **커밋 작성자:** Claude가 커밋할 때는 레이어 2 규칙대로 그 커밋에만 `git -c user.name="eple-lab (Claude)" -c user.email=<eple 공개 주소> commit …`(하위 세션은 `eple-lab-sub (Claude)`). 저장소 설정은 바꾸지 않는다. 이 세션은 처음에 레이어 2 원문을 읽지 않고 전역 설정(folia)으로 커밋했다가 정리했다 — **세션의 첫 커밋 전에 가이드 `layers/2-project-common.md` · `3-git-projects.md` 원문을 읽는다.**
- **공개 저장소:** 문서 · 코드를 쓴 뒤 매번 실명 · 비밀값 · 이메일 패턴 검사를 직접 돌린다. 팀원은 GitHub 아이디로만 적는다. 문서에 비밀값 패턴 예시를 그대로 적으면 훅에 걸린다(정규식은 `scripts/check-secrets.sh` 한곳).
- **원본은 하나:** 화면은 `wireframes.html`, 입력 규칙 · 오류 문구는 04 4절, 파일 주인은 06 1절, 결정은 02. 다른 문서는 링크만.
- **push 전 확인:** 바뀐 파일을 보여 주고 "형상관리에 올려도 될까요?"로 묻는다(가이드 update-rules).
- 커밋은 카테고리별로 나눈다(eple이 선호).

## 6. 확인하지 못한 것

- Supabase 무료 플랜의 팀원 초대 가능 여부, 이메일 확인 끄기 설정 위치, Gemini 실제 하루 한도, GitHub Push protection의 공개 저장소 무료 여부
- `wireframes.html`의 다크 모드 표시(앱 안 브라우저가 로컬 파일을 밝게만 그림)
- 이 문서들대로 Wave 0을 주말 이틀에 끝낼 수 있는지 — 진행하며 범위를 조정한다
