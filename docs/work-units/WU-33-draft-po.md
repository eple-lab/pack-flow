# WU-33 발주서 초안 API · 에이전트 패널

- 담당: skygaul / 검증: eple / Step 5 / Wave 2 · 11/24(화) **14시 전**
- 브랜치: `feat/WU-33-draft-po`
- 의존: WU-31, WU-32, WU-21(`pf_create_purchase`), WU-11(대시보드 버튼이 `openAgentPanel` 호출)

## 왜 (근거)

완료 판정 5 "발주서 초안에서 [확인] → `Purchases`에 '발주완료' 1건 / [취소] → 변화 없음", 대표 시나리오의 마지막 장면. P-08 LLM 실패 시 계산 표만.

## 읽을 파일

- [04](../04-api-contract.md) 1 · 2 · 3.8절
- `src/lib/api/handler.ts`(라우트 공통 — 사용법만), `src/lib/inventory.ts`(`createPurchase` 시그니처만)
- 내 파일: `src/lib/llm.ts`, `src/lib/agent/reorder.ts`, `src/lib/agent/prompts/draft-po.ts`, `src/components/agent/*`

## 만들 · 고칠 파일 (내 구역만)

- `src/app/api/agent/draft-po/route.ts`, `src/app/api/agent/draft-po/confirm/route.ts`
- `src/lib/agent/draft-po.ts`(조회 → 계산 → LLM → `PoDraft`)
- `src/components/agent/AgentPanel.tsx`, `DraftPoView.tsx` (패널 여는 입구 `open.ts`와 `<AgentSlot />`은 eple 소유 — 읽기만. 공통 조각은 `src/components/common/` 가져다 씀)
- `tests/api/agent.test.ts`(초안 부분)

## 하지 말 것

- `/draft-po`에서 DB에 쓰기 (쓰기는 `/confirm`에서만)
- `/confirm`에서 화면이 보낸 값을 그대로 믿기 — 품목이 본인 것인지, 수량 > 0인지, 금액 ≥ 0인지 다시 검사하고 `pf_create_purchase`가 한 번 더 검사
- LLM 실패 시 미리 써 둔 문안을 AI 결과처럼 보여 주기 (P-08)

## 고치는 방법

1. `/draft-po`: 사용자 JWT로 품목 · 7일 이력 · 진행 중 구매 조회 → `reorder` → 후보 없으면 "지금 발주할 품목이 없어요" → 있으면 LLM 문안 요청 → `PoDraft`
2. LLM 오류 · 상한 초과 → `message: null`, `llm_error` 채워 **200으로** 반환(계산 표는 보여 줌). 패널에 "AI 문안을 만들지 못했어요(사유). 아래 계산 결과로 직접 발주할 수 있어요"
3. 패널: 표(품목 · 재고 · 안전재고 · 추천 수량 · 단가 · 거래처 · 근거) — 수량 · 거래처 수정 가능, 문안 영역, [발주 등록(확인)] · [취소], '발주서 발송(시연용)' 표시는 실제 발송이 아님을 명시
4. [확인] → `/confirm` → `source: "agent"`로 줄마다 `pf_create_purchase` → 결과 "P-105 발주완료 1건" → 대시보드 새로고침
5. testid: `agent-panel`, `draft-row-<sku_id>`, `draft-qty-<sku_id>`, `draft-message`, `draft-llm-error`, `btn-draft-confirm`, `btn-draft-cancel`

## 입력 · 오류 처리 ([04](../04-api-contract.md) 4절)

- `/confirm`의 줄은 `poConfirm` 스키마로 검사(수량 1~100,000, 금액 0~10억, 거래처 1~50자). 패널의 수정 칸은 `FieldError`로
- LLM 오류 · 상한 문구는 04 4.4 표 그대로(`PF_LLM_UNAVAILABLE` · `PF_QUOTA_EXCEEDED`). [발주 등록]은 `SubmitButton`

## 다 됐다의 기준

- [x] T-AI-1: `demo` 시드 PRD-003 → 초안 → [확인] → `purchases`에 `발주완료` 1건 / [취소] → 건수 변화 없음
- [x] 초안 표의 재고 · 안전재고 · 단가 = DB 값, 추천 수량 = `reorder` 결과 (T-AI-3 초안 쪽)
- [x] T-AI-6(초안 쪽): `LLM_PROVIDER`를 잘못된 주소로 → 표는 보이고 문안 없음 · 오류 표시, 입출고 화면은 정상
- [x] B 계정으로 A의 sku로 `/confirm` → 404, 변화 없음
- [x] 추천 수량을 0으로 고치고 [확인] → 칸 아래 범위 문구, 저장 안 됨

## 테스트 방법

- 자동: `npm run test:unit`, `tests/api/agent.test.ts`(fake 제공자)
- 직접: dev에서 대시보드 → [발주서 초안 보기] → 수정 → 확인

## 실제 동작 확인 항목 (리뷰어 eple)

- [x] 문안 속 숫자가 표와 다르면? → 표 기준으로 저장되는지(저장은 표 값만 쓴다)

## 결과 (담당자가 채움)

- 한 것:
  - `src/lib/agent/draft-po.ts`: `createPoDraft`(사용자 JWT로 품목 · 7일 `실판매출고` 이력 · 구매를 읽고 `reorder`로 계산, LLM은 문안만) · `confirmPoLines`(값 범위 재검사 → 품목이 모두 본인 것인지 확인 → 줄마다 `pf_create_purchase`, `source: "agent"`)
    - 초안은 읽기만 한다. 후보가 없으면 LLM을 부르지 않는다. LLM 실패 · 호출 상한 초과는 오류가 아니라 200 + `llm_error`로 표를 그대로 준다(P-08)
    - 확정은 남의 품목이 한 줄이라도 있으면 `PF_NOT_FOUND`로 아무것도 저장하지 않는다. LLM 문안은 확정 요청에 들어가지 않는다
  - `src/app/api/agent/draft-po/route.ts` · `confirm/route.ts`: stub을 위 함수로 교체(확정은 201)
  - `src/components/agent/DraftPoView.tsx` · `AgentPanel.tsx` · `draft-po-form.ts` · `agent.module.css`: 불러오기, 표(수량 · 거래처 수정), AI 문안, [발주 등록(확인)] · [취소], 칸 아래 오류. 확정 전에 `poConfirm` 스키마로 검사하고 틀리면 요청을 보내지 않는다
  - WU-32 리뷰 의견 반영: 프롬프트 근거 칸 상한을 160자로 늘리고, 날짜 형식 오류를 `PF_VALIDATION`으로 바꿈(`prompts/draft-po.ts`, 시험 P-6 · P-7)
  - eple 리뷰 반영 — 확정 중간 실패 시 중복 발주 방지: 줄마다 따로 저장하므로 중간 줄이 거부되면 앞 줄은 이미 저장돼 있다. 서버(`confirmPoLines`)는 이때 오류 코드는 그대로 두고 `detail`에 `saved_count`(저장된 건수) · `saved`(구매 번호)를 덧붙이고, 화면은 저장된 줄을 표에서 빼고 안내(`draft-partial`)를 보인다. 남은 줄의 수정값은 그대로이고, 다시 눌러도 남은 줄만 등록된다. `saved_count` · `saved`는 04 3.8에 없는 추가 칸이다(기존 detail 칸은 건드리지 않음)
  - `tests/api/agent.test.ts`: T-AI-1 실제 DB 시험을 정식 파일로 추가(eple 요청, `test:db`가 `tests/api/**`를 돈다)
  - 금액(`purchase_cost`)은 화면에서 `단가 × 수량`으로 만들어 보낸다. 서버는 범위만 확인하고 다시 계산하지 않는다(04 3.8: 사용자가 고친 값)
- 직접 확인한 것:
  - `npm run lint` · `npm run typecheck` 오류 없음, `npm run test:unit` 전체 34개 파일 693개 통과(main 병합분 포함. 이 WU의 draft-po · 수정 칸 · 화면 렌더 · reorder 시험에 일부 저장 시험 C-6 · C-7 · S-1~S-9 · N-1 추가)
  - 시험이 잘못을 잡는지 확인: 확정의 "품목이 본인 것인지 확인" 줄을 지우자 C-2 실패, 되돌림
  - 다 됐다의 기준에 대응하는 단위 시험: 표의 재고 · 안전재고 · 단가는 DB 값, 추천 수량은 `reorder` 결과(D-1, T-AI-3 초안 쪽) / LLM 실패 시 표는 보이고 문안 없음 · 오류 표시(D-3 · V-2, T-AI-6 초안 쪽), 호출 상한 초과(D-4) / 남의 품목 → `PF_NOT_FOUND`, 저장 없음(C-2) / 수량 0 → 칸 아래 범위 문구, 요청 안 나감(F-4 · V-4) / 문안 숫자가 표와 달라도 표는 그대로(D-6)
  - 목 모드(`NEXT_PUBLIC_USE_MOCK=1`) 화면 확인(대시보드 [발주서 초안 보기]): 목 초안이 표와 문안 상자로 보임 / 수량 0 → "1 ~ 100,000 사이로 입력해 주세요", 알림 없음 / 수량 `8,5` → "숫자(정수)로 입력해 주세요" / 정상 값 확정 → "P-103 발주완료 1건" 알림과 완료 상자 / [취소] → "취소했어요. 저장된 것은 없어요."
  - 표 칸 폭 수정 뒤 같은 화면에서 품목 이름이 두 줄로 읽히고 오류 문구도 두 줄로 읽힘
  - **T-AI-1 (실제 dev DB, 2026-11-23)**: WU-21(PR #29)이 병합되고 eple이 dev에 마이그레이션을 적용한 뒤, `tests/db/helpers.ts`로 계정 A · B에 로그인한 실제 사용자 클라이언트에 `createPoDraft` · `confirmPoLines`를 직접 불러 확인했다(LLM만 가짜). 이 시험은 아래 `tests/api/agent.test.ts`로 정식 커밋했다. 4건 통과:
    - A를 `demo` 시드로 초기화 → 초안은 PRD-003만 후보(당시 demo 시드는 3품목. 시드가 8품목이 된 뒤에는 PRD-003 · PRD-007이 후보라 시험을 "PRD-003 포함 · 모든 줄이 DB 값과 같음"으로 바꿨다), 표 값(이름 · 단가 · 재고 3 · 안전재고 4)이 DB 값과 같고 추천 수량 1 · 거래처 "미지정" / `sku_ids` 필터 동작 / **초안만 만들면 `purchases` 건수 변화 없음**([취소]에 해당)
    - **[확인] 확정 → `purchases`에 `발주완료` 1건**(`source: agent`, 수량 6, 금액 72,000), 건수 +1, 재고 3 그대로, 불변식 통과
    - 계정 B가 A만의 품목으로 확정 → `PF_NOT_FOUND`, A · B 구매 건수 변화 없음, B의 초안에 A의 품목 없음
    - 한 줄이 없는 품목이면 다른 줄도 저장 안 됨
  - **`tests/api/agent.test.ts` (실제 dev DB, `npx vitest run --project db tests/api/agent.test.ts`)**: 계정 A · B의 사용자 JWT로 `/api/agent/draft-po` · `/confirm` route를 `Request`로 직접 불러 `createHandler`(CSRF · 로그인 · 스키마 · 응답 코드)까지 지나게 했다. LLM은 fake. 5건 통과:
    - T-AI-1a 초안이 PRD-003 표(DB 값)를 주고 `purchases` 건수 그대로 / T-AI-1b [확인] → 201, `발주완료` 1건(`source: agent`, 수량 · 금액 · 거래처 일치), 건수 +1, 재고 그대로, 불변식 통과
    - T-AI-1c (실패해야 함) `X-PF` 없음 → 403, 수량 0 → 400 `PF_VALIDATION`, 저장 없음 / T-AI-1d 없는 품목 포함 → 404 `PF_NOT_FOUND`, 다른 줄도 저장 안 됨 / T-AI-1e 계정 B가 A만의 품목으로 확정 → 404, A · B 건수 그대로
    - 끝에 계정 A를 `demo`로 되돌림
  - 실제 Supabase로 초안 조회: `from('items' · 'purchases' · 'stock_logs')`의 `in` · `eq` · `gte` · `order` · `limit` 체인이 실제 PostgREST에서 오류 없이 돌고 값이 DB와 같다(위 시험). PR #29의 `pf_create_purchase`와 호출 모양(인자 6개 · `source` `agent` 허용 · 수량 · 금액 범위 · 반환 구매 행)도 실행으로 맞는 것을 확인했다
  - 시험 뒤 계정 A를 `demo`로 되돌렸다(본인 데이터만, 임시 품목 · 구매 삭제)
  - **실제 화면 확인 (개발 서버 `NEXT_PUBLIC_USE_MOCK=0`, 로그인한 계정 A, 2026-11-23)**: 대시보드 [발주서 초안 보기] → `POST /api/agent/draft-po` 200, 실제 데이터 표(PRD-003, 재고 3 / 안전 4, 추천 1)와 Gemini 문안이 보임 / [발주 등록(확인)] → `POST /api/agent/draft-po/confirm` **201**(쿠키 · CSRF를 거친 실제 HTTP 경로), "P-102 발주완료 1건" 알림 · 완료 상자 / 확정 뒤 초안을 다시 보면 방금 만든 발주완료 건이 입고 예정으로 잡혀 "지금 발주할 품목이 없어요"
  - **일부 저장 흐름 (브라우저, 응답만 가짜로 끼움)**: 초안 2줄(PRD-003 · PRD-002)에서 첫 [발주 등록]에 중간 실패 응답(`saved_count: 1`, `saved: ['P-105']`)을 주자 PRD-003이 표에서 빠지고 PRD-002만 남음, 오류 배너와 `draft-partial` 안내("앞 1건(P-105)은 이미 저장됐어요 … 남은 줄만 등록돼요") 표시. 다시 누르자 요청에 PRD-002만 실림, 성공 알림 "P-106 발주완료 1건 (앞서 저장된 1건 포함 모두 2건)". 응답을 끼운 확인이라 DB에는 쓰지 않았다
  - **LLM 실패 안내**: 실제 Gemini가 503을 한 번 돌려줘(서버 로그 `llm.failed` `PF_LLM_UNAVAILABLE`) 표 · [발주 등록]은 그대로이고 문안 자리에 "AI 문안을 만들지 못했어요 … 아래 계산 결과로 직접 발주할 수 있어요"가 뜨는 것을 직접 봤다(T-AI-6)
  - **휴대폰 폭(375px 에뮬레이션)**: 패널이 화면 전체를 덮고, 표는 안쪽에서 가로로 스크롤되며 페이지 가로 스크롤은 없다(scrollWidth 375). 완료 상자 · 후보 없음 안내도 정상
- 확인 못 한 것:
  - 실제 LLM(Ollama · Gemini)으로 이 프롬프트의 문안 품질 — `generate()` 호출은 WU-31에서 확인했지만 발주서 프롬프트로 부른 적은 없다(WU-35 리허설)
  - 확정 뒤 대시보드 자동 새로고침: 대시보드가 화면에서 한 번만 불러오는 구조(WU-11, jkspawn 구역)라 이번에 손대지 않았다. 대시보드로 다시 가면 갱신된다
  - 확정은 줄마다 DB 함수를 한 번씩 부르므로 줄 사이를 묶는 트랜잭션이 없다. 중간 줄이 거부돼도 앞 줄은 저장되지만 위 "중복 발주 방지"로 다시 보내지 않게 했다. 품목 소유는 저장 전에 모든 줄을 확인한다. `saved_count` · `saved`를 04 3.8에 적을지는 eple 확인이 필요하다
  - 참고: `PoDraft.provider`에는 `gemini` · `ollama`만 있어 `fake`(시험 전용)를 `ollama`로 적는다. 계약(`src/types/agent.ts`, eple 구역)에 `fake`를 넣을지 확인이 필요하다
  - 참고: 수량이 0일 때 예상 금액 칸에 `0`이 보인다(오류 상태라 저장되지 않는다)
  - 후속 제안(요청함, #33): 발주서 초안 패널 폭을 왼쪽 가장자리를 끌어서 늘리거나 줄일 수 있으면 표가 덜 잘려서 더 편리할 것 같다. 폭은 `AgentSlot`(`layout.module.css`의 `--agent-width`, eple 구역)이 정해서 이 PR에서는 고치지 않았다. `request` 이슈 #33으로 eple에게 요청했으며, 챗봇(WU-34) 패널에도 같이 적용될 수 있다.
- AI가 틀린 것과 고친 과정:
  - **표 칸이 좁은 패널에서 쪼그라듦.** 화면 렌더 시험은 모두 통과했지만, 목 모드 화면에서 옆 패널(약 360px) 안의 품목 칸이 한 글자 폭으로 줄어 "PRD-003 노트북 거치대"가 `PRD-` / `003` / `노트` …처럼 세로로 깨지고, 수량 오류 문구도 네다섯 줄로 끊겼다(캡처로 발견)
  - 원인: 칸 최소 폭 없이 표 전체만 가로 스크롤하게 해서, 입력 칸이 있는 칸들이 남은 폭을 다 가져갔다
  - 수정: 품목(112px) · 추천 수량(132px) · 거래처(120px) 칸에 최소 폭을 주고 표 최소 폭을 720px로 올림(`agent.module.css`)
  - 재확인: 같은 화면에서 품목이 두 줄로 읽히고 수량 오류 문구도 두 줄로 읽힘
  - 교훈: 서버 렌더 시험은 레이아웃을 잡지 못한다. 실제 화면으로 한 번은 봐야 한다
  - 시험 코드의 `vi.fn` 인자 타입이 없어 `typecheck`가 실패(TS2352)해 인자 타입을 지정해 고침
  - `docs/records/ai-cases-skygaul.md` 사례 2로 남길 후보(표 칸 폭)
- PR: https://github.com/eple-lab/pack-flow/pull/34 (병합 뒤 후속: https://github.com/eple-lab/pack-flow/pull/45)
