/**
 * agent-tabs.ts 단위 테스트 — 에이전트 패널의 탭(발주 초안 · 대화) 상태.
 *
 * 하는 일
 * 1. 기대 결과(열린 탭 · 한 번이라도 연 탭)를 먼저 적고 비교한다(D-34).
 * 2. 한 번 연 탭은 유지되고(다시 그리지 않음 — 초안은 열 때마다 LLM을 부르므로), 안 연 탭은 그리지 않는다.
 *
 * 근거: docs/wireframes.html 7절(탭 두 개: 발주 초안 · 대화), docs/work-units/WU-34-chat.md
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  skygaul  처음 작성 — 패널 탭 상태 시험 (WU-34)
 */
import { describe, expect, it } from 'vitest';
import { initialTabState, selectTab, tabsKey } from './agent-tabs';

describe('T: 패널 탭 상태', () => {
  it('T-1 열린 모드가 처음 탭이고, 그 탭만 한 번 연 것으로 센다', () => {
    expect(initialTabState('draft-po')).toEqual({ mode: 'draft-po', visited: ['draft-po'] });
    expect(initialTabState('chat')).toEqual({ mode: 'chat', visited: ['chat'] });
  });

  it('T-2 다른 탭을 누르면 그 탭으로 바뀌고 한 번 연 탭에 더해진다(순서 유지)', () => {
    const state = selectTab(initialTabState('draft-po'), 'chat');
    expect(state).toEqual({ mode: 'chat', visited: ['draft-po', 'chat'] });
  });

  it('T-3 이미 연 탭으로 돌아가도 목록이 늘지 않는다 · 같은 탭을 또 눌러도 그대로', () => {
    const both = selectTab(initialTabState('draft-po'), 'chat');
    const back = selectTab(both, 'draft-po');
    expect(back).toEqual({ mode: 'draft-po', visited: ['draft-po', 'chat'] });
    expect(selectTab(back, 'draft-po')).toEqual(back);
  });

  it('T-4 (실패해야 함) 모르는 탭 이름은 무시하고 상태를 그대로 둔다', () => {
    const state = initialTabState('chat');
    expect(selectTab(state, 'delete-all' as never)).toEqual(state);
  });

  it('T-5 요청이 달라지면 다른 키(패널을 새로 그린다), 같은 요청이면 같은 키', () => {
    expect(tabsKey({ mode: 'draft-po', sku_ids: ['PRD-003'] })).toBe(tabsKey({ mode: 'draft-po', sku_ids: ['PRD-003'] }));
    expect(tabsKey({ mode: 'draft-po', sku_ids: ['PRD-003'] })).not.toBe(tabsKey({ mode: 'draft-po', sku_ids: ['PRD-001'] }));
    expect(tabsKey({ mode: 'draft-po' })).not.toBe(tabsKey({ mode: 'chat' }));
  });
});
