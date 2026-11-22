'use client';
/**
 * 에이전트 패널 자리 — openAgentPanel 요청을 구독해 AgentPanel을 보여 준다. 닫힘이 기본이다.
 *
 * 하는 일
 * 1. open.ts의 구독 저장소(useSyncExternalStore)로 마지막 요청을 읽는다. 요청이 없거나 [닫기]를 눌렀으면 아무것도 그리지 않는다.
 * 2. 열리면 오른쪽 폭 380px(휴대폰은 전체 시트)에 skygaul의 AgentPanel을 넣는다. 패널 내용은 skygaul 구역이다.
 * 3. 같은 요청 객체로는 다시 열리지 않는다(닫은 뒤 openAgentPanel을 또 부르면 새 객체라 다시 열린다).
 *
 * 근거: docs/wireframes.html 2절, docs/04-api-contract.md 3.8, WU-05 1번
 * 구역: eple (docs/06-work-plan.md 1절 '앱 뼈대') — 안에 들어가는 AgentPanel은 skygaul
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — AgentSlot (WU-05)
 */
import { useState, useSyncExternalStore } from 'react';
import { AgentPanel } from '@/components/agent/AgentPanel';
import { getLastAgentRequest, subscribeAgentPanel, type AgentPanelRequest } from '@/components/agent/open';
import styles from './layout.module.css';

/** 에이전트 패널 자리. testid: agent-slot, agent-close (열린 패널은 agent-panel) */
export function AgentSlot() {
  const request = useSyncExternalStore(subscribeAgentPanel, getLastAgentRequest, getLastAgentRequest);
  const [closed, setClosed] = useState<AgentPanelRequest | null>(null);

  if (!request || request === closed) return null;
  return (
    <aside className={styles.agent} data-testid="agent-slot">
      <div className={styles.agentHeader}>
        <button type="button" className={styles.ghostButton} onClick={() => setClosed(request)} data-testid="agent-close">
          닫기
        </button>
      </div>
      <AgentPanel request={request} />
    </aside>
  );
}
