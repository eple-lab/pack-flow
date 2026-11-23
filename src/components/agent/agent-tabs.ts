/**
 * 에이전트 패널 탭 상태 — 순수 함수. 탭 두 개(발주 초안 · 대화), 한 번 연 탭은 유지한다.
 *
 * 하는 일
 * 1. `initialTabState`: 열린 모드가 처음 탭이다. 그 탭만 '한 번 연 탭'으로 센다.
 * 2. `selectTab`: 다른 탭을 누르면 그 탭으로 바꾸고 '한 번 연 탭'에 더한다. 안 연 탭은 화면이 그리지 않는다 —
 *    발주 초안은 그려지는 순간 LLM을 부르고(호출 상한 +1) 챗봇으로 연 패널에서 초안 요청이 나가면 안 되기 때문이다.
 *    한 번 연 탭은 숨기기만 하고 다시 그리지 않아 오갈 때 LLM을 또 부르지 않는다.
 * 3. `tabsKey`: 패널을 새로 그릴지 정하는 키(요청의 모드 · 품목이 달라지면 처음부터).
 *
 * 근거: docs/wireframes.html 7절(탭 두 개), docs/work-units/WU-34-chat.md
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  skygaul  처음 작성 — 패널 탭 상태 (WU-34)
 */
import type { AgentPanelRequest } from './open';

export type AgentMode = AgentPanelRequest['mode'];

/** 탭 목록(화면에 보이는 순서). */
export const AGENT_TABS: ReadonlyArray<{ mode: AgentMode; label: string }> = [
  { mode: 'draft-po', label: '발주 초안' },
  { mode: 'chat', label: '대화' },
];

export type TabState = {
  /** 지금 보이는 탭 */
  mode: AgentMode;
  /** 한 번이라도 연 탭(그린 적이 있는 탭). 순서는 연 순서 */
  visited: readonly AgentMode[];
};

/** 열린 모드가 처음 탭이다. */
export function initialTabState(mode: AgentMode): TabState {
  return { mode, visited: [mode] };
}

/** 탭을 고른다. 모르는 탭 이름은 무시하고 상태를 그대로 돌려준다. */
export function selectTab(state: TabState, mode: AgentMode): TabState {
  if (!AGENT_TABS.some((tab) => tab.mode === mode)) return state;
  if (state.mode === mode && state.visited.includes(mode)) return state;
  return { mode, visited: state.visited.includes(mode) ? state.visited : [...state.visited, mode] };
}

/** 같은 요청이면 같은 키. 키가 바뀌면 패널이 새로 그려진다(탭 상태도 처음으로). */
export function tabsKey(request: AgentPanelRequest): string {
  return `${request.mode}:${request.sku_ids?.join(',') ?? ''}`;
}
