/**
 * 성공한 뒤에만 알리는 도우미 시험 — 요청이 성공하면 알림이 한 번, 실패하면 알림이 없다.
 *
 * 하는 일
 * 1. 기대값은 시험 전에 적었다(D-34). 요청이 실패하면 알림이 가면 안 된다(실패해야 하는 경우).
 * 2. 알림은 요청이 끝난 뒤에 가야 한다(대시보드가 옛 값을 다시 불러오지 않게) — 순서를 기록해 확인한다.
 * 3. 화면(DraftPoView · ChatView)의 클릭 흐름은 서버 렌더에서 돌지 않아, 알림 규칙만 이 순수 함수로 시험한다.
 *
 * 근거: GitHub 이슈 #77, docs/work-units/WU-33-draft-po.md · WU-34-chat.md
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-25  skygaul  처음 작성 — 성공 뒤에만 알리기 시험 (#77)
 */
import { describe, expect, it, vi } from 'vitest';
import { thenNotify } from './notify-after';

describe('N: 성공한 뒤에만 알림 (#77)', () => {
  it('N-01 요청이 성공하면 알림이 한 번 가고 결과를 그대로 돌려준다', async () => {
    const notify = vi.fn();
    const value = await thenNotify(async () => ({ purchases: 2 }), notify);
    expect(value).toEqual({ purchases: 2 });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('N-02 (실패해야 함) 요청이 거부되면 알림이 가지 않고 오류는 그대로 던져진다', async () => {
    const notify = vi.fn();
    const failure = new Error('PF_INSUFFICIENT_STOCK');
    await expect(
      thenNotify(async () => {
        throw failure;
      }, notify),
    ).rejects.toBe(failure);
    expect(notify).not.toHaveBeenCalled();
  });

  it('N-03 알림은 요청이 끝난 뒤에 간다(끝나기 전에 가면 대시보드가 옛 값을 받는다)', async () => {
    const order: string[] = [];
    await thenNotify(
      async () => {
        await Promise.resolve();
        order.push('request-done');
      },
      () => order.push('notify'),
    );
    expect(order).toEqual(['request-done', 'notify']);
  });
});
