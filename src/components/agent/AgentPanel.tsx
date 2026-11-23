'use client';

/**
 * 에이전트 패널 — 탭 두 개(발주 초안 · 대화)로 두 화면을 오간다.
 *
 * 하는 일
 * 1. <AgentSlot />(5단계 레이아웃)이 openAgentPanel 요청을 받아 이 패널을 연다(닫기 버튼은 슬롯이 가진다).
 *    열린 모드(draft-po · chat)가 처음 탭이고, 패널 안에서 탭을 눌러 다른 화면으로 넘어간다(와이어프레임 7절).
 * 2. 발주 초안 탭은 DraftPoView(WU-33), 대화 탭은 ChatView(WU-34). 안 연 탭은 그리지 않고, 한 번 연 탭은 숨기기만 한다
 *    (초안은 그려지는 순간 LLM을 부르므로 챗봇으로 연 패널에서 요청이 나가지 않게, 오갈 때 다시 부르지 않게).
 * 3. 요청의 모드 · 품목이 달라지면 패널을 처음부터 새로 그린다(`tabsKey`).
 *
 * 근거: docs/04-api-contract.md 3.8, docs/wireframes.html 7절, docs/work-units/WU-33-*.md · WU-34-*.md
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple     자리 생성 (WU-04) — 구현은 skygaul WU-33/34
 * 2026-11-23  skygaul  draft-po 모드에 DraftPoView 연결 (WU-33)
 * 2026-11-23  skygaul  chat 모드에 ChatView 연결 (WU-34)
 * 2026-11-23  skygaul  패널 안 탭(발주 초안 · 대화) 추가 — 챗봇으로 들어가는 길이 없던 문제 (WU-34)
 */
import { useState } from 'react';
import { AGENT_TABS, initialTabState, selectTab, tabsKey, type AgentMode, type TabState } from './agent-tabs';
import { ChatView } from './ChatView';
import { DraftPoView } from './DraftPoView';
import type { AgentPanelRequest } from './open';
import styles from './agent.module.css';

/**
 * 탭 줄과 두 화면(받은 상태를 그리는 순수 그리기). 시험에서 상태를 넣어 그린다.
 *
 * props
 * - state: 보이는 탭 · 한 번 연 탭, skuIds: 초안 대상 품목코드(없으면 품절 임박 전체), onSelect: 탭을 눌렀을 때
 *
 * testid: agent-tab-draft-po, agent-tab-chat, agent-pane-draft-po, agent-pane-chat
 */
export function AgentPanelTabs({
  state,
  skuIds,
  onSelect,
}: {
  state: TabState;
  skuIds: string[] | undefined;
  onSelect: (mode: AgentMode) => void;
}) {
  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="에이전트 기능">
        {AGENT_TABS.map((tab) => {
          const selected = state.mode === tab.mode;
          return (
            <button
              key={tab.mode}
              type="button"
              role="tab"
              id={`agent-tab-${tab.mode}`}
              aria-selected={selected}
              aria-controls={`agent-pane-${tab.mode}`}
              className={selected ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              data-testid={`agent-tab-${tab.mode}`}
              onClick={() => onSelect(tab.mode)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {state.visited.includes('draft-po') && (
        <div
          role="tabpanel"
          id="agent-pane-draft-po"
          aria-labelledby="agent-tab-draft-po"
          hidden={state.mode !== 'draft-po'}
          data-testid="agent-pane-draft-po"
        >
          <DraftPoView skuIds={skuIds} />
        </div>
      )}
      {state.visited.includes('chat') && (
        <div role="tabpanel" id="agent-pane-chat" aria-labelledby="agent-tab-chat" hidden={state.mode !== 'chat'} data-testid="agent-pane-chat">
          <ChatView />
        </div>
      )}
    </>
  );
}

function PanelBody({ request }: { request: AgentPanelRequest }) {
  const [state, setState] = useState<TabState>(() => initialTabState(request.mode));
  return (
    <section className={styles.panel} data-testid="agent-panel" data-mode={state.mode}>
      <h2 className={styles.title}>AI 에이전트</h2>
      <AgentPanelTabs state={state} skuIds={request.sku_ids} onSelect={(mode) => setState((prev) => selectTab(prev, mode))} />
    </section>
  );
}

/**
 * 에이전트 패널. props: request(열린 모드와 대상 품목, 처음 보일 탭). testid: agent-panel(data-mode = 지금 보이는 탭)
 */
export function AgentPanel({ request }: { request: AgentPanelRequest }) {
  return <PanelBody key={tabsKey(request)} request={request} />;
}
