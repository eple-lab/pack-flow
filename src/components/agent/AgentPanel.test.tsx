/**
 * AgentPanel 렌더 시험 — 탭 두 개(발주 초안 · 대화)의 처음 모양과 숨김 처리.
 *
 * 하는 일
 * 1. 기대(testid · 선택 상태 · 어느 화면을 그렸는지)를 먼저 적고 renderToString 결과와 비교한다(D-34).
 * 2. 안 연 탭은 그리지 않아(초안은 그리는 순간 LLM을 부른다) 챗봇으로 열었을 때 초안 요청이 나가지 않는지 본다.
 * 3. 탭을 누르는 흐름(상태 변경)은 서버 렌더에서 돌지 않으므로 순수 함수 시험(agent-tabs.test.ts)과 브라우저 확인으로 나눈다.
 *
 * 근거: docs/wireframes.html 7절, docs/work-units/WU-34-chat.md
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  skygaul  처음 작성 — 패널 탭 렌더 시험 (WU-34)
 * 2026-11-23  skygaul  탭 이름을 와이어프레임대로 확인하는 A-5 추가 (WU-34)
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AgentPanel, AgentPanelTabs } from './AgentPanel';

const plain = (html: string) => html.replace(/<!-- -->/g, '');

/** 태그 한 줄(시작 태그)을 testid로 찾는다. 없으면 null. */
function tagOf(html: string, testid: string): string | null {
  const at = html.indexOf(`data-testid="${testid}"`);
  if (at < 0) return null;
  const start = html.lastIndexOf('<', at);
  return html.slice(start, html.indexOf('>', at) + 1);
}

describe('A: 에이전트 패널 탭', () => {
  it('A-1 발주 초안으로 열면: 탭 두 개, 초안 탭이 선택됨, 초안만 그리고 챗봇은 아직 안 그림', () => {
    const html = plain(renderToString(<AgentPanel request={{ mode: 'draft-po', sku_ids: ['PRD-003'] }} />));
    expect(html).toContain('role="tablist"');
    expect(tagOf(html, 'agent-tab-draft-po')).toContain('aria-selected="true"');
    expect(tagOf(html, 'agent-tab-chat')).toContain('aria-selected="false"');
    expect(html).toContain('data-mode="draft-po"');
    expect(html).toContain('data-testid="loading"'); // 초안 불러오는 중
    expect(html).not.toContain('data-testid="chat-input"');
  });

  it('A-2 챗봇으로 열면: 대화 탭이 선택됨, 챗봇 입력 칸이 있고 초안은 그리지 않음(LLM 요청이 안 나간다)', () => {
    const html = plain(renderToString(<AgentPanel request={{ mode: 'chat' }} />));
    expect(tagOf(html, 'agent-tab-chat')).toContain('aria-selected="true"');
    expect(tagOf(html, 'agent-tab-draft-po')).toContain('aria-selected="false"');
    expect(html).toContain('data-mode="chat"');
    expect(html).toContain('data-testid="chat-input"');
    expect(html).not.toContain('data-testid="loading"');
    expect(html).not.toContain('data-testid="draft-row-');
  });

  it('A-3 두 탭을 다 연 상태: 선택된 쪽만 보이고 다른 쪽은 hidden(다시 그리지 않고 유지)', () => {
    const html = plain(
      renderToString(<AgentPanelTabs state={{ mode: 'chat', visited: ['draft-po', 'chat'] }} skuIds={undefined} onSelect={() => {}} />),
    );
    expect(tagOf(html, 'agent-pane-draft-po')).toMatch(/\shidden(=""|\s|>)/);
    expect(tagOf(html, 'agent-pane-chat')).not.toMatch(/\shidden(=""|\s|>)/);
    // 숨겨도 이미 연 초안 화면은 그대로 들어 있다(불러오는 중 표시가 남아 있음)
    expect(html).toContain('data-testid="loading"');
    expect(html).toContain('data-testid="chat-input"');
  });

  it('A-5 탭 이름은 와이어프레임 7절대로 "발주 초안" · "대화"', () => {
    const html = plain(renderToString(<AgentPanel request={{ mode: 'draft-po' }} />));
    const tab = (testid: string) => {
      const at = html.indexOf(`data-testid="${testid}"`);
      const open = html.indexOf('>', at);
      return html.slice(open + 1, html.indexOf('</button>', open));
    };
    expect(tab('agent-tab-draft-po')).toBe('발주 초안');
    expect(tab('agent-tab-chat')).toBe('대화');
  });

  it('A-4 탭 버튼은 role="tab"이고 눌러서 전환한다(button 요소, 탭 목록 안)', () => {
    const html = plain(renderToString(<AgentPanel request={{ mode: 'chat' }} />));
    expect(tagOf(html, 'agent-tab-chat')).toMatch(/^<button[^>]*role="tab"/);
    expect(tagOf(html, 'agent-tab-draft-po')).toMatch(/^<button[^>]*type="button"/);
  });
});
