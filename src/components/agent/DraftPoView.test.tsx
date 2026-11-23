/**
 * DraftPoView · AgentPanel 렌더 시험 — 발주서 초안 패널의 정상 · LLM 실패 · 후보 없음 · 칸 오류 모양.
 *
 * 하는 일
 * 1. 기대(testid · 문구 · 값)를 먼저 적고 renderToString 결과와 비교한다(D-34).
 * 2. LLM 실패여도 표와 [발주 등록]이 그대로 있는지(P-08), 문안 속 HTML이 글자로만 나오는지 본다.
 * 3. 클릭 · 입력 흐름(effect)은 서버 렌더에서 돌지 않으므로 순수 함수 시험(draft-po-form.test.ts)과 직접 확인으로 나눈다.
 *
 * 근거: docs/work-units/WU-33-draft-po.md 3 · 5번(testid) · docs/04-api-contract.md 3.8 · 4.4
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  skygaul  처음 작성 — 발주서 초안 패널 렌더 시험 (WU-33)
 * 2026-11-23  skygaul  chat 모드가 챗봇 화면이 돼 P-2 기대를 바꿈 (WU-34)
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { messageFor } from '@/lib/api/errors';
import type { PoDraft } from '@/types/agent';
import { AgentPanel } from './AgentPanel';
import { rowsFromDraft } from './draft-po-form';
import { DraftPoContent } from './DraftPoView';

const noop = () => {};

const LINE = {
  sku_id: 'PRD-003',
  item_name: '노트북 거치대',
  stock_qty: 3,
  safety_stock: 4,
  recommended_qty: 6,
  unit_cost: 12000,
  supplier: '가나물산',
  basis: '최근 7일 출고 12개(하루 1.7개), 입고 예정 0개, 안전재고 4개 기준',
};

const DRAFT: PoDraft = { lines: [LINE], message: '안녕하세요.\n노트북 거치대 6개를 요청드립니다.', llm_error: null, provider: 'ollama' };

/** React가 글자 사이에 넣는 `<!-- -->`를 지운다. */
const plain = (html: string) => html.replace(/<!-- -->/g, '');

/** testid 요소의 글자(태그 제거). 없으면 null. */
function textOf(html: string, testid: string): string | null {
  const start = html.indexOf(`data-testid="${testid}"`);
  if (start < 0) return null;
  const open = html.indexOf('>', start);
  const close = html.indexOf('</', open);
  return plain(html.slice(open + 1, close)).replace(/<[^>]*>/g, '');
}

function render(draft: PoDraft, errors = {}) {
  return plain(
    renderToString(
      <DraftPoContent
        draft={draft}
        rows={rowsFromDraft(draft.lines)}
        errors={errors}
        onQty={noop}
        onSupplier={noop}
        onConfirm={noop}
        onCancel={noop}
      />,
    ),
  );
}

describe('V: 발주서 초안 화면', () => {
  it('V-1 정상: 행 · 수정 칸(추천 수량 · 거래처) · 단가 · 예상 금액 · 근거 · 문안 · 버튼 · 시연용 안내', () => {
    const html = render(DRAFT);
    expect(html).toContain('data-testid="draft-row-PRD-003"');
    expect(html).toMatch(/data-testid="draft-qty-PRD-003"[^>]*value="6"|value="6"[^>]*data-testid="draft-qty-PRD-003"/);
    expect(html).toMatch(/value="가나물산"/);
    expect(html).toContain('12,000'); // 단가
    expect(html).toContain('72,000'); // 예상 금액 = 12,000 × 6
    expect(html).toContain(LINE.basis);
    expect(textOf(html, 'draft-message')).toBe(DRAFT.message);
    expect(html).not.toContain('data-testid="draft-llm-error"');
    expect(html).toContain('data-testid="btn-draft-confirm"');
    expect(html).toContain('data-testid="btn-draft-cancel"');
    expect(html).toContain('시연용');
    expect(html).toContain('실제로 발송되지 않아요');
  });

  it('V-2 T-AI-6 LLM 실패: 표 · [발주 등록]은 그대로, 문안 자리에 오류 안내(미리 쓴 문안 없음)', () => {
    const failed: PoDraft = {
      ...DRAFT,
      message: null,
      llm_error: { code: 'PF_LLM_UNAVAILABLE', message: messageFor('PF_LLM_UNAVAILABLE') },
    };
    const html = render(failed);
    const error = textOf(html, 'draft-llm-error') ?? '';
    expect(error).toContain('AI 문안을 만들지 못했어요');
    expect(error).toContain('아래 계산 결과로 직접 발주할 수 있어요');
    expect(error).toContain(messageFor('PF_LLM_UNAVAILABLE'));
    expect(html).not.toContain('data-testid="draft-message"');
    expect(html).toContain('data-testid="draft-row-PRD-003"');
    expect(html).toContain('data-testid="btn-draft-confirm"');
  });

  it('V-3 (실패해야 함) 후보가 없으면 안내만 보이고 표 · 버튼이 없다', () => {
    const html = render({ lines: [], message: null, llm_error: null, provider: 'ollama' });
    expect(textOf(html, 'draft-empty')).toBe('지금 발주할 품목이 없어요');
    expect(html).not.toContain('data-testid="btn-draft-confirm"');
    expect(html).not.toContain('data-testid="draft-row-');
  });

  it('V-4 수량 칸 아래 오류: 04 4.3 범위 문구, testid field-error-draft-qty-<sku>', () => {
    const html = render(DRAFT, { 'PRD-003': { field: 'order_qty', detail: { reason: 'out_of_range', min: 1, max: 100000 } } });
    expect(textOf(html, 'field-error-draft-qty-PRD-003')).toBe('1 ~ 100,000 사이로 입력해 주세요');
  });

  it('V-5 거래처 칸 아래 오류', () => {
    const html = render(DRAFT, { 'PRD-003': { field: 'supplier', detail: { reason: 'required' } } });
    expect(html).toContain('data-testid="field-error-draft-supplier-PRD-003"');
  });

  it('V-6 (실패해야 함) 문안 속 HTML · 스크립트는 글자로만 나온다', () => {
    const html = render({ ...DRAFT, message: '<script>alert(1)</script><b>굵게</b>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<b>굵게</b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('P: AgentPanel', () => {
  it('P-1 draft-po 모드: 패널 testid · 모드 표시, 처음엔 불러오는 중', () => {
    const html = plain(renderToString(<AgentPanel request={{ mode: 'draft-po', sku_ids: ['PRD-003'] }} />));
    expect(html).toContain('data-testid="agent-panel"');
    expect(html).toContain('data-mode="draft-po"');
    expect(html).toContain('발주서 초안');
    expect(html).toContain('data-testid="loading"');
  });

  it('P-2 chat 모드는 챗봇 화면(WU-34): 입력 칸이 있고 준비 중이 아니다', () => {
    const html = plain(renderToString(<AgentPanel request={{ mode: 'chat' }} />));
    expect(html).toContain('data-mode="chat"');
    expect(html).toContain('data-testid="chat-input"');
    expect(html).not.toContain('준비 중');
  });
});
