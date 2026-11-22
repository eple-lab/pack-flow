/**
 * 에이전트 패널을 여는 유일한 입구 — 화면은 `openAgentPanel(...)`만 부르고, `<AgentSlot />`이 구독해서 연다.
 *
 * 하는 일
 * 1. 작은 구독 저장소다(React 컨텍스트 없이도 어느 화면에서든 부를 수 있다).
 * 2. 마지막 요청을 기억한다 — 패널이 아직 마운트되기 전에 불려도, 나중에 구독한 AgentSlot이 `getLastAgentRequest()`로 받는다.
 * 3. 파트 간 계약이다(jkspawn 화면 → skygaul 패널). 바꾸려면 PR과 양쪽 리뷰.
 *
 * 근거: docs/04-api-contract.md 3.8, WU-04 4번 · WU-05(AgentSlot)
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — openAgentPanel 구독 저장소 (WU-04)
 */

/** 패널을 어떻게 여는가: 발주서 초안(`sku_ids`로 품목 지정, 없으면 품절 임박 전체) 또는 챗봇. */
export type AgentPanelRequest = {
  mode: 'draft-po' | 'chat';
  /** draft-po에서 초안 대상 품목코드. 없으면 품절 임박 전체 */
  sku_ids?: string[];
};

type Listener = (request: AgentPanelRequest) => void;

const listeners = new Set<Listener>();
let lastRequest: AgentPanelRequest | null = null;

/**
 * 에이전트 패널을 연다(또는 모드를 바꾼다). 구독자(`<AgentSlot />`)가 모두 같은 요청을 받는다.
 * 부작용: 마지막 요청을 저장하고 구독자를 부른다.
 */
export function openAgentPanel(request: AgentPanelRequest): void {
  lastRequest = { mode: request.mode, ...(request.sku_ids ? { sku_ids: [...request.sku_ids] } : {}) };
  for (const listener of [...listeners]) listener(lastRequest);
}

/**
 * 패널 열기 요청을 구독한다(AgentSlot이 쓴다).
 * @returns 구독 해제 함수
 */
export function subscribeAgentPanel(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 마지막으로 연 요청(없으면 null). AgentSlot이 마운트되기 전에 불린 요청을 이어받을 때 쓴다. */
export function getLastAgentRequest(): AgentPanelRequest | null {
  return lastRequest;
}

/** 시험용: 구독자와 기억한 요청을 비운다. */
export function resetAgentPanelForTest(): void {
  listeners.clear();
  lastRequest = null;
}
