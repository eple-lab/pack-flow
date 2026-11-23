/**
 * ChatView 렌더 시험 — 챗봇 대화 · 제안 액션 카드 · 입력 칸의 모양.
 *
 * 하는 일
 * 1. 기대(testid · 문구 · 버튼 상태)를 먼저 적고 renderToString 결과와 비교한다(D-34).
 * 2. LLM 답 속 HTML이 글자로만 나오는지, 카드가 열린 제안에만 보이는지, 빈 메시지에서 보내기 버튼이 잠기는지 본다.
 * 3. 클릭 · 입력 흐름(effect)은 서버 렌더에서 돌지 않으므로 순수 함수 시험(chat-form.test.ts)과 직접 확인으로 나눈다.
 *
 * 근거: docs/work-units/WU-34-chat.md 6 · 7번(testid) · 다 됐다의 기준
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  skygaul  처음 작성 — 챗봇 화면 렌더 시험 (WU-34)
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ChatReply } from '@/types/agent';
import { AgentPanel } from './AgentPanel';
import { ChatContent, type ChatEntry } from './ChatView';

const noop = () => {};

const plain = (html: string) => html.replace(/<!-- -->/g, '');

/** testid 요소의 글자(태그 제거). 없으면 null. */
function textOf(html: string, testid: string): string | null {
  const start = html.indexOf(`data-testid="${testid}"`);
  if (start < 0) return null;
  const open = html.indexOf('>', start);
  const close = html.indexOf('</', open);
  return plain(html.slice(open + 1, close)).replace(/<[^>]*>/g, '');
}

const STOCK_REPLY: ChatReply = {
  reply: '무선 마우스(PRD-001) 재고는 10개예요. 안전재고는 5개예요',
  facts: { 'PRD-001.stock_qty': 10, 'PRD-001.safety_stock': 5 },
  proposed_action: null,
  needs_confirmation: false,
  refused: null,
};

const SHIP_REPLY: ChatReply = {
  reply: '무선 마우스(PRD-001) 4개를 직접출고로 등록하고 바로 출고할까요?',
  facts: { 'PRD-001.stock_qty': 10 },
  proposed_action: { type: 'ship_quantity', sku_id: 'PRD-001', qty: 4 },
  needs_confirmation: true,
  refused: null,
};

const REFUSED: ChatReply = {
  reply: '재고가 부족해요. PRD-003 남은 수량 4개',
  facts: {},
  proposed_action: null,
  needs_confirmation: false,
  refused: { reason: '재고가 부족해요. PRD-003 남은 수량 4개' },
};

function render(entries: ChatEntry[], props: { input?: string; busy?: boolean } = {}) {
  return plain(
    renderToString(
      <ChatContent
        entries={entries}
        input={props.input ?? ''}
        busy={props.busy ?? false}
        onInput={noop}
        onSend={noop}
        onExecute={noop}
        onCancel={noop}
      />,
    ),
  );
}

describe('Q: 챗봇 화면', () => {
  it('Q-1 처음: 입력 칸 · 보내기 버튼(잠김), 대화 없음 안내', () => {
    const html = render([]);
    expect(html).toContain('data-testid="chat-input"');
    expect(html).toMatch(/data-testid="btn-chat-send"[^>]*disabled|disabled[^>]*data-testid="btn-chat-send"/);
    expect(html).not.toContain('data-testid="chat-reply-0"');
    expect(html).toContain('재고');
  });

  it('Q-2 대화: 내 말과 답이 순서대로, 답에는 근거(facts)가 보인다', () => {
    const html = render([
      { kind: 'user', text: 'PRD-001 재고 몇 개야?' },
      { kind: 'reply', reply: STOCK_REPLY, card: 'none' },
    ]);
    expect(html).toContain('PRD-001 재고 몇 개야?');
    expect(textOf(html, 'chat-reply-0')).toContain('재고는 10개예요');
    expect(textOf(html, 'chat-facts-0')).toContain('PRD-001.stock_qty');
    expect(textOf(html, 'chat-facts-0')).toContain('10');
    expect(html).not.toContain('data-testid="chat-action-card"');
  });

  it('Q-3 변경 제안(열림): 카드에 [실행] · [취소]가 보이고, 제안 문장이 보인다', () => {
    const html = render([
      { kind: 'user', text: '마우스 4개 출고해 줘' },
      { kind: 'reply', reply: SHIP_REPLY, card: 'open' },
    ]);
    expect(html).toContain('data-testid="chat-action-card"');
    expect(html).toContain('data-testid="btn-action-execute"');
    expect(html).toContain('data-testid="btn-action-cancel"');
    expect(textOf(html, 'chat-reply-0')).toContain('4개를 직접출고로');
  });

  it('Q-4 (실패해야 함) 카드가 닫힌 제안(실행됨 · 취소됨)에는 버튼이 없다', () => {
    for (const card of ['done', 'cancelled'] as const) {
      const html = render([{ kind: 'reply', reply: SHIP_REPLY, card }]);
      expect(html).not.toContain('data-testid="btn-action-execute"');
      expect(html).not.toContain('data-testid="btn-action-cancel"');
    }
    // 취소했다는 표시가 남는다
    expect(render([{ kind: 'reply', reply: SHIP_REPLY, card: 'cancelled' }])).toContain('취소했어요');
  });

  it('Q-5 거부: 이유가 답으로 보이고 카드는 없다', () => {
    const html = render([{ kind: 'reply', reply: REFUSED, card: 'none' }]);
    expect(textOf(html, 'chat-reply-0')).toBe('재고가 부족해요. PRD-003 남은 수량 4개');
    expect(html).not.toContain('data-testid="chat-action-card"');
  });

  it('Q-6 (실패해야 함) 답 속 HTML · 스크립트는 글자로만 나온다', () => {
    const evil: ChatReply = { ...STOCK_REPLY, reply: '<script>alert(1)</script><b>굵게</b>' };
    const html = render([{ kind: 'reply', reply: evil, card: 'none' }]);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<b>굵게</b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('Q-7 (실패해야 함) 공백만 있으면 보내기 버튼이 잠기고, 글자가 있으면 풀린다. 요청 중에는 다시 잠긴다', () => {
    const locked = /data-testid="btn-chat-send"[^>]*disabled|disabled[^>]*data-testid="btn-chat-send"/;
    expect(render([], { input: '   ' })).toMatch(locked);
    expect(render([], { input: '재고?' })).not.toMatch(locked);
    expect(render([], { input: '재고?', busy: true })).toMatch(locked);
  });

  it('Q-8 실행 결과 알림(note)이 대화에 한 줄로 보인다', () => {
    const html = render([{ kind: 'note', text: 'PRD-001 4개를 출고했어요 (판매 S-301). 남은 재고는 6개예요' }]);
    expect(html).toContain('남은 재고는 6개예요');
  });
});

describe('P: AgentPanel 챗봇 모드', () => {
  it('P-1 chat 모드: 패널 testid · 모드 표시, 챗봇 입력 칸이 있다(준비 중 아님)', () => {
    const html = plain(renderToString(<AgentPanel request={{ mode: 'chat' }} />));
    expect(html).toContain('data-testid="agent-panel"');
    expect(html).toContain('data-mode="chat"');
    expect(html).toContain('data-testid="chat-input"');
    expect(html).not.toContain('준비 중');
  });
});
