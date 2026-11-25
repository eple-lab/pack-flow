/**
 * 성공한 뒤에만 알리기 — 저장 요청이 끝난 다음에 "데이터가 바뀌었다"고 알린다(대시보드가 다시 불러오게).
 *
 * 하는 일
 * 1. run()이 성공하면 그 결과를 돌려주기 전에 notify()를 한 번 부른다.
 * 2. run()이 실패하면 notify()를 부르지 않고 오류를 그대로 던진다(바뀐 것이 없으므로 알릴 이유가 없다).
 *
 * 왜: 발주 확정 · 챗봇 [실행]이 성공해도 열려 있는 대시보드가 처음 불러온 값을 그대로 보였다(#77).
 *     알림 규칙(성공 뒤에만, 요청이 끝난 뒤에)을 화면 코드에서 떼어 내 시험할 수 있게 했다.
 *
 * 근거: GitHub 이슈 #77, src/components/dashboard/data-changed.ts(받는 쪽)
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-25  skygaul  처음 작성 — 성공한 뒤에만 알리기 (#77)
 */

/**
 * run()을 실행하고, 성공했을 때만 notify()를 부른 뒤 결과를 돌려준다.
 *
 * - run: 저장 요청(예: api.confirmPo, api.executeAction)
 * - notify: 알림 함수(예: notifyDataChanged)
 * 던지는 것: run()이 던진 오류를 그대로(알림 없음)
 */
export async function thenNotify<T>(run: () => Promise<T>, notify: () => void): Promise<T> {
  const value = await run();
  notify();
  return value;
}
