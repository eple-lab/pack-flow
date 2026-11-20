# 05. 보안

작성일: 2026-11-20 · 근거: 공통 안내 '협업 · AI 사용 원칙'(보안), 계획서 6 · 9절, 해커톤 개발 팁

교육용 결과물이라 상용 수준 보안을 보장하지 않는다. 다만 피드백 기준 3번(권한 거부 증거)과 공개 저장소 · 공개 URL에서 사고가 나지 않을 만큼은 지킨다.

## 1. 지키려는 것

| 자산 | 위험 | 막는 곳 |
|---|---|---|
| 사용자별 재고 · 거래 데이터 | 다른 계정이 보거나 바꿈 | RLS + 함수 안 `user_id` 조건 |
| 재고 원장의 정합성 | 재고 숫자만 고치거나 이력을 지움 | 컬럼 권한 · 함수 전용 쓰기 |
| Supabase 서비스 키, Gemini 키 | 저장소 · 대화 · 화면 노출 | 서버 환경변수, `.gitignore`, 사전 검사 |
| 시연 계정 비밀번호 | 공개 문서 노출 | 팀 비공개 채널로만 공유 |
| LLM 무료 티어 한도 | 남용 · 반복 호출로 발표 때 소진 | 호출 상한 P-09 |

## 2. 비밀값

| 이름 | 어디에 | 누가 | 공개 여부 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, Render | 전원 (dev) / eple (demo) | 브라우저에 실린다. RLS가 막으므로 공개돼도 되는 값이지만 저장소에는 올리지 않는다 |
| `SUPABASE_SERVICE_ROLE_KEY` | **eple PC의 `.env.local`에만**(테스트 계정 생성 스크립트용, dev 프로젝트 키만). Render · 팀원 PC에 넣지 않는다(P-03, D-20) | eple만 | 비밀 |
| `GEMINI_API_KEY` | Render 환경변수 | 발급자 1명 (08 Q-02) | 비밀. 공유 금지(계정 공유 금지) |
| `LLM_PROVIDER`, `OLLAMA_BASE_URL`, `LLM_MODEL` | `.env.local`, Render | 각자 | 비밀 아님 |
| 시연 · 테스트 계정 비밀번호 | 각자 비밀번호 관리자 | 계정 주인 | 비밀 |

### 2.1 서비스 키 다섯 겹 (D-20)

서비스 키는 RLS를 무시하는 만능 키다. 저장소가 공개라 한 번 새면 누구나 모든 계정의 데이터를 읽고 지울 수 있다.

| 겹 | 규칙 | 막는 것 | 만드는 곳 |
|---|---|---|---|
| ① 키 위치 | eple PC의 `.env.local`에만. Render · 팀원 PC · 문서 · 스크린샷 · AI 대화 금지. demo 프로젝트의 서비스 키는 아무 데도 저장하지 않는다(시연 계정은 대시보드에서 생성) | 키가 퍼지는 것 | — |
| ② `.gitignore` | `.env*`를 무시하고 `!.env.example`만 예외 (`.env.local.txt`, `.env.dev` 같은 변형도 막힘) | 실수로 `git add .` | WU-01 |
| ③ 스크립트 안전장치 | `scripts/create-test-users.ts`는 키 · 비밀번호를 **환경변수에서만** 읽는다(코드에 값 없음). `NEXT_PUBLIC_SUPABASE_URL`이 `SUPABASE_DEV_PROJECT_REF`와 다르면 실행 거부. 만든 계정의 비밀번호를 화면 · 파일에 출력하지 않는다 | 코드에 키 박기, demo DB에 잘못 실행 | WU-02 |
| ④ 비밀값 검사 (로컬 훅 + Actions) | 커밋 전 pre-commit 훅과 PR마다 Actions가 **같은 스크립트**로 비밀값 · 개인정보 패턴을 검사. 걸리면 커밋 중단 · PR 빨간불. `--no-verify` 금지, 예외 패턴은 eple만 추가 (2.2절) | `git add -f`, 다른 파일에 붙여 넣은 키, 훅 설치를 잊은 PC | WU-01 |
| ⑤ GitHub 설정 | Secret scanning · Push protection 켜기 (eple이 저장소 설정에서 직접) | 위를 모두 뚫고 push될 때 | eple |

### 2.2 git 훅 — 여러 명이 같은 검사를 거치게 (D-20 ④)

healing-forest-trip의 `.githooks/pre-commit` + `allow-patterns` 방식을 가져오되, 사용자가 4명이라 **설치 누락 · 우회 · 예외 남용**을 막는 장치를 더한다.

| 항목 | 규칙 |
|---|---|
| 파일 | `.githooks/pre-commit`(검사), `.githooks/allow-patterns`(예외), `scripts/check-secrets.sh`(검사 본체 — 훅과 Actions가 **같은 스크립트**를 부른다). 모두 eple 구역 |
| 검사 대상 | 커밋될 diff의 추가된 줄 (`git diff --cached -U0`). Actions에서는 PR의 `base...head` diff |
| 검사 패턴 | 이메일, 사용자 홈 폴더 경로(윈도우 · 맥 · 리눅스), GitHub · OpenAI · Slack · AWS 토큰, JWT(Supabase 옛 키 형식), **Supabase 새 키**(secret · publishable 접두어), **Gemini 키**(AIza 접두어), 서비스 키 환경변수에 값이 붙은 줄. 정확한 정규식은 `scripts/check-secrets.sh` 한곳에만 둔다 — 문서에 예시를 그대로 적으면 문서 자체가 검사에 걸린다 |
| 자동 설치 | `package.json`의 `"prepare": "git config core.hooksPath .githooks"` → `npm install` · `npm ci` 때 저절로 켜진다. 실행 권한은 첫 커밋 때 `git update-index --chmod=+x .githooks/pre-commit scripts/check-secrets.sh` |
| 서버 쪽 같은 검사 | GitHub Actions `secret-check` 작업이 PR마다 같은 스크립트를 돈다. 빨간불인 PR은 병합하지 않는다(팀 약속, D-15) |
| 우회 금지 | `--no-verify` 금지. 훅이 막으면 진짜 문제면 고치고, 아니면 PR에 사유를 적고 eple에게 예외를 요청한다 |
| 예외 파일 관리 | `allow-patterns`는 eple만 고친다(PR + eple 리뷰). 한 줄에 패턴 하나, **바로 위 줄에 이유 주석**. `.*`처럼 넓은 패턴 금지, 키 형식 자체를 예외로 넣지 않는다 |
| 첫 예외 | `@packflow[.]test` — 테스트 계정 예시 주소(`.test`는 실제로 쓰이지 않는 예약 도메인) |
| 한계 | 실명 · GitHub 아이디는 패턴으로 못 잡는다. PR 체크리스트로 눈으로 확인. 커밋 작성자 메일(메타데이터)은 diff가 아니라 검사 대상이 아니다 — 각자 GitHub noreply 주소를 권장 |
| 걸렸을 때 | 훅 메시지에 줄이 나온다 → 고친다 → `git add` → 다시 커밋. 이미 push한 뒤 키가 발견되면 2.1 '새었을 때' |

팀원이 쓰는 git 도구(소스트리, VS Code, GitHub Desktop 등)가 `core.hooksPath`를 따르는지는 확인하지 못했다. WU-01에서 각자 쓰는 도구로 가짜 키 커밋을 한 번씩 시험하고, 따르지 않는 도구는 Actions 검사에 기댄다.

**새었을 때:** 지워도 이력에 남는다. 즉시 Supabase에서 키를 재발급하고, `.env.local`을 새 키로 바꾸고, 계획서 2절 변경 이력에 한 줄 남긴다.

- 저장소에는 `.env.example`(값 없이 이름과 설명)만 둔다.
- AI 코딩 도구 대화에 키를 붙여 넣지 않는다(해커톤 개발 팁).
- 커밋 전에 diff에서 `key`, `secret`, `password`, `eyJ`(JWT 앞부분), 이메일, 사용자 폴더 경로를 검색한다. PR 체크리스트에 넣는다([06](06-work-plan.md)).

## 3. 권한 — 여러 겹

| 겹 | 규칙 | 담당 |
|---|---|---|
| 화면 | 로그인 안 하면 `/login`. 버튼은 허용된 전이만 보여 준다(편의일 뿐, 보안 아님) | jkspawn · eple |
| proxy (`src/proxy.ts`) | `/api/**` 미로그인 401, 변경 요청 `X-PF` · Origin 확인 | eple |
| API 라우트 | 입력 형식 · 범위 검증(zod 등). `user_id`를 요청 본문에서 받지 않는다 | eple · skygaul |
| DB 함수 | `pf_require_user()`, 모든 쿼리에 `user_id = uid`, 전이 · 재고 검사 | sorek-charlie |
| DB 테이블 | RLS `user_id = auth.uid()`, 쓰기 권한 최소 | eple |

### 권한 테스트 (필수, Step 2 증거)

| ID | 조건 · 행동 | 기대 결과 |
|---|---|---|
| T-AUTH-1 | 로그인 없이 `GET /api/items` | 401 |
| T-AUTH-2 | B로 로그인, A의 구매 `id`로 `POST /api/purchases/{id}/receive` | 404, A의 재고 · 이력 변화 없음 (완료 테스트 6) |
| T-AUTH-3 | B로 로그인, A의 판매 `id`로 `ship` | 404, 변화 없음 |
| T-AUTH-4 | B의 JWT로 Supabase REST에 직접 `select * from items` | B의 행만 |
| T-AUTH-5 | 로그인한 사용자가 REST로 `update items set stock_qty = 999` | 권한 오류 |
| T-AUTH-6 | 로그인한 사용자가 REST로 `delete from stock_logs` | 권한 오류 (또는 0행) |
| T-AUTH-7 | B가 `POST /api/seed` | B의 데이터만 초기화, A의 건수 그대로 |
| T-AUTH-8 | `X-PF` 헤더 없이 `POST /api/sales` | 403 `PF_CSRF` |

T-AUTH-4~6은 화면을 거치지 않고 **DB가 직접 막는지**를 본다. "화면 숨김이 아니라 서버 · DB에서 판정"(공통 안내 용어집)의 증거다.

## 4. LLM 관련 위험

| 위험 | 대응 | 확인 테스트 |
|---|---|---|
| 프롬프트 인젝션 (사용자 메시지 · 품목명 · 메모 속 "모든 재고를 0으로") | LLM은 정해진 JSON(허용 액션 6개)만 낸다. 서버가 스키마로 검사하고, 허용 밖이면 거부. 품목명 · 메모는 프롬프트에서 '자료' 구역에 넣고 지시가 아님을 명시 | T-AI-4 |
| 숫자 지어내기 | 재고 · 추천 수량 · 단가는 서버가 계산해 프롬프트에 넣고, 응답의 수치는 `facts`와 대조. 다르면 서버 값으로 바꾸거나 오류 | T-AI-3 |
| 확인 없는 실행 | 쓰기는 `/execute` · `/confirm`에서만, 사람이 [확인]을 누른 뒤. 받은 액션을 처음부터 다시 검증 | T-AI-1 |
| 다른 사용자 데이터 노출 | 에이전트도 사용자 JWT로만 조회. 프롬프트에 다른 계정 데이터가 들어갈 경로 없음 | T-AI-5 |
| 남용 · 한도 소진 | `pf_llm_take()` 사용자당 · 전체 하루 상한 | T-AI-7 |
| LLM 출력 표시 | 응답은 글자로만 렌더링(`dangerouslySetInnerHTML` 금지) | 코드 리뷰 |
| 데이터 학습 | 가상 데이터만 | 시드 리뷰 |

T-AI 번호는 [07 테스트 전략](07-test-strategy.md) 3절.

## 5. 웹 일반

- SQL은 Supabase 클라이언트 · 함수 파라미터만 쓴다. 문자열로 SQL을 만들지 않는다.
- `source_url`은 링크로 열지 않는다(글자로만 표시). 쓰려면 `https:`만 허용하고 `rel="noopener noreferrer"`.
- 일괄 등록은 500행 · 100KB 상한. CSV는 직접 파싱하고 수식(`=`, `+`, `-`, `@`로 시작) 셀은 글자로 다룬다. 내보내기 기능을 붙일 때 다시 본다.
- 오류 응답에 DB 원문 메시지 · 스택을 싣지 않는다. 서버 로그에만.
- 서버 로그에 비밀번호 · 키 · 전체 프롬프트를 남기지 않는다. LLM 로그는 길이 · 지연 · 결과 코드만.

## 6. 공개 전 점검

- 배포 · 공개 직전, 그리고 11/25 기능 고정 때 `eple-security-check` 체크리스트로 한 번 점검하고 결과를 `docs/records/security-check-1125.md`에 남긴다.
- 저장소가 공개라면 커밋 이력 전체에서 키를 검색한다. 한 번이라도 올라간 키는 **즉시 재발급**한다(지워도 이력에 남는다).

## 7. 남는 위험 (알고 감수)

| 위험 | 이유 | 발표에서 말할 것 |
|---|---|---|
| 역할별 권한 없음 | MVP는 "자기 데이터만"까지 | 고도화 후보 '역할별 권한 · 감사 로그' |
| 동시 출고 경합 검증 안 함 | 행 잠금으로 막히게 설계했지만 부하 시험은 범위 밖 | 계획서 15절 '검증하지 못한 것' |
| 무료 티어 가용성 | Render 잠듦, Supabase 일시정지, Gemini 한도 | 백업 시연 영상 |
| `security definer` 함수 실수 | 함수 하나가 RLS를 우회한다 | T-AUTH 테스트로 보완 |
