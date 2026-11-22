/**
 * 공통 조각 · AgentSlot 렌더 시험 — react-dom/server renderToString으로 testid · 문구를 확인한다(새 패키지 없이).
 *
 * 하는 일
 * 1. P: 공통 조각 7종(ConfirmDialog · Toast · ErrorBanner · FieldError · SubmitButton · Loading · EmptyState)이
 *    기대한 testid · 문구 · 잠금 상태로 그려지는지 본다.
 * 2. O: openAgentPanel({mode:'chat'})를 부르면 AgentSlot이 패널을 그리고, 부르기 전에는 아무것도 그리지 않는다.
 * 한계: 클릭 · 타이머 · 포커스 같은 브라우저 동작은 서버 렌더로 못 본다(E2E에서 본다).
 *
 * 근거: docs/04-api-contract.md 4.3 · 4.4 · 4.6, docs/wireframes.html 8절, WU-05 (P · O 기준)
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 공통 조각 렌더 · AgentSlot 시험 (WU-05)
 */
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentSlot } from '@/components/layout/AgentSlot';
import { isActivePath, NAV_ITEMS } from '@/components/layout/NavBar';
import { openAgentPanel, resetAgentPanelForTest } from '@/components/agent/open';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { ErrorBanner } from './ErrorBanner';
import { FieldError } from './FieldError';
import { Loading } from './Loading';
import { SubmitButton } from './SubmitButton';
import { ToastProvider, useToast } from './Toast';

const noop = () => {};

describe('P: ErrorBanner', () => {
  it('P-1 error가 없으면 아무것도 그리지 않는다', () => {
    expect(renderToString(<ErrorBanner error={null} />)).toBe('');
    expect(renderToString(<ErrorBanner error={undefined} />)).toBe('');
  });
  it('P-2 message를 error-banner에 보인다(재고 부족 문구에 남은 수량이 들어 있다)', () => {
    const html = renderToString(<ErrorBanner error={{ code: 'PF_INSUFFICIENT_STOCK', message: '재고가 부족해요. PRD-001 남은 수량 4개' }} />);
    expect(html).toContain('data-testid="error-banner"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('재고가 부족해요. PRD-001 남은 수량 4개');
    expect(html).not.toContain('error-banner-retry');
  });
  it('P-3 PF_NETWORK · PF_TIMEOUT이고 onRetry가 있으면 [다시 시도]', () => {
    for (const code of ['PF_NETWORK', 'PF_TIMEOUT'] as const) {
      const html = renderToString(<ErrorBanner error={{ code, message: 'x' }} onRetry={noop} />);
      expect(html).toContain('data-testid="error-banner-retry"');
      expect(html).toContain('다시 시도');
    }
  });
  it('P-4 onRetry가 없거나 다른 코드면 [다시 시도]가 없다', () => {
    expect(renderToString(<ErrorBanner error={{ code: 'PF_NETWORK', message: 'x' }} />)).not.toContain('error-banner-retry');
    expect(renderToString(<ErrorBanner error={{ code: 'PF_NOT_FOUND', message: 'x' }} onRetry={noop} />)).not.toContain('error-banner-retry');
  });
  it('P-5 message는 글자로만 그려진다(HTML이 들어 있어도 태그가 되지 않는다)', () => {
    const html = renderToString(<ErrorBanner error={{ code: 'PF_INTERNAL', message: '<img src=x onerror=alert(1)>' }} />);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

describe('P: FieldError', () => {
  it('P-6 detail의 reason을 04 4.3 문구로, testid는 field-error-<필드>', () => {
    const html = renderToString(<FieldError field="sold_qty" detail={{ reason: 'out_of_range', min: 1, max: 100000 }} />);
    expect(html).toContain('data-testid="field-error-sold_qty"');
    expect(html).toContain('1 ~ 100,000 사이로 입력해 주세요');
  });
  it('P-7 message를 직접 줄 수 있고, 둘 다 없으면 그리지 않는다', () => {
    expect(renderToString(<FieldError field="x" message="직접 문구" />)).toContain('직접 문구');
    expect(renderToString(<FieldError field="x" />)).toBe('');
    expect(renderToString(<FieldError field="x" detail={null} message={null} />)).toBe('');
  });
  it('P-8 required는 "필수 항목이에요"', () => {
    expect(renderToString(<FieldError field="sku_id" detail={{ reason: 'required' }} />)).toContain('필수 항목이에요');
  });
});

describe('P: Loading · EmptyState', () => {
  it('P-9 Loading은 role=status, 기본 문구', () => {
    const html = renderToString(<Loading />);
    expect(html).toContain('data-testid="loading"');
    expect(html).toContain('role="status"');
    expect(html).toContain('불러오는 중…');
    expect(renderToString(<Loading label="저장 중" />)).toContain('저장 중');
  });
  it('P-10 EmptyState: 제목과 행동 버튼(둘 다 있을 때만)', () => {
    const withAction = renderToString(<EmptyState title="아직 품목이 없어요" actionLabel="시연 데이터 초기화" onAction={noop} />);
    expect(withAction).toContain('data-testid="empty-state"');
    expect(withAction).toContain('아직 품목이 없어요');
    expect(withAction).toContain('data-testid="empty-state-action"');
    expect(withAction).toContain('시연 데이터 초기화');
    const without = renderToString(<EmptyState title="결과 없음" testid="my-empty" />);
    expect(without).toContain('data-testid="my-empty"');
    expect(without).not.toContain('empty-state-action');
    expect(renderToString(<EmptyState title="x" actionLabel="행동" />)).not.toContain('empty-state-action');
  });
});

describe('P: SubmitButton', () => {
  it('P-11 평소에는 눌릴 수 있고 children을 보인다', () => {
    const html = renderToString(<SubmitButton testid="btn-save">저장</SubmitButton>);
    expect(html).toContain('data-testid="btn-save"');
    expect(html).toContain('저장');
    expect(html).not.toContain('disabled');
  });
  it('P-12 pending이면 잠기고(disabled · aria-busy) "처리 중…"', () => {
    const html = renderToString(<SubmitButton pending>저장</SubmitButton>);
    expect(html).toContain('disabled');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('처리 중…');
    expect(html).not.toContain('>저장<');
  });
  it('P-13 pendingText를 바꿀 수 있고, disabled만 주면 글자는 그대로', () => {
    expect(renderToString(<SubmitButton pending pendingText="출고 중…">출고</SubmitButton>)).toContain('출고 중…');
    const html = renderToString(<SubmitButton disabled>저장</SubmitButton>);
    expect(html).toContain('disabled');
    expect(html).toContain('저장');
  });
});

describe('P: ConfirmDialog', () => {
  it('P-14 닫혀 있으면 그리지 않는다', () => {
    expect(renderToString(<ConfirmDialog open={false} message="m" onConfirm={noop} onCancel={noop} />)).toBe('');
  });
  it('P-15 열리면 문장 · 취소 · 확인 버튼(testid)이 있다', () => {
    const html = renderToString(
      <ConfirmDialog open message="출고를 취소하면 재고가 6개 돌아오고, 기록은 남아요" onConfirm={noop} onCancel={noop} />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('data-testid="confirm-dialog"');
    expect(html).toContain('출고를 취소하면 재고가 6개 돌아오고, 기록은 남아요');
    expect(html).toContain('data-testid="confirm-ok"');
    expect(html).toContain('data-testid="confirm-cancel"');
  });
  it('P-16 pending이면 확인 버튼이 잠기고 "처리 중…", 라벨을 바꿀 수 있다', () => {
    const pending = renderToString(<ConfirmDialog open pending message="m" onConfirm={noop} onCancel={noop} />);
    expect(pending).toContain('처리 중…');
    const labeled = renderToString(<ConfirmDialog open message="m" confirmLabel="초기화" cancelLabel="그만두기" onConfirm={noop} onCancel={noop} />);
    expect(labeled).toContain('초기화');
    expect(labeled).toContain('그만두기');
  });
});

describe('P: Toast', () => {
  it('P-17 Provider는 children을 그리고 처음에는 toast가 없다', () => {
    const html = renderToString(
      <ToastProvider>
        <p>본문</p>
      </ToastProvider>,
    );
    expect(html).toContain('본문');
    expect(html).not.toContain('data-testid="toast"');
  });
  it('P-18 Provider 밖에서 useToast().show를 불러도 오류가 없다', () => {
    let shown: (() => void) | null = null;
    function Probe() {
      const toast = useToast();
      shown = () => toast.show('x');
      return null;
    }
    renderToString(<Probe />);
    expect(() => shown?.()).not.toThrow();
  });
});

describe('O: AgentSlot', () => {
  beforeEach(() => resetAgentPanelForTest());

  it('O-1 닫힘이 기본: 요청이 없으면 아무것도 그리지 않는다', () => {
    expect(renderToString(<AgentSlot />)).toBe('');
  });
  it("O-2 openAgentPanel({mode:'chat'}) 뒤에는 빈 패널(agent-panel)과 [닫기]를 그린다", () => {
    openAgentPanel({ mode: 'chat' });
    const html = renderToString(<AgentSlot />);
    expect(html).toContain('data-testid="agent-slot"');
    expect(html).toContain('data-testid="agent-panel"');
    expect(html).toContain('data-mode="chat"');
    expect(html).toContain('data-testid="agent-close"');
  });
  it('O-3 draft-po 모드로 열면 패널이 그 모드를 받는다', () => {
    openAgentPanel({ mode: 'draft-po', sku_ids: ['PRD-003'] });
    expect(renderToString(<AgentSlot />)).toContain('data-mode="draft-po"');
  });
});

describe('내비', () => {
  it('N-1 항목 4개(대시보드 · 입출고 · 이력 · 품목)와 경로', () => {
    expect(NAV_ITEMS.map((i) => [i.label, i.href])).toEqual([
      ['대시보드', '/'],
      ['입출고', '/trades'],
      ['이력', '/history'],
      ['품목', '/items'],
    ]);
  });
  it('N-2 활성 판정: 홈은 정확히 /만, 나머지는 그 아래까지', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/trades', '/')).toBe(false);
    expect(isActivePath('/trades', '/trades')).toBe(true);
    expect(isActivePath('/trades/x', '/trades')).toBe(true);
    expect(isActivePath('/tradesx', '/trades')).toBe(false);
  });
});

describe('G: 브라우저 기본 대화상자 호출 없음', () => {
  it('G-1 이 테스트가 vi를 쓰는 이유: window.alert가 불리면 실패하도록 감시한다', () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    renderToString(<ConfirmDialog open message="m" onConfirm={noop} onCancel={noop} />);
    expect(alertSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
