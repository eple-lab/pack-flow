/**
 * open.ts 단위 테스트 — openAgentPanel이 구독자에게 mode · sku_ids를 전달하는지.
 *
 * 하는 일: 기대(구독자가 받은 값)를 먼저 적고 비교한다.
 *
 * 근거: WU-04 4번 (O 기준)
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — openAgentPanel 시험 (WU-04)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLastAgentRequest, openAgentPanel, resetAgentPanelForTest, subscribeAgentPanel } from './open';

describe('O: openAgentPanel', () => {
  beforeEach(() => resetAgentPanelForTest());

  it('O-1 구독자가 mode · sku_ids를 받는다', () => {
    const listener = vi.fn();
    subscribeAgentPanel(listener);
    openAgentPanel({ mode: 'draft-po', sku_ids: ['PRD-003'] });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ mode: 'draft-po', sku_ids: ['PRD-003'] });
  });

  it('O-2 chat은 sku_ids 없이 열린다', () => {
    const listener = vi.fn();
    subscribeAgentPanel(listener);
    openAgentPanel({ mode: 'chat' });
    expect(listener).toHaveBeenCalledWith({ mode: 'chat' });
  });

  it('O-3 구독자가 여럿이면 모두 받고, 해제한 구독자는 받지 않는다', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribeA = subscribeAgentPanel(a);
    subscribeAgentPanel(b);
    unsubscribeA();
    openAgentPanel({ mode: 'chat' });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('O-4 패널이 마운트되기 전에 불려도 마지막 요청을 나중에 읽을 수 있다', () => {
    expect(getLastAgentRequest()).toBeNull();
    openAgentPanel({ mode: 'draft-po' });
    expect(getLastAgentRequest()).toEqual({ mode: 'draft-po' });
  });

  it('O-5 넘긴 배열을 나중에 바꿔도 저장된 요청은 안 바뀐다(복사)', () => {
    const ids = ['PRD-001'];
    openAgentPanel({ mode: 'draft-po', sku_ids: ids });
    ids.push('PRD-002');
    expect(getLastAgentRequest()?.sku_ids).toEqual(['PRD-001']);
  });

  it('O-6 구독자가 던져도 다른 구독자 호출은 막지 않는다는 보장은 하지 않는다 — 대신 구독 중 해제해도 안전하다', () => {
    const second = vi.fn();
    const unsubscribe = subscribeAgentPanel(() => unsubscribe());
    subscribeAgentPanel(second);
    expect(() => openAgentPanel({ mode: 'chat' })).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
