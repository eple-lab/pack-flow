/**
 * 에이전트 패널 — 열린 모드(발주서 초안 · 챗봇)에 맞는 화면을 보여 준다.
 *
 * 하는 일
 * 1. <AgentSlot />(5단계 레이아웃)이 openAgentPanel 요청을 받아 이 패널을 연다(닫기 버튼은 슬롯이 가진다).
 * 2. draft-po 모드는 DraftPoView(WU-33). 요청마다 key를 달아 대상 품목이 바뀌면 새로 그린다.
 * 3. chat 모드는 ChatView(WU-34).
 *
 * 근거: docs/04-api-contract.md 3.8, docs/work-units/WU-33-*.md · WU-34-*.md
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple     자리 생성 (WU-04) — 구현은 skygaul WU-33/34
 * 2026-11-23  skygaul  draft-po 모드에 DraftPoView 연결 (WU-33)
 * 2026-11-23  skygaul  chat 모드에 ChatView 연결 (WU-34)
 */
import { ChatView } from './ChatView';
import { DraftPoView } from './DraftPoView';
import type { AgentPanelRequest } from './open';
import styles from './agent.module.css';

/**
 * 에이전트 패널. props: request(열린 모드와 대상 품목). testid: agent-panel
 */
export function AgentPanel({ request }: { request: AgentPanelRequest }) {
  const isDraft = request.mode === 'draft-po';
  return (
    <section className={styles.panel} data-testid="agent-panel" data-mode={request.mode}>
      <h2 className={styles.title}>{isDraft ? '발주서 초안' : '챗봇'}</h2>
      {isDraft ? (
        <DraftPoView key={`draft-po:${request.sku_ids?.join(',') ?? ''}`} skuIds={request.sku_ids} />
      ) : (
        <ChatView />
      )}
    </section>
  );
}
