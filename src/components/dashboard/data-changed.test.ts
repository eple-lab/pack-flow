/**
 * 데이터 변경 알림 시험 — 알리면 받는 쪽이 한 번 불리고, 구독을 끊으면 안 불린다.
 *
 * 하는 일
 * 1. 기대값은 시험 전에 적었다(D-34). 다른 이름의 이벤트 · 구독을 끊은 뒤에는 불리지 않아야 한다(실패해야 하는 경우).
 * 2. window 대신 새 EventTarget을 넘겨 node 환경에서 돌린다.
 *
 * 근거: GitHub 이슈 #77, docs/work-units/WU-11-dashboard.md
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-25  jkspawn  처음 작성 — 데이터 변경 알림 · 구독 시험 (#77)
 */
import { describe, expect, it, vi } from 'vitest';
import { DATA_CHANGED_EVENT, notifyDataChanged, onDataChanged } from './data-changed';

describe('E: 데이터 변경 알림 (#77)', () => {
  it('E-01 알리면 구독한 처리기가 한 번 불린다', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    onDataChanged(handler, target);
    notifyDataChanged(target);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('E-02 (실패해야 함) 구독을 끊은 뒤에는 불리지 않는다', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    const unsubscribe = onDataChanged(handler, target);
    unsubscribe();
    notifyDataChanged(target);
    expect(handler).not.toHaveBeenCalled();
  });

  it('E-03 (실패해야 함) 다른 이름의 이벤트에는 불리지 않는다', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    onDataChanged(handler, target);
    target.dispatchEvent(new Event('packflow:other'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('E-04 이벤트 이름은 packflow:data-changed — 보내는 쪽(에이전트 패널)과 같은 이름', () => {
    expect(DATA_CHANGED_EVENT).toBe('packflow:data-changed');
  });
});
