/**
 * 대시보드 페이지 자리. 지금은 제목과 준비 중 문구만 있다.
 *
 * 하는 일
 * 1. 자리만 있다. 실제 KPI · 알림 카드는 WU-11에서 채운다.
 *
 * 내용 · 규칙은 docs/work-units/WU-11-*.md
 * 근거: docs/10-screens 화면 표(docs/wireframes.html) · WU-05
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  자리 생성 (WU-05) — 구현은 jkspawn WU-11
 */

export const metadata = { title: '대시보드 · PackFlow' };

/** 대시보드 화면 자리. testid: dashboard-page */
export default function DashboardPage() {
  return (
    <main data-testid="dashboard-page">
      <h1>대시보드</h1>
      <p>준비 중</p>
    </main>
  );
}
