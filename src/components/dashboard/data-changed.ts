/**
 * 데이터 변경 알림 — 같은 화면의 다른 곳(에이전트 패널 등)이 재고 · 구매 · 판매를 바꾼 뒤 대시보드가 다시 불러오게 한다.
 *
 * 하는 일
 * 1. 바꾼 쪽은 성공한 뒤 notifyDataChanged()를 한 번 부른다(브라우저 이벤트 `packflow:data-changed`).
 * 2. 대시보드는 onDataChanged()로 구독해 이벤트가 오면 다시 불러온다. 돌려받은 함수로 구독을 끊는다.
 * 3. 값은 싣지 않는다 — 받는 쪽은 서버에서 다시 받아 그린다(계산은 서버, 원칙 1).
 *
 * 왜: 에이전트 패널은 레이아웃(AgentSlot)에 붙어 대시보드와 같은 화면에 떠 있어서, 발주 확정 · [실행] 뒤에도
 *     대시보드가 처음 불러온 값을 그대로 보였다(#77). 창 focus로는 알 수 없어 명시적인 알림이 필요하다.
 *
 * 근거: GitHub 이슈 #77
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-25  jkspawn  처음 작성 — 데이터 변경 알림 · 구독 (#77)
 */

/** 브라우저 이벤트 이름. 보내는 쪽과 받는 쪽이 이 상수만 쓴다. */
export const DATA_CHANGED_EVENT = 'packflow:data-changed';

/**
 * 데이터가 바뀌었다고 알린다. 저장 요청이 **성공한 뒤에만** 부른다.
 *
 * - target: 시험용. 기본은 window
 * 부작용: target에 `packflow:data-changed` 이벤트를 보낸다
 */
export function notifyDataChanged(target: EventTarget = window): void {
  target.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}

/**
 * 데이터 변경 알림을 구독한다.
 *
 * - handler: 알림이 올 때마다 불릴 함수
 * - target: 시험용. 기본은 window
 * 반환: 구독을 끊는 함수(effect 정리에서 부른다)
 */
export function onDataChanged(handler: () => void, target: EventTarget = window): () => void {
  target.addEventListener(DATA_CHANGED_EVENT, handler);
  return () => target.removeEventListener(DATA_CHANGED_EVENT, handler);
}
