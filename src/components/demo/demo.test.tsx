/**
 * 시연 데이터 초기화 버튼 시험 — 버튼 testid, 처음엔 확인 창이 닫혀 있음, demo 시드 · 확인 문구.
 *
 * 하는 일
 * 1. 기대값은 시험 전에 적었다(D-34). 누르기 전에 요청 · 확인 창이 없어야 한다(실패해야 하는 경우).
 * 2. 클릭 → 확인 → 요청 → 새로고침은 서버 렌더로 못 본다(브라우저 확인).
 *
 * 근거: docs/work-units/WU-15-demo-polish.md 1번, docs/04-api-contract.md 3.7
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-24  jkspawn  처음 작성 — 초기화 버튼 시험 (WU-15)
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEMO_DATASET, SEED_CONFIRM_MESSAGE, SeedResetButton } from './SeedResetButton';

// useRouter는 앱 라우터 안에서만 쓸 수 있어 서버 렌더 시험에서는 가짜로 바꾼다
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

describe('R: 시연 데이터 초기화 버튼', () => {
  it('R-01 버튼 testid · 글자가 있다', () => {
    const html = renderToString(<SeedResetButton />);
    expect(html).toContain('data-testid="btn-seed-reset"');
    expect(html).toContain('시연 데이터 초기화');
  });
  it('R-02 (실패해야 함) 누르기 전에는 확인 창 · 오류 상자가 없다', () => {
    const html = renderToString(<SeedResetButton />);
    expect(html).not.toContain('confirm-dialog');
    expect(html).not.toContain('error-banner');
  });
  it('R-03 초기화는 demo 시드, 확인 문구는 지워지는 것과 되돌릴 수 없음을 말한다', () => {
    expect(DEMO_DATASET).toBe('demo');
    expect(SEED_CONFIRM_MESSAGE).toContain('모두 지우고');
    expect(SEED_CONFIRM_MESSAGE).toContain('되돌릴 수 없어요');
  });
});
