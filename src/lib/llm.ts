/**
 * LLM 호출 래퍼 — 함수 시그니처만 있다(본문은 PF_NOT_IMPLEMENTED).
 *
 * 하는 일: skygaul가 WU-31에서 채운다. 제공자(gemini · ollama · fake)는 env-server의 LLM_PROVIDER로 정하고,
 * 호출 전 pf_llm_take()로 상한을 확인하며(P-09), 서버 쪽 20초 시간 초과(04 4.6)와 LLM 오류 → PF_LLM_UNAVAILABLE(P-08)을 지킨다.
 * 서버에서만 쓴다(키가 브라우저로 나가지 않게 — `import 'server-only'`를 붙여 구현할 것).
 *
 * 근거: docs/04-api-contract.md 3.8 · 4.6, docs/02-decisions.md D-06 · P-08 · P-09, docs/work-units/WU-31-*.md
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  자리 생성 (WU-04) — 구현은 skygaul WU-31
 */
import { PfError } from '@/lib/api/errors';

/** LLM에 보낼 요청. 프롬프트 전문은 로그에 남기지 않는다(길이만). */
export type LlmRequest = {
  /** 시스템 지시문 (src/lib/agent/prompts/) */
  system: string;
  /** 사용자 입력 또는 코드가 만든 사실표 */
  prompt: string;
  /** 구조화 응답(JSON)을 요구할 때의 힌트 */
  json?: boolean;
};

/** LLM 응답. */
export type LlmResponse = {
  text: string;
  provider: 'gemini' | 'ollama' | 'fake';
  /** 호출 지연(밀리초) — 로그용 */
  ms: number;
};

/**
 * LLM에 한 번 묻는다. 자리 — 항상 PF_NOT_IMPLEMENTED.
 * 구현 규칙: 호출 전 pf_llm_take로 상한 확인 → 초과 시 PF_QUOTA_EXCEEDED, 오류 · 시간 초과 시 PF_LLM_UNAVAILABLE.
 * @throws PfError PF_NOT_IMPLEMENTED(지금) · PF_QUOTA_EXCEEDED · PF_LLM_UNAVAILABLE(구현 뒤)
 */
export async function askLlm(request: LlmRequest): Promise<LlmResponse> {
  void request;
  throw new PfError('PF_NOT_IMPLEMENTED');
}
