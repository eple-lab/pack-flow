# 13. 고친 기록

작성 시작: 2026-11-20 · **eple이 매일 마감 때 GitHub 이슈에서 모아 적는다.** 팀원은 이 파일을 직접 고치지 않고 이슈 본문(원인 · 수정 · 확인)을 채운다([12 코드 작성 가이드](12-coding-guide.md) ④, [11 이슈 운영](11-issues.md)).
- 11/24 밤 eple 세션의 Claude가 이슈 · PR에서 모아 첫 정리(하위 에이전트 초안, eple 확인 전). 11/20~11/24 병합분만 넣었고, 열린 이슈는 넣지 않았다. 11/25부터는 고친 PR이 병합될 때마다 위에 더한다.

새 항목은 위에 더한다. 각 항목은 "무엇이 / 왜(원인) / 어떻게 고쳤나 / 확인한 것 / 확인 못 한 것"을 적는다.

| 종류 | 뜻 |
|---|---|
| bug | 의도대로 동작하지 않았다 |
| 개선 | 동작은 했지만 쓰기 불편하거나 실수하기 쉬웠다 |
| 결정 변경 | 정해 둔 규칙을 바꿨다(02 결정 기록과 함께) |

## 목록

| 이슈 | 날짜 | 종류 | 곳 (WU · 파일) | 고친 사람 | 한 줄 요약 | 커밋 |
|---|---|---|---|---|---|---|
| #83 | 11/25 | bug | WU-03 · `src/lib/api/errors.ts` · `docs/04-api-contract.md` 4.4 | eple | AI 한도 초과 안내가 "오후 5시"였지만 실제로는 한국 시간 자정에 풀림 → 문구를 자정으로 | `6477937` (PR #84) |
| — | 11/24 | bug | WU-24 · `src/lib/seed/index.ts` | eple | 시드 로더 JSON import에 `type: json` 표시 — Playwright E2E T-S4-1 실패 해결 | `daf7a54` (PR #69) |
| — | 11/24 | 결정 변경 | WU-44 · `docs/02-decisions.md` D-40 · `docs/06-work-plan.md` 4절 | eple | 지난 커밋에 PC 경로 · 색 코드가 남은 PR은 squash 병합(D-14 예외) | `e9212d9` (PR #68) |
| — | 11/24 | bug | WU-24 · `scripts/regression/report.ts` | eple | 회귀 결과표의 색 코드 · PC 절대 경로를 가림 | `6ef6c24` `4f0c8d5` (PR #70) |
| #59 | 11/24 | 개선 | WU-31 · `src/lib/llm.ts` | skygaul | Gemini 토큰 사용량을 `llm.ok` 로그에 남겨 느린 호출 진단 | `5f3a3a8` (PR #65) |
| — | 11/24 | bug | WU-45 · `scripts/regression/report.ts` · `tests/regression/run.ts` | eple | 회귀 실행기 — chromium 판정 · 하위 출력 가리기 · 비정상 종료 기록 | `8295ee1` (PR #49) |
| — | 11/24 | bug | WU-43 · `src/lib/queries/bulkPreview.ts` | eple | 일괄 미리보기 재고 계산을 유효한 행만 순서대로 반영 | `c9514d1` (PR #46) |
| #60 | 11/24 | bug | WU-43 · `src/lib/validation/fields.ts` · `schemas.ts` | eple | 일괄 미리보기 원문 끝 빈 칸이 잘려 마지막 줄이 `열 개수 오류`로 거부됨 | `1da90cc` (PR #46) |
| — | 11/24 | 개선 | WU-33 · `docs/04-api-contract.md` 3.8 | eple | 발주 확정 일부 저장 `detail`(`saved_count` · `saved`)을 계약에 적음 | `1d824dc` (PR #47) |
| — | 11/23 | bug | WU-33 · `src/lib/agent/draft-po.ts` · `src/components/agent/` | skygaul | 발주 확정 중간 실패 시 저장된 줄을 표에서 빼 중복 발주 방지 | `559b51c` (PR #45) |
| — | 11/23 | bug | WU-12 · `src/components/trades/form-utils.ts` | jkspawn | 숫자 칸 `8,5`가 85로 통과하던 문제 | `08ccd86` (PR #5) |


## #83 AI 한도 초과 안내 시각이 실제와 다름 — "오후 5시" → 자정

bug · 11/25 · 고친 사람 eple · 발견한 사람 skygaul(11/24 17:07 시연 계정이 한도에 걸렸을 때 문구 확인)

- **무엇이**: `PF_QUOTA_EXCEEDED`(429) 안내가 "오늘 AI 사용 한도를 다 썼어요. 한국 시간 오후 5시 이후 다시 쓸 수 있어요"였다. 11/24 17:07에 한도에 걸렸을 때 이미 오후 5시가 지났는데도 자정까지 풀리지 않았다
- **왜**: 이 오류는 우리 앱의 상한(`pf_llm_take`, 사용자 30 · 전체 300, **한국 시간 날짜 기준**)에서 나와 한국 시간 자정에 풀린다. "오후 5시"는 Gemini 무료 할당량이 새로 시작하는 시각(태평양 시간 자정)에 맞춘 문구였다(이슈 #83, `docs/records/llm-usage.md` 25줄에도 지적). 위치: `docs/04-api-contract.md` 4.4 표(문구 원본) · `src/lib/api/errors.ts` 51행 · 시험 `src/lib/api/errors.test.ts` 36행
- **어떻게 고쳤나**: 계약 → 코드 → 시험 순서로 "한국 시간 자정 이후"로 바꿨다. 04 4.4 표 아래에 바꾼 이유 한 줄, `errors.ts` 바뀐 줄 위에 `// [#83 bug]` 주석과 이력 한 줄. `DevelopDoc/TECH_SPEC.md` 8절의 "팀 결정 대기" 문장도 정리
- **확인한 것**: 시험 기대값만 먼저 "자정"으로 바꿔 `E-1 PF_QUOTA_EXCEEDED`가 **실패하는 것을 확인**(1 failed) → 코드 수정 뒤 28개 통과. `npm run lint` · `typecheck` · `test:unit` 862개 통과, CI `secret-check` · `check` 통과. 리뷰 sorek-charlie(`pf_llm_take`가 Asia/Seoul 날짜로 집계하는 것과 문구 · 시험 · 문서가 일치함을 확인)
- **확인 못 한 것**: 배포 화면에서 실제로 하루 30회를 넘겨 새 문구를 보지는 않았다(단위 시험으로만 확인). `llm-usage.md` 25줄(skygaul 파일)의 지적 문장은 그대로
- 커밋: `6477937` (병합 `a216a5a`) · PR: #84

## PR #69 시드 로더 JSON import가 Playwright에서 실패

bug · 11/24 · 고친 사람 eple · 발견한 사람 eple(첫 회귀 실행, 테스트 ID T-S4-1)

- **무엇이**: 11/24 첫 회귀(`npm run test:regression`, dev 배포 대상, small 시드)에서 **통과 65 · 실패 1**(결과표는 테스트 ID 한 줄을 한 건으로 센다). 실패한 줄은 T-S4-1이고, 이 줄에는 시드 3벌(demo · small · large)을 DB · 정답표 · E2E 세 층에서 검사하는 테스트 9개가 들어 있다. 그중 **E2E(Playwright) 3건만 실패**했고, 오류는 `demo.json`에 import attribute `type: json`이 필요하다는 TypeError.
- **왜**: `src/lib/seed/index.ts`의 `import('./demo.json')`. Next · Vitest는 받아들이지만 Playwright는 Node ESM이라 JSON import에 `type` 표시가 필요하다(PR 본문). 줄 번호는 기록 없음.
- **어떻게 고쳤나**: `src/lib/seed/index.ts`의 세 import에 `{ with: { type: 'json' } }` 추가. 경로는 글자 그대로 두었다(Next 번들러가 파일을 포함하려면 필요). 주석 · 이력 한 줄. tsconfig · package.json · next.config 변경 없음.
- **확인한 것**: seed 단위 시험 23 통과, lint · typecheck · test:unit(856) 통과, `npm run build` 성공, Playwright(Node ESM)에서 `loadSeed('demo' · 'small' · 'large')` 임시 시험 — 고친 뒤 통과, 고치기 전 같은 오류로 실패, `check-secrets.sh --staged` 통과. 이후 배포 dev 회귀에서 T-S4-1 E2E 3건 통과(PR #68 본문). 고친 뒤 16:00 회귀 재실행에서 T-S4-1 줄(테스트 9개)이 통과했다(`regression-20261124-1600.md`).
- **확인 못 한 것**: PR 시점에는 로그인이 필요한 실제 T-S4-1 재실행을 못 했다(병합 뒤 #68 회귀에서 확인됨). jkspawn 재실행 결과는 기록 없음.
- 커밋: `daf7a54` (병합 `328d758`) · PR: #69

## D-40 지난 커밋에 PC 경로가 남은 PR은 squash 병합

결정 변경 · 11/24 · eple · 발견한 사람: 기록 없음(#68 병합 과정)

- **무엇이**: D-14(merge commit 병합) 규칙대로면 #68 브랜치의 지난 커밋에 있던 PC 드라이브 경로 · ANSI 색 코드가 main 이력에 들어간다.
- **왜**: 최종 트리가 깨끗해도 merge commit은 지난 커밋 내용을 이력에 남긴다(`docs/02-decisions.md` D-40 이유 칸).
- **어떻게 고쳤나**: D-40 추가 — 이 경우에 한해 eple 확인 아래 squash 병합, 그 밖에는 D-14 그대로. `docs/06-work-plan.md` 4절 6단계에 예외 한 줄(`docs/02-decisions.md` 변경 이력). #68은 squash로 병합됐다.
- **확인한 것**: #68 PR 본문이 squash 병합을 요청했고 병합 커밋이 `e9212d9`임(`gh pr view 68`). 병합 뒤 main 이력에서 경로가 사라졌는지 직접 검사한 기록은 없음.
- **확인 못 한 것**: 위와 같음. squash 브랜치 삭제 여부는 기록 없음.
- 커밋: `e9212d9` · PR: #68

## PR #70 회귀 결과표에 PC 절대 경로 · 터미널 색 코드가 남음

bug · 11/24 · 고친 사람 eple · 발견한 사람: 기록 없음(PR 본문은 #68의 결과표에서 확인했다고 적음)

- **무엇이**: 11/24 첫 회귀 결과표에 실행 PC의 절대 경로(Playwright 오류 메시지 속 `file:///` 경로)와 터미널 색 코드(ANSI)가 그대로 남아 표가 깨졌다. 공개 저장소 규칙(이 PC의 절대 경로를 문서에 적지 않는다) 위반.
- **왜**: `scripts/regression/report.ts`의 `redact()`가 사용자 홈 경로만 가렸다(PR #69 본문). 파일:줄은 기록 없음.
- **어떻게 고쳤나**: `redact()`에서 먼저 ANSI 색 코드를 지우고, 드라이브 · `file:///` · `/home/` · `/Users/` · `/root/` 시작 절대 경로를 가린다. 저장소 안이면 `<repo>/src/…`, 밖이면 `[경로]`, `https://` 주소는 그대로. 리뷰 뒤 `4f0c8d5`로 따옴표 안 공백 경로도 끝까지 가림.
- **확인한 것**: 시험 C-27(색 코드 제거) · C-28(경로 4종)은 옛 코드에서 실패 확인 후 통과, C-29(웹 주소 그대로) 통과, C-30(실제 결과표에 적용) 드라이브 경로 2건 → 0건, lint · typecheck · test:unit(859) 통과. 16:00 결과표 검사 통과(#68 본문 C-02).
- **확인 못 한 것**: POSIX는 `/home/` · `/Users/` · `/root/`로 시작하는 경로만 가림(`/tmp/…`는 그대로). 실제 색 코드 제거는 시험 C-27로만 확인(eple 실행본에는 색 코드가 없었음).
- 커밋: `6ef6c24` `4f0c8d5` (병합 `2e5ef63`) · PR: #70

## #59 Gemini 호출 지연 진단용 토큰 사용량 로그

개선 · 11/24 · 고친 사람 skygaul · 요청한 사람 eple

- **무엇이**: 배포의 발주서 초안 호출이 `llm.ok` 4782ms · 4264ms로 PoC(1.0초)보다 약 4배 느렸는데, 원인이 생각(thinking) 단계인지 숫자로 볼 수 없었다. 기능 오류는 아니다(제한 20초 안).
- **왜**: `llm.ok` 로그에 토큰 사용량이 없었다(이슈 #59).
- **어떻게 고쳤나**: `src/lib/llm.ts`가 Gemini 응답 `usageMetadata`의 `promptTokenCount` · `candidatesTokenCount` · `thoughtsTokenCount`를 숫자일 때만 `llm.ok`에 남긴다(없거나 숫자가 아니거나 음수면 키 생략). 글자 · 프롬프트는 읽지 않고 반환값 · 오류 코드는 그대로. `src/lib/llm.test.ts`에 G-4 · G-5 · G-6 · O-6 추가.
- **확인한 것**: lint 0 오류 · typecheck 통과 · test:unit 811 통과. G-4 · G-5는 구현 전 실패 확인. 개발 서버 실제 Gemini 호출: 챗봇 1264ms(prompt 585 · candidates 18), 초안 3836ms(prompt 437 · candidates 72) — 두 호출 모두 `thoughtsTokenCount`가 응답에 없어 "생각 단계 때문"이라는 추측은 1건 표본에서는 뒷받침되지 않았다.
- **확인 못 한 것**: 배포 환경의 실제 로그(병합 · 배포 뒤 확인 요청 상태). `llm.failed` 로그에는 토큰을 넣지 않았다. 지연의 최종 원인은 기록 없음.
- 커밋: `5f3a3a8` (병합 `9bba291`) · PR: #65

## 회귀 실행기 — chromium 판정 · 하위 출력 가리기 · 비정상 종료 기록

bug · 11/24 · 고친 사람 eple(Claude 하위 세션) · 발견한 사람 sorek-charlie(PR #49 리뷰)

- **무엇이**: PR #49 리뷰의 수정 요청 3건 — (1) headless shell만 있는 Windows에서 chromium 유무를 잘못 판정, (2) 하위 출력이 가려지지 않고 그대로 출력, (3) 결과 파일이 있어도 비정상 종료면 통과처럼 기록.
- **왜**: `hasChromium`이 실행 파일 경로로 판정, `runNode`가 하위 출력을 그대로 흘림, 비정상 종료를 결과표 · 종료 코드에 반영하지 않음(커밋 메시지). 파일:줄은 기록 없음.
- **어떻게 고쳤나**: `tests/regression/run.ts`의 `hasChromium`을 `chromium.launch()`로 판정, `runNode`가 출력을 붙잡아 `redact()` 뒤 출력, `withExitCode`로 '묶음 비정상 종료' 실패를 결과표 · 종료 코드에 반영. `scripts/regression/report.ts`의 `redact()`에 cookie · set-cookie · authorization · `sb-…-auth-token` 가리기 추가.
- **확인한 것**: 시험 C-24 ~ C-26 추가(`scripts/regression/report.test.ts`). 실행한 명령의 결과 수치는 기록 없음.
- **확인 못 한 것**: 기록 없음.
- 커밋: `8295ee1` (병합 `65d72d1`) · PR: #49

## 일괄 미리보기 재고 계산이 행 순서 · 유효 여부를 무시

bug · 11/24 · 고친 사람 eple(Claude 하위 세션) · 발견한 사람 sorek-charlie(PR #46 리뷰)

- **무엇이**: 제외될 출고 행이 재고를 먼저 차지하고, 앞선 유효 입고 행이 가용 재고에 더해지지 않았다.
- **왜**: `src/lib/queries/bulkPreview.ts`의 미리보기 재고 계산이 `pf_bulk_apply`의 행 순서 반영과 달랐다(커밋 메시지). 줄 번호는 기록 없음.
- **어떻게 고쳤나**: 유효한 행만 순서대로 가용 재고에 반영하도록 `bulkPreview.ts` 수정.
- **확인한 것**: 시험 C-87 · C-88 추가(`src/app/api/bulk/bulk.test.ts`). 명령 결과 수치는 기록 없음. PR #46 병합 뒤 skygaul이 #46 + #57로 재확인(예시 10행 → 7행 반영, T-S3-5 통과 — #60 코멘트).
- **확인 못 한 것**: 기록 없음.
- 커밋: `c9514d1` (병합 `f52a46e`) · PR: #46

## #60 일괄 미리보기에서 붙여넣은 글자 끝의 빈 칸이 잘림

bug · 11/24 · 고친 사람 eple · 발견한 사람 skygaul(PR #57 리뷰 중 #46 + #57을 합쳐 확인)

- **무엇이**: `POST /api/bulk/preview`가 마지막 줄 끝의 빈 칸(탭)을 지워, 송장번호 · 비고가 빈 마지막 행이 5열로 읽혀 `열 개수 오류`로 제외됐다. 화면에서 [예시 붙여넣기] → [미리보기]가 "유효 7행"이 아닌 "유효 6행 · 오류 4행". 엑셀 · 구글 시트에서 복사해도 같은 증상. `parse.test.ts`는 통과해 서버를 거쳐야 드러났다.
- **왜**: `bulkPreview.text`가 공통 `text()`의 `trim`을 거쳐 값 끝 공백이 사라졌다(`src/lib/validation/fields.ts` 글자 검사 · `schemas.ts` 미리보기 스키마 — 이슈가 적은 의심 위치 69~74줄 · 189줄, eple가 원인 확인).
- **어떻게 고쳤나**: `text()`에 `trim` 선택(기본 `true`, 다른 칸은 그대로)을 추가하고 미리보기 원문만 `trim: false`.
- **확인한 것**: 시험 C-86(마지막 줄 끝 탭 2개 · 1개 → `valid: true`, 옛 코드에서는 실패 확인). 실제 `parse.ts` + 고친 스키마로 `valid: true`, bulk · validation 시험 223 통과, lint · typecheck · test:unit(706) 통과. PR #46 병합 뒤 skygaul 재확인: 예시 10행 → 7행 반영, T-S3-5 통과.
- **확인 못 한 것**: 브라우저에서 엑셀 · 구글 시트 실제 붙여넣기.
- 커밋: `1da90cc` (병합 `f52a46e`) · PR: #46 · 이슈 #60

## 04 계약 3.8에 발주 확정 일부 저장 detail 추가

개선 · 11/24 · 고친 사람 eple · 발견한 사람: 기록 없음(PR #45 본문이 "04 3.8 계약에 없는 추가 칸"이라 적었고 eple가 PR #45 리뷰에서 문서 갱신을 약속)

- **무엇이**: PR #45가 `/api/agent/draft-po/confirm` 오류의 `detail`에 `saved_count` · `saved`를 덧붙였는데 계약 문서에 없었다.
- **왜**: 코드가 계약보다 먼저 바뀜.
- **어떻게 고쳤나**: `docs/04-api-contract.md` 3.8 표 아래에 한 문단 추가 — 중간 줄 거부 시 오류 코드 · HTTP는 그대로, 원래 `detail`에 두 칸을 덧붙임, 첫 줄 거부(저장 0건)면 없음. 코드 변경 없음.
- **확인한 것**: PR #45 코드(`confirmPoLines` · `partialSaveOf`)와 내용 대조 같음, `src/types/` 변경 불필요, `src/app/api/routes.test.ts` 4건 통과, `check-secrets.sh --staged` 통과.
- **확인 못 한 것**: skygaul의 "문장이 동작과 같은지" 리뷰어 확인 결과는 기록 없음.
- 커밋: `1d824dc` (병합 `408a682`) · PR: #47

## 발주 확정 중간 실패 시 중복 발주 가능

bug · 11/23 · 고친 사람 skygaul · 발견한 사람 eple(PR #34 리뷰 후속 1 · 2번이 병합에 빠진 것을 skygaul이 확인)

- **무엇이**: 발주서 확정은 줄마다 따로 저장하므로 중간 줄이 거부되면 앞 줄은 이미 저장된 채로 화면에 남아, 다시 누르면 같은 줄이 중복 발주될 수 있었다.
- **왜**: `src/lib/agent/draft-po.ts` `confirmPoLines`가 저장된 줄 정보를 돌려주지 않았고 화면도 저장된 줄을 표에 남겼다(PR #45 본문). 줄 번호는 기록 없음.
- **어떻게 고쳤나**: 서버는 오류 코드를 그대로 두고 `detail`에 `saved_count` · `saved`(구매 번호)를 덧붙임(첫 줄 실패면 안 덧붙임). 화면(`DraftPoView.tsx` · `draft-po-form.ts`)은 저장된 줄을 표에서 빼고 안내(`draft-partial`)를 보이며, 수정값은 유지하고 연속 실패 건수를 합산. `tests/api/agent.test.ts`에 T-AI-1 실제 DB 시험 추가.
- **확인한 것**: lint · typecheck 오류 없음, test:unit 35파일 700건 통과, `npx vitest run --project db tests/api/agent.test.ts` 5건 통과(실제 dev DB), 시험 C-3 · C-6 · C-7 · S-1~S-9 · N-1 · T-AI-1a~e, 브라우저 확인 B-7~B-10(일부 저장은 응답만 가짜로 끼워 확인).
- **확인 못 한 것**: 실제 LLM 문안 품질(WU-35), 다른 API 시험이 8품목 시드에서 어떤지, 확정 뒤 대시보드 자동 새로고침(열린 이슈로 남아 있고 아직 고치지 않음).
- 커밋: `559b51c` (병합 `82cb987`) · PR: #45

## 숫자 칸 `8,5`가 85로 통과

bug · 11/23 · 고친 사람 jkspawn · 발견한 사람: WU-12 시험 F-09

- **무엇이**: 구매 · 판매 폼 · 입고 확정 창의 수량 · 금액 칸에 `8,5`를 넣으면 소수 뜻인데 85로 전송됐다.
- **왜**: `src/components/trades/form-utils.ts`의 `toNumberInput`이 쉼표를 모두 지웠다(커밋 메시지).
- **어떻게 고쳤나**: `form-utils.ts`에 `toIntegerInput` 추가(천 단위 쉼표만 지움), `PurchaseForm.tsx` · `SaleForm.tsx` · `ReceiveDialog.tsx`가 사용.
- **확인한 것**: 시험 F-09 — `8,5` · `1,5`는 `not_integer`, `1,000`은 1000. 처음엔 85로 통과해 시험이 잡았다(`docs/work-units/WU-12-trades.md` 결과 절). 전체 명령 결과 수치는 기록 없음.
- **확인 못 한 것**: 기록 없음.
- 커밋: `08ccd86` (병합 `4fb5626`) · PR: #5

---

<!-- 항목 양식 (복사해서 위 '목록' 아래, 이 주석 위에 붙인다)

## #번호 한 줄 제목

종류 · 날짜 · 고친 사람 · 발견한 사람(또는 테스트 ID)

- **무엇이**: (증상, 재현 단계)
- **왜**: (원인, 파일:줄)
- **어떻게 고쳤나**: (바꾼 파일 · 줄, 바꾼 줄 주석 [#번호])
- **확인한 것**: (명령과 결과, 추가한 재발 방지 테스트)
- **확인 못 한 것**:
- 커밋: · PR:

-->
