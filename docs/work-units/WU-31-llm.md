# WU-31 LLM 호출층 · 호출 상한

- 담당: skygaul / 검증: eple / Step 5 / Wave 1 · 11/23(월)
- 브랜치: `feat/WU-31-llm`
- 의존: WU-02(`pf_llm_take`), WU-04(`src/lib/llm.ts` 자리)

## 왜 (근거)

D-06 "LLM 호출은 `lib/llm.ts` 한곳, 설정값으로 Ollama ↔ Gemini 전환", P-09 호출 상한, Step 5 "LLM 장애 · 한도 초과 시 기본 기능은 계속 동작". 테스트가 흔들리지 않도록 `fake` 제공자도 둔다([07](../07-test-strategy.md) 2절).

## 읽을 파일

- [04](../04-api-contract.md) 2절(`PF_QUOTA_EXCEEDED`, `PF_LLM_UNAVAILABLE`), [05](../05-security.md) 2 · 4절
- `src/lib/llm.ts`(자리), `src/types/agent.ts`(eple 소유 — 읽기만), `src/lib/env.ts` · `src/lib/log.ts`(eple 소유 — 키는 `env.ts`로만 읽고, 로그는 `log.ts`로만), `.env.example`의 LLM 변수
- 계획서 8절 POC(Gemini · Ollama 메모)

## 만들 · 고칠 파일 (내 구역만)

- `src/lib/llm.ts`, `src/lib/llm.test.ts`
- `docs/records/skygaul-llm-poc.md`(공통 모델 시험 기록)

## 하지 말 것

- 키를 코드 · 로그 · 테스트 기록에 쓰기. 키는 `process.env`에서만, 서버 코드에서만(`NEXT_PUBLIC_` 금지)
- 프롬프트 전문을 서버 로그에 남기기(길이 · 지연 · 결과 코드만)
- 패키지 직접 추가 — Gemini SDK가 필요하면 eple에게 요청(REST `fetch`로도 가능)

## 고치는 방법

1. 인터페이스: `generate({ system, user, json?: boolean, maxTokens? }) → { text, provider, latencyMs }`
2. 제공자: `LLM_PROVIDER = gemini | ollama | fake`
   - `ollama`: `OLLAMA_BASE_URL` + `LLM_MODEL`
   - `gemini`: `GEMINI_API_KEY` + `LLM_MODEL`
   - `fake`: 테스트용, 입력에 따라 미리 정한 JSON을 돌려줌(테스트 파일에서 응답 주입)
3. 시간 초과 20초, 네트워크 · 4xx · 5xx · 빈 응답 → `PF_LLM_UNAVAILABLE`(원문 오류는 로그에만)
4. 호출 전 `pf_llm_take(30, 300)`(사용자 JWT 클라이언트로) → false면 `PF_QUOTA_EXCEEDED`. 상한 숫자는 환경변수 `LLM_LIMIT_USER`, `LLM_LIMIT_GLOBAL`로(기본 30 · 300)
5. 팀 공통 Ollama 모델 정하기(08 Q-12): 후보 2~3개에 같은 문장 3개("PRD-001 재고 몇 개야?" 등)를 넣고 JSON 형식 지킴 · 한국어 · 속도를 표로 기록 → 팀 채널에 공지
6. 각자 AI Studio에서 Gemini 실제 한도 확인 결과를 같은 기록에(08 Q-15)

## 다 됐다의 기준

> 11/26 eple 사후 확인: 개발 종료 뒤 소스 · 시험 · 기록으로 확인한 칸만 체크

- [x] `llm.test.ts`(fake): 정상 응답 / 시간 초과 → `PF_LLM_UNAVAILABLE` / 상한 1로 두고 두 번째 호출 → `PF_QUOTA_EXCEEDED` (T-AI-7) — (11/26 eple 사후 확인: src/lib/llm.test.ts L-1 · L-3 · L-4(T-AI-7) 11/26 재실행 통과(unit 869개 전체 통과))
- [x] 로컬 Ollama로 `generate` 한 번 성공, `LLM_PROVIDER`만 바꿔 Gemini(본인 키, `.env.local`) 한 번 성공 — (11/26 eple 사후 확인: WU-31 결과 절(실제 Ollama 281ms · 실제 Gemini 3회) · skygaul-llm-poc.md 1절 · review-eple.md(배포 Gemini 4회 성공))
- [ ] 공통 모델 결정 · 공지, `skygaul-llm-poc.md` 작성 — (11/26 사후 확인 못 함: skygaul-llm-poc.md는 있으나 '진행 중' 상태이고 2절 시험 표가 비어 있음. 공통 모델로 같은 문장 3개 시험 · 공지 기록이 없음(WU-31 결과 절 '확인 못 한 것' ③))
- [x] diff에 키 없음(비밀값 검사 통과) — (11/26 eple 사후 확인: security-check-1125.md(키 0건) · pre-commit · CI secret-check 통과(#6 병합))

## 테스트 방법

- 자동: `npm run test:unit -- src/lib/llm`
- 직접: 작은 스크립트나 임시 라우트로 두 제공자 호출(임시 코드는 커밋하지 않음)

## 실제 동작 확인 항목 (리뷰어 eple)

- [x] 잘못된 `OLLAMA_BASE_URL`로 바꾸면 20초 안에 `PF_LLM_UNAVAILABLE`, 서버가 죽지 않음 — 11/24 eple: `LLM_TIMEOUT_MS = 20_000`, main에서 O-3 · O-4 · L-3(T-AI-6) 재실행 통과 + skygaul PoC 실측. 로컬 서버 재현은 안 함 (근거 #6 댓글)

## 결과 (담당자가 채움)

- 한 것:
  - `src/lib/llm.ts`: `generate({ system, user, json?, maxTokens? })` → `{ text, provider, latencyMs }`. 제공자 `fake` · `ollama` · `gemini`(REST `fetch`, 새 패키지 없음)
    - 호출 전 사용자 JWT 클라이언트로 `pf_llm_take(30, 300)` → 넘으면 `PF_QUOTA_EXCEEDED`(detail `scope`)
    - 20초 시간 초과 · 네트워크 · HTTP 오류 · 빈 응답 → `PF_LLM_UNAVAILABLE`(원문 오류는 밖으로 안 나감, 로그에는 제공자 · 이유 · 상태 · 길이 · 지연만)
    - 설정(모델 · 키)이 비면 상한을 쓰기 전에 멈춤. Gemini 키는 요청 헤더에만 싣고 주소 · 로그에 없음. Ollama 요청에는 `think:false`를 보냄
    - eple이 만든 자리(`askLlm`, `prompt`, `ms`)는 이 문서의 인터페이스(`generate`, `user`, `latencyMs`)로 바꿨다. 쓰는 코드가 아직 없었다
  - `src/lib/llm.test.ts`: 19건 (fake · 시간 초과 · 상한 T-AI-7 · ollama · gemini · 설정 누락 · 로그)
  - `docs/records/skygaul-llm-poc.md`: Ollama thinking 모델 발견, Gemini 무료 한도 표, 실제 호출 결과
  - Ollama `qwen3.5`로 시험하다 응답 토큰 한도 200을 생각(thinking)에 다 써서 답이 비어 진행이 어려웠고, 팀장에게 보고한 뒤 개발용 Gemini 키를 발급받아 Gemini로 진행했다(skygaul 보고)
- 직접 확인한 것:
  - `npm run test:unit -- src/lib/llm` → 19개 통과, `npm run lint` · `npm run typecheck` 오류 없음, `npm run test:unit` 전체 461개 통과
  - 시험이 잡는지: 시간 초과 때 요청을 취소(abort)하는 줄을 지우자 O-4 실패, 되돌림
  - **실제 Ollama**(`qwen3.5:0.8b`): `generate()` 성공(JSON 답, 281ms). `think:false` 없이는 `content`가 빈 채 끝남(아래 AI 사례)
  - **실제 Gemini**(`gemini-3.5-flash-lite`, 임시 시험 · 커밋 안 함 · 상한 함수는 막음): 세 번 성공 — 재고 질문 → 액션 JSON 1.7초, 발주서 문안 1.0초(표의 수량 · 단가 · 거래처 · 납기 그대로), 허용 밖 요청 → `{"type":"refused"}` 0.9초. 빈 응답 없음
  - 잘못된 Ollama 주소(연결 거부) → `PF_LLM_UNAVAILABLE`, 서버는 죽지 않음(1ms)
  - Gemini 무료 한도(AI Studio 표): Flash Lite 계열(3.1 · 3.5) 분당 15 · 토큰 250K · 하루 500 / 다른 Flash 계열과 4 Hydrogen은 하루 20 → Flash Lite를 쓴다 ([기록](../records/skygaul-llm-poc.md) 3절)
  - 다 됐다의 기준: ① `llm.test.ts`(정상 / 시간 초과 / 상한 1 → 두 번째 `PF_QUOTA_EXCEEDED`) 통과 ② 로컬 Ollama 한 번 · Gemini 한 번 성공 ④ diff에 키 없음(커밋 훅 통과)
- 확인 못 한 것:
  - **③ 팀 공통 Ollama 모델**: 1일차에 `qwen3.5:4b`(사양이 낮으면 3B급)로 정했다(skygaul 보고). 다만 그 모델로 같은 문장 3개를 돌려 본 시험은 못 했다 — 이 PC에는 0.8B만 설치돼 있다(`skygaul-llm-poc.md` 2절 표가 비어 있다). `qwen3.5` 계열이라 `think:false` 없이는 빈 응답이 날 수 있어 `llm.ts`가 항상 보내게 했고, 4b에서의 동작은 확인하지 못했다
  - `pf_llm_take`를 실제 dev DB로 부른 호출(시험은 가짜 클라이언트 · 임시 Gemini 시험은 상한 함수를 막았다) — WU-33 API 시험에서 확인
  - `think:false`를 생각 기능이 없는 Ollama 모델에 보냈을 때 동작
  - `gemini-3.5-flash-lite`와 3.1 Flash Lite의 비교, 긴 요청에서의 빈 응답 여부(짧은 세 요청만 해 봄)
  - 응답이 없는 주소에서의 20초 시간 초과(단위 시험 L-3 · O-4로만 확인, 연결 거부 주소는 1ms에 끝남)
  - 배포(Render)에서 Gemini 호출(eple이 배포 키를 직접 넣음 — WU-35)
- AI가 틀린 것과 고친 과정:
  - **빈 응답(Ollama thinking 모델).** 처음 구현은 Ollama 요청에 `think:false`가 없었다. 가짜 fetch 단위 시험은 모두 통과했지만 실제 `qwen3.5:0.8b` 호출은 `PF_LLM_UNAVAILABLE`이었다(이유 `empty`)
  - 원인: thinking 모델이 기본값에서 응답 토큰(`num_predict` 200)을 모두 생각에 쓰고 `content`가 빈 채 `done_reason: length`로 끝남(생각 788자, `content` 0자)
  - 수정: `think:false`를 항상 보내고 테스트 O-1에 `body.think === false`를 추가
  - 재확인: 같은 요청이 35토큰 · 0.4초에 JSON으로 답함, `generate()`로 281ms 성공
  - 교훈: 가짜 fetch 시험만으로는 이 문제를 못 잡는다 — 실제 호출을 한 번은 해 봐야 한다. `docs/records/ai-cases-skygaul.md`에 한 건 남길 것
- PR: https://github.com/eple-lab/pack-flow/pull/6
