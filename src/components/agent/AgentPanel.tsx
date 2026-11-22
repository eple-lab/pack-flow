/**
 * 에이전트 패널 — 빈 패널 자리. 열린 모드만 보여 준다.
 *
 * 하는 일: skygaul가 WU-33(발주서 초안) · WU-34(챗봇)에서 DraftPoView · ChatView를 꽂아 채운다.
 * <AgentSlot />(5단계 레이아웃)이 openAgentPanel 요청을 받아 이 패널을 연다.
 *
 * 근거: docs/04-api-contract.md 3.8, docs/work-units/WU-33-*.md · WU-34-*.md
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  자리 생성 (WU-04) — 구현은 skygaul WU-33/34
 */
import type { AgentPanelRequest } from './open';

/**
 * 빈 패널. props: request(열린 모드와 대상 품목). testid: agent-panel
 */
export function AgentPanel({ request }: { request: AgentPanelRequest }) {
  return (
    <aside data-testid="agent-panel" data-mode={request.mode}>
      <p>{request.mode === 'draft-po' ? '발주서 초안' : '챗봇'} — 준비 중</p>
    </aside>
  );
}
