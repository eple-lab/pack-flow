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

- [ ] `llm.test.ts`(fake): 정상 응답 / 시간 초과 → `PF_LLM_UNAVAILABLE` / 상한 1로 두고 두 번째 호출 → `PF_QUOTA_EXCEEDED` (T-AI-7)
- [ ] 로컬 Ollama로 `generate` 한 번 성공, `LLM_PROVIDER`만 바꿔 Gemini(본인 키, `.env.local`) 한 번 성공
- [ ] 공통 모델 결정 · 공지, `skygaul-llm-poc.md` 작성
- [ ] diff에 키 없음(비밀값 검사 통과)

## 테스트 방법

- 자동: `npm run test:unit -- src/lib/llm`
- 직접: 작은 스크립트나 임시 라우트로 두 제공자 호출(임시 코드는 커밋하지 않음)

## 실제 동작 확인 항목 (리뷰어 eple)

- [ ] 잘못된 `OLLAMA_BASE_URL`로 바꾸면 20초 안에 `PF_LLM_UNAVAILABLE`, 서버가 죽지 않음

## 결과 (담당자가 채움)

- 한 것:
- 직접 확인한 것:
- 확인 못 한 것:
- AI가 틀린 것과 고친 과정:
- PR:
