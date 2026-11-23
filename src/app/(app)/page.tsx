/**
 * 대시보드 페이지 — 재고 현황판(KPI · 품절 임박 · 진행 단계 · 품목별 재고 · 최근 변경).
 *
 * 하는 일
 * 1. 제목(metadata)을 정하고 본문은 클라이언트 컴포넌트 DashboardView에 맡긴다.
 *    api-client가 브라우저 쿠키 세션으로 부르므로 불러오기는 화면 쪽에서 한다.
 * 2. 숫자는 API 값 그대로 보인다(T-S1-3). 내용 · 규칙은 docs/work-units/WU-11-dashboard.md
 *
 * 근거: docs/10-screens 화면 표(docs/wireframes.html) · WU-05 · WU-11
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  자리 생성 (WU-05) — 구현은 jkspawn WU-11
 * 2026-11-23  jkspawn  대시보드 본문(DashboardView) 연결 (WU-11)
 */
import { DashboardView } from '@/components/dashboard/DashboardView';

export const metadata = { title: '대시보드 · PackFlow' };

/** 대시보드 화면. testid: dashboard-page */
export default function DashboardPage() {
  return (
    <div data-testid="dashboard-page">
      <DashboardView />
    </div>
  );
}
