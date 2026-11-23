# AI 활용 · 디버깅 사례 (skygaul)

작성일: 2026-11-23 · 근거: [07 테스트 전략](../07-test-strategy.md) 5절 · [AGENTS.md](../../AGENTS.md) 4 · 6절 · 원본 작업: [WU-31](../work-units/WU-31-llm.md)

> 실패 → 원인 → 고침 → 재확인 순서로 적는다. 입력은 모두 가상 데이터이고, 키 · 개인 정보는 적지 않는다. 11/25에 `ai-cases.md`로 모을 때 이 파일은 그대로 둔다(WU-35).

## 사례 1 — 단위 시험은 모두 통과했는데 실제 Ollama 호출이 빈 응답이었다 (작성: skygaul, 2026-11-23, WU-31)

- 맡긴 것: Claude(Claude Code)에게 WU-31 문서대로 `src/lib/llm.ts`(fake · ollama · gemini 제공자, 20초 시간 초과, 호출 상한)와 단위 시험을 쓰게 했다. 시험을 먼저 쓰고 기대 결과를 적은 뒤 구현하게 했다(D-34).
- AI가 낸 것: `src/lib/llm.ts`의 Ollama 호출. `POST /api/chat`에 `model` · `stream:false` · `messages`(+ JSON이면 `format:"json"`, `maxTokens`는 `num_predict`)를 보냈다. 시험 19건은 가짜 `fetch`로 돌았고 모두 통과했다.
- 문제: 같은 `generate()`를 이 PC의 실제 Ollama(`qwen3.5:0.8b`)에 `json:true`, `maxTokens:200`으로 부르자 `PF_LLM_UNAVAILABLE`이 났다. 서버 로그: `llm.failed … provider:"ollama", reason:"empty"`(약 8초 뒤). 가짜 `fetch` 시험은 응답에 항상 글자가 들어 있게 만들어 둬서 이 경우를 잡지 못했다.
- 원인: `qwen3.5`는 능력 목록에 `thinking`이 있는 생각 모델이다. 기본값에서는 응답 토큰(`num_predict` 200)을 모두 생각에 쓰고 `message.content`가 빈 글자로 끝난다. 직접 확인한 값(같은 요청, `curl`):

  | `think` | `content` | 생각 길이 | 종료 사유 | 토큰 |
  |---|---|---|---|---|
  | 보내지 않음 | 빈 글자 | 788자 | `length` | 200 |
  | `false` | `{"answer": …}` JSON | 0 | `stop` | 35 |

  팀에서 같은 모델로 시험하다 응답 토큰 한도를 생각에 다 써서 막혔다는 보고(skygaul)도 같은 현상이다.
- 고친 것: Ollama 요청에 `think:false`를 항상 싣는다(`src/lib/llm.ts`). 재발 방지로 `llm.test.ts` O-1에 `body.think === false`를 추가했다. 커밋 `0669d7a`(고친 내용이 처음 커밋에 함께 들어갔다 — 빈 응답이던 첫 버전은 커밋하지 않았다).
- 다시 확인:
  - `npm run test:unit -- src/lib/llm` → 19개 통과(O-1 포함)
  - 실제 Ollama `generate()` 성공: JSON 답, 지연 281ms
  - `npm run lint` · `npm run typecheck` 오류 없음, `npm run test:unit` 전체 461개 통과
- 남은 한계: `think:false`를 생각 기능이 없는 모델에 보냈을 때 동작은 이 PC에 모델이 하나뿐이라 확인하지 못했다. 팀 공통 모델을 정하면 그 모델로 다시 확인한다.
- 배운 것: 외부 서비스를 가짜로 바꿔 쓴 시험은 코드 흐름만 보장한다. 제공자의 실제 응답 모양(여기서는 생각 모델이 `content`를 비움)은 한 번은 실제 호출로 확인해야 한다.
