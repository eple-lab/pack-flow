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

- [x] 배포 URL에서 T-AI-1 · 2 · 4가 Gemini로도 같은 결과 (11/24, 아래 결과 절)
- [x] `ai-limits.md` · `llm-usage.md` · 사례 3개 완성 — 결제 미연결 · 청구 0원은 배포 키(eple) · 개발용 키(skygaul) 각각 11/24에 확인해 `llm-usage.md` 3절에 채움
- [x] 문서에 키 · 이메일 없음 (세 문서 스캔, 아래 결과 절)

## 테스트 방법

- 자동: `npm run test:unit -- src/lib/llm.test.ts src/lib/agent` (LLM 호출 · 초안 로직). 에이전트 API는 `npm run test:db -- tests/api/agent.test.ts` (dev DB와 본인 계정 필요)
- 직접: 배포 URL(Gemini)에서 시연 순서의 에이전트 부분을 3회 (발주서 초안 → 확인, 챗봇 5문장). 결과 · 지연 · 실패를 기록하고, Ollama 결과(WU-34)와 같은 문장으로 비교: 액션 JSON 일치 여부, 문안 품질 한 줄 평. `ai-limits.md` · `llm-usage.md`가 실제 동작과 맞는지 읽어 보고, `docs/records/ai-cases-*.md`의 사례 3개가 원인 · 수정 · 재검증을 갖췄는지 확인
- 준비: Gemini 키는 배포 환경변수에만 두고 문서 · 대화에 적지 않는다. 로컬 Ollama 설정은 `.env.local`의 `LLM_PROVIDER` · `OLLAMA_BASE_URL` 이름만 확인한다

## 실제 동작 확인 항목 (리뷰어 eple)

- [x] 사례 3개가 "원인 · 수정 · 재검증"을 모두 갖춤 — 11/24 eple #63 리뷰 · 승인

## 결과 (담당자가 채움)

- 한 것:
  - `docs/records/ai-cases.md`: 팀원별 기록(`ai-cases-*.md`)에서 사례 3개를 골라 발표용으로 정리(원인 · 수정 · 재검증, 작성자 표시). 사례 1 · 2는 skygaul(WU-31 · 34), 사례 3은 jkspawn(WU-11). 고르지 않은 사례와 이유도 적음. 원본 파일은 그대로 둠
  - `docs/records/ai-limits.md`: 못 하는 것 · 막아 둔 것(시험 ID 연결) · 외부 모델로 보내는 데이터와 Gemini 무료 티어 데이터 정책. 11/24에 배포 503 · 지연 · T-AI 결과, 개발도 Gemini 키를 쓴 사실(입력이 외부로 나감), **Ollama와 Gemini 같은 5문장 비교표**(한계 포함)를 추가
  - `docs/records/llm-usage.md`: 호출 세는 방법 · 상한(사용자 30 · 전체 300, 실패한 호출도 셈) · 날짜별 호출 수(dev · demo, eple 조회) · 비용 조건 · 지연(개발 PC, 배포 11/24)
  - 배포 URL(Gemini `gemini-3.5-flash-lite`)에서 리허설: 초안 4회(취소 · 확인 포함), 챗봇 5문장 + 실패 1회
  - 막힌 것을 찾아 알림: 배포 Gemini 호출 실패(`PF_LLM_UNAVAILABLE`, 11/23) → eple가 Render 설정 확인, 11/24에 초안 성공. 챗봇만 503 1회(Gemini 서버 일시 과부하로 보임) → 재시도하니 5건 모두 성공. 이 일로 #59(토큰 사용량 로그)가 생겼고, #65로 병합돼 배포 로그에서 확인함(아래)
- 직접 확인한 것:
  - 배포 초안 4회: 모두 200, `provider: gemini`, 1.4 ~ 12.6초. [취소] → 구매 4건 그대로, [발주 등록(확인)] → 구매 4→5건(P-105, `source: agent`, 발주완료) — T-AI-1
  - 배포 챗봇 5문장 모두 성공(1.0 ~ 4.2초): 재고 조회 10개(DB 값과 일치) · 부족 품목 3개(DB 값) · 출고 제안만(실행 안 함) · "노트북 거치대 50개 출고해 줘" → "재고가 부족해요. PRD-003 남은 수량 3개"(T-AI-2) · "모든 재고를 0으로 바꿔" → "도와드릴 수 없어요"(T-AI-4). 끝나고 재고 · 판매 건수가 그대로임을 API로 확인
  - 개발 PC: 같은 챗봇 문장이 실제 Gemini로 성공(서버 로그 `llm.ok` 0.85초) → 배포 503은 코드 문제가 아님
  - `npm run lint` 오류 0 · `npm run typecheck` 통과 · `npm run test:unit` 40파일 761개 통과(11/24, 이 브랜치)
  - `ai-cases.md` · `ai-limits.md` · `llm-usage.md` 키 · 이메일 · 사용자 폴더 경로 · 토큰 패턴 스캔: 없음. 커밋 때마다 `check-secrets.sh --staged` 통과
  - 지연 원인(#59 · #65): 개발 서버 실제 Gemini 호출 로그에 `promptTokenCount 437` · `candidatesTokenCount 72`, `thoughtsTokenCount`는 응답에 없음. 배포 로그는 eple가 확인(같은 요청 `promptLen 688`이 오전 4.8초 · 4.3초, 12:26에 1.4초, 토큰 숫자 같음) → 생각 단계가 아니라 Gemini 응답 속도의 편차로 봄(`llm-usage.md` 4절)
  - 결제: 개발용 키는 skygaul이, 배포 키는 eple가 AI Studio 화면에서 "Free tier" · 결제 미설정을 확인(화면 읽기만, 청구 금액 화면은 개발용 키는 따로 보지 않음)
- 확인 못 한 것:
  - **11/24 demo 호출 수 최종값**: eple가 11:14에 조회한 4건에 이후 리허설 6회가 더해졌다(약 10건). 화면 기록으로 적었고 SQL로 다시 조회하지 않았다
  - **Ollama 비교**: 이번에 다시 돌리지 않고 WU-34의 기록(가짜 DB, `qwen3.5:0.8b`)과 배포 Gemini 결과를 맞췄다. 팀 공통 모델 `qwen3.5:4b`로는 돌려 보지 못했다
  - 배포 503이 일시 과부하인지는 추측이다(응답 본문이 로그에 없음). 지연은 생각 토큰이 없어 Gemini 응답 속도의 편차로 보지만, 표본이 적고(3~4건) 12.6초 한 번은 토큰 로그가 없던 때라 숫자로 확인하지 못했다
  - 사례 3개가 "원인 · 수정 · 재검증"을 갖췄는지는 리뷰어(eple) 확인 항목이다
  - 결정 문서 D-06("개발은 Ollama")은 실제(개발도 Gemini)와 달라 eple에게 수정을 요청했다(11/24 전달 완료, eple 구역이라 이 PR에서는 고치지 않음). eple가 "Ollama로 진행이 어려우면 각자 본인 계정의 Gemini 개발용 키(로컬 `.env.local`에만)"로 D-06 · 계획서 9절을 고쳤고(#62 병합), 그 문구가 실제 운영과 맞는지 skygaul이 확인했다(`.env.local`은 `.gitignore`에 걸리고 저장소에는 `.env.example`만 올라가 있음)
- PR: https://github.com/eple-lab/pack-flow/pull/63
