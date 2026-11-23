# 2일차 (11/23 월) — POC → MVP, 본격 개발

> 해커톤 2일차 진행 기록(공개용). 원본 양식은 eple이 관리하고, 이 사본이 결과 보고의 근거다.

**공통 진행표 2일차 목표:** 핵심 흐름 하나가 처음부터 끝까지 동작
**우리 계획(계획서 일정):** Step 1 흐름 완성 + Step 2(로그인 · RLS), Render 배포 후 **검증 담당이 배포 URL에서 테스트**

팀원 표기는 GitHub 아이디(eple · sorek-charlie · jkspawn · skygaul). 근거 문서는 이 저장소 `docs/`. 1일차는 [day-01](day-01.md).

---

**아침 출발점 (휴강 중 Wave 0 골격 — eple):**

- 골격 완료: 앱 뼈대 · 로그인 · 네 화면 자리 · API 자리(stub) · 목 데이터 · DB 스키마 · 권한(RLS) · 테스트 기반 · 비밀값 검사 훅 (WU-01~05 · 08)
- Supabase dev: 마이그레이션 6개 적용, 테스트 계정 8개, 실제 권한 시험 10건 통과
- **배포:** https://pack-flow.onrender.com — `/api/health` ok, 로그인 확인 (1일차 '최소 화면 배포' 해소). 지금은 dev DB 연결, demo DB는 오늘 중 교체 예정
- 팀원 안내: 시작 공지 · 커밋 · 리뷰 규칙 문서(workspace `guide/`)

**오늘 사람별 할 일 (WU 하나 = 브랜치 하나 = PR 하나):**

| 사람 | 오늘 WU | 리뷰어 |
|---|---|---|
| eple | Wave 0 마무리(demo DB · WU 이슈) → WU-41 업무 API 실제 연결 → WU-42 권한 테스트 · 배포 검증 | sorek-charlie |
| sorek-charlie | WU-21 재고 함수 1(등록 · 입고 · 출고) → WU-22 시드 · E2E Step 1 · 2 | jkspawn |
| jkspawn | WU-11 대시보드 · WU-12 입출고 화면(목 → 실제) → WU-16 품목 화면 | skygaul |
| skygaul | WU-31 LLM 호출층 · 호출 상한 · WU-32 발주 후보 계산 | eple |

- 핵심 경로: **WU-21(재고 함수) → WU-41(API) → WU-22(E2E) → 배포 URL 검증.** 하나가 늦으면 뒤가 밀리므로 화면은 목 데이터로 먼저 진행

**2일차 완료 판정 (끝날 때 체크):**

- [x] 목 없이 화면에서 입고 → 출고 → 대시보드 갱신 (Step 1, 완료 판정 1 · 2) — 아래 '저녁 판정' 참고
- [x] 다른 사용자의 데이터 조회 · 수정 거부 (Step 2, 완료 판정 6 · T-AUTH)
- [ ] 검증 담당(sorek-charlie)이 **배포 URL에서** Step 1 · 2 E2E 실행 — 일부(아래)
- [x] 합친 버전(main)을 한 번 실행 (공통 안내 "매일 한 번은 합친 버전 실행")

**중간 점검 결과와 변경 이력:**

(11/23 오후 1차 병합 뒤 작성 — 저녁 2차 병합 뒤 갱신)

완료: Wave 0 골격 · 배포 URL(dev `pack-flow`) · 팀 시작 공지 · 커밋 · 리뷰 규칙 문서 · WU 이슈 20건(#7~#26) · Supabase demo 마이그레이션(dev와 구조 일치) · Render dev/demo 두 서비스 결정(D-37), **1차 병합 6건**

**PR 병합 현황 (11/23 15:35 기준, 모두 merge commit)**

| PR | WU | 작성 | 리뷰 | 상태 |
|---|---|---|---|---|
| #2 | WU-06 배포 확인 기록 | eple | 리뷰 전 병합(D-13 예외, 문서만) | 병합 12:10 |
| #27 | WU-06 확인 결과 C-05 · 09 · 10 | eple | sorek-charlie | 병합 15:32 |
| #30 | WU-06 시연 서비스 render.demo.yaml · D-37 | eple | sorek-charlie | 병합 15:32 |
| #3 | WU-32 발주 후보 계산 · 발주서 프롬프트 | skygaul | eple | 병합 15:32 |
| #6 | WU-31 LLM 호출층 · 호출 상한 | skygaul | eple | 병합 15:32 |
| #4 | WU-11 대시보드 | jkspawn | skygaul | 병합 15:32 |
| #5 | WU-12 입출고 화면 | jkspawn | skygaul | 병합 15:35 |
| #28 | WU-16 품목 화면 | jkspawn | skygaul | 리뷰 대기 |
| #29 | WU-21 재고 함수 1 | sorek-charlie | jkspawn | 리뷰 대기 — 핵심 경로(WU-41이 기다림) |

- 병합 순서: 문서 · 설정(#27 · #30) → 순수 함수(#3) → LLM(#6) → 화면(#4 → #5). 매 병합 뒤 다음 PR이 충돌 없음(CLEAN)인지 확인
- **합친 버전 점검(main `4fb5626`)**: `lint` · `typecheck` 오류 없음, `test:unit` **517개 통과**(22파일), 배포 URL `/api/health` 200 ok

미완료: demo 서비스(`pack-flow-demo`) 배포 · 시연 계정 로그인, Step 1 · 2 흐름(WU-21 → WU-41 → WU-22)

막힌 점:
- 팀원 AI가 기획 자료 저장소(workspace)를 코드 저장소로 착각해 "뼈대부터 만들기"를 제안 → 공지 0절에 저장소 구분을 적어 해결
- 프로젝트 폴더를 지우고 다시 받는 팀원이 있어 시작이 늦어짐
- 검증자 작업 중이라 첫 PR(문서만)은 eple이 리뷰 전 병합 → 예외 기록(PR 댓글)

범위 조정:
- 순서 변경: Render 배포를 demo DB보다 먼저(배포 URL 확인 우선), 첫 배포는 dev DB로 임시
- 3일차(11/24 14시 기능 동결) 대비 **줄일 순서 후보** — 오늘 저녁 팀 결정(`decision` 이슈)
  - A안: 취소 · 상태 전이 + AI 발주서 초안은 지킴 / 일괄 등록은 미리보기까지, 자연어 조회는 고도화 후보
  - B안: AI를 지키고 Step 3 축소(일괄 등록 빼고 취소만)

### 저녁 갱신 (11/23 19시 무렵, 2차 병합 뒤)

**2차 병합 (모두 merge commit, 리뷰 승인 뒤 · 승인 뒤 새 커밋 없음 확인)**

| PR | WU | 작성 | 리뷰 | 병합 |
|---|---|---|---|---|
| #29 | WU-21 재고 함수 1 | sorek-charlie | jkspawn | 17:32 |
| #28 | WU-16 품목 화면 | jkspawn | skygaul | 17:32 |
| #31 · #32 | WU-44 일자별 기록 · WU-06 demo 확인 기록 | eple | sorek-charlie | 17:32 |
| #36 · #37 | WU-11 · WU-12 결과 절(문서) | jkspawn | skygaul | 17:54 |
| #38 | WU-41 업무 API 실제 연결 | eple | sorek-charlie | 18:16 |
| #34 | WU-33 발주서 초안 API · 에이전트 패널 | skygaul | eple | 18:21 |
| #39 | WU-42 권한 테스트 T-AUTH-1~8 · Step 2 증거 | eple | sorek-charlie | 18:49 |
| #41 | WU-43 (1/2) `POST /api/seed` | eple | sorek-charlie | 18:55 |
| #35 | 이어받기 노트 | eple | sorek-charlie(변경 요청 → 수정 → 승인) | 18:55 |

- DB: WU-21 마이그레이션 `20261123120000_inventory.sql`을 eple 승인 뒤 **dev(17시 무렵, 병합 전 — 리뷰어 `test:db`가 dev 함수를 써야 해서) · demo(병합 뒤)** 에 적용, 둘 다 7개 · 함수 실행 권한 확인
- 리뷰 중: #40 WU-22 시드 3벌(demo 8품목 · small · large) · E2E — demo가 3 → 8품목으로 바뀌어 eple 구역 시험 갱신이 함께 필요(고침 브랜치 `feat/WU-43-seed-loader`)

**저녁 판정**

| 판정 | 결과 | 근거 |
|---|---|---|
| 1. 목 없이 입고 → 출고 → 대시보드 | 충족 | WU-41 코드로 화면 확인 두 번: eple 로컬(`USE_MOCK=0` + dev DB, P-101 8개 입고 → S-201 출고 → 대시보드 합계 55 · 오늘 입고 1 · 출고 1), sorek-charlie의 #38 서버(Chrome, PRD-001 10 → 4 → 12). API 시험 T-S1-3(대시보드 = DB 직접 집계) 통과. 이 코드는 18:16 main 병합 |
| 2. 다른 사용자 데이터 거부 | 충족 | T-AUTH-1~8 10건(API 라우트 + Supabase REST 직접) dev 통과 — 작성자 · 리뷰어(새 계정) 각각 실행. 증거 [records/eple-step2-evidence.md](../records/eple-step2-evidence.md) |
| 3. 배포 URL에서 Step 1 · 2 E2E | 일부 | sorek-charlie가 배포 서비스 로그인 · 입출고 · 권한 흐름을 Chrome으로 확인 중. 시드는 `/api/seed`가 18:55 병합 전이라 DB 함수로 넣음 → 정식 E2E 6건은 #40 병합 · 재배포 뒤 다시 |
| 4. 합친 버전(main) 실행 | 충족 | main `d00c36e`(2차 병합 뒤): `lint` · `typecheck` 오류 없음, `test:unit` **686개 통과**(35파일), `test:db` **58개 통과**(11파일, dev — T-S1-3 · T-AUTH · T-VAL · WU-21 시험 포함), `build` 성공, `next start`(`USE_MOCK=0`)로 띄워 `/api/health` 200(db ok) · `/login` 200 · 미로그인 `/` → `/login` · `/api/items` 401 · X-PF 없는 `POST /api/seed` 403 확인 뒤 종료. 로그인한 화면 조작은 판정 1의 확인으로 갈음 |

**AI가 틀렸다가 고친 일 (저녁)**

- 시험 복제 중 판매 시험의 기대 field를 `fulfillment_status`로 잘못 바꿈 → 시험 실패로 잡아 수정(WU-41, eple 세션의 하위 에이전트)
- `/api/seed` 단위 시험에서 가짜 클라이언트 대신 도우미 반환 객체를 넘겨 5건 모두 500 → 로그(`getClaims` 없음)로 원인 찾아 시험만 수정(WU-43, eple 세션의 Claude)
- 화면 확인 때 대시보드 주소를 `/dashboard`로 잘못 열어 로그인 화면으로 돌아감(실제 주소 `/`) — 코드 문제 아님
- 팀원 PR 본문 한글이 `?`로 깨져 올라감(명령줄 본문 인코딩으로 추정) → UTF-8 파일 + `--body-file`로 다시 쓰기 안내

**막힌 점 · 범위 조정 (저녁)**

- dev 테스트 계정 하나의 비밀번호가 팀원 로컬 실행 기록에 노출됐다는 보고 → eple이 계정을 다시 만들고 새 값을 개인 전달(dev 테스트 계정 · 가짜 주소라 영향은 그 계정의 시험 데이터뿐)
- WU-43을 두 PR로 나눔: `/api/seed` 먼저(배포 E2E가 기다림, eple 결정), `pf_bulk_apply` · bulk 라우트는 11/24 오전
- 남은 핵심 경로(11/24 14시 기능 동결 전): #40 + 시드 고침 병합 → 배포 E2E 6건 → WU-43 bulk · WU-23 취소 · 상태 전이 · WU-14 이력 화면 · WU-34 챗봇

## AI 활용 (2일차)

**AI가 틀렸다가 고친 일 (제출용 사례 후보 — 각자 `docs/records/ai-cases-<아이디>.md`에):**

- 비밀값 검사 훅이 AI가 쓴 안내 문서의 **예시 경로 한 줄**(사용자 폴더 형식)을 잡아 커밋을 막음 → 문구를 바꿔 재검사 통과 (eple)
- 팀원 AI가 잘못된 저장소를 읽고 "코드가 없다"고 판단 → 저장소를 바로잡아 줌 (jkspawn)
- demo 마이그레이션 미리 보기에서 Supabase CLI에 `--remote`를 빠뜨려 원격이 아닌 로컬 Docker DB를 찾음 → 아무것도 바뀌지 않았고 `--remote`로 다시 실행 (eple 세션의 Claude, 이어받기 노트에 이미 적힌 주의점)

**AI 운영 확인:**

- 배포는 `LLM_PROVIDER=gemini`(배포 URL `/api/health`에서 확인). Gemini 키는 eple이 Render에 직접 입력 — 대화 · 저장소에 없음. 실제 Gemini 호출은 WU-31 이후 확인
- 개발은 각자 Ollama, 테스트는 `fake`
