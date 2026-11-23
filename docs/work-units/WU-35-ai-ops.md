# WU-35 Gemini 리허설 · AI 한계 문서 · AI 사례 정리

- 담당: skygaul / 검증: eple / Step 5(운영 준비) / Wave 3 · 11/25(수)
- 브랜치: `feat/WU-35-ai-ops`
- 의존: WU-33 · 34 병합, 배포 URL

## 왜 (근거)

Step 5 "요청량 상한과 비용을 기록하고, AI가 하지 못하는 것을 적은 한계 문서", 계획서 8절 "두 모델의 답변 스타일이 달라 4일차 리허설 때 Gemini로", 제출물 'AI 활용 · 디버깅 사례 3개', 피드백 기준 4.

## 읽을 파일

- [07](../07-test-strategy.md) 5절 양식, 계획서 15절, `docs/records/ai-cases-*.md`(팀원들이 각자 쌓은 것)

## 만들 · 고칠 파일 (내 구역만)

- `docs/records/ai-limits.md`, `docs/records/ai-cases.md`(사람별 파일을 모아 정리, 원본 파일은 그대로 둠), `docs/records/llm-usage.md`
- 프롬프트 수정이 필요하면 `src/lib/agent/prompts/*` (버그 수준만, 새 기능 금지)

## 하지 말 것

- 리허설에서 실제 거래처 · 개인 정보 입력
- 키가 보이는 화면 캡처

## 고치는 방법

1. 배포 URL(Gemini)에서 시연 순서의 에이전트 부분 3회: 초안 → 확인, 챗봇 5문장. 결과 · 지연 · 실패를 기록
2. Ollama 결과(WU-34)와 비교표: 같은 문장, 액션 JSON 일치 여부, 문안 품질 한 줄 평
3. `ai-limits.md`: 못 하는 것(품목 이름이 비슷하면 헷갈림, 추천 수량은 단순 공식, 발송은 시연용 등), 막아 둔 것(허용 액션, 확인 후 실행, 수치 대조), 무료 티어 데이터 정책
4. `llm-usage.md`: 날짜별 호출 수(`llm_usage`), 상한, 비용 0원 확인
5. `ai-cases-*.md`에서 실패 → 고침 → 재확인 사례 3개를 골라 발표용으로 다듬기(작성자 표시)

## 다 됐다의 기준

- [ ] 배포 URL에서 T-AI-1 · 2 · 4가 Gemini로도 같은 결과
- [ ] `ai-limits.md` · `llm-usage.md` · 사례 3개 완성
- [ ] 문서에 키 · 이메일 없음

## 테스트 방법

- 자동: `npm run test:unit -- src/lib/llm.test.ts src/lib/agent` (LLM 호출 · 초안 로직). 에이전트 API는 `npm run test:db -- tests/api/agent.test.ts` (dev DB와 본인 계정 필요)
- 직접: 배포 URL(Gemini)에서 시연 순서의 에이전트 부분을 3회 (발주서 초안 → 확인, 챗봇 5문장). 결과 · 지연 · 실패를 기록하고, Ollama 결과(WU-34)와 같은 문장으로 비교: 액션 JSON 일치 여부, 문안 품질 한 줄 평. `ai-limits.md` · `llm-usage.md`가 실제 동작과 맞는지 읽어 보고, `docs/records/ai-cases-*.md`의 사례 3개가 원인 · 수정 · 재검증을 갖췄는지 확인
- 준비: Gemini 키는 배포 환경변수에만 두고 문서 · 대화에 적지 않는다. 로컬 Ollama 설정은 `.env.local`의 `LLM_PROVIDER` · `OLLAMA_BASE_URL` 이름만 확인한다

## 실제 동작 확인 항목 (리뷰어 eple)

- [ ] 사례 3개가 "원인 · 수정 · 재검증"을 모두 갖춤

## 결과 (담당자가 채움)

- 한 것:
- 직접 확인한 것:
- 확인 못 한 것:
- PR:
