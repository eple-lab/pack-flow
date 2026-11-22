/**
 * 입출고 페이지 자리. 지금은 제목과 준비 중 문구만 있다.
 *
 * 하는 일
 * 1. 자리만 있다. 구매 · 판매 · 일괄 등록 탭은 WU-12 · 13 · 14에서 채운다.
 *
 * 내용 · 규칙은 docs/work-units/WU-12-*.md
 * 근거: docs/10-screens 화면 표(docs/wireframes.html) · WU-05
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  자리 생성 (WU-05) — 구현은 jkspawn WU-12
 */

export const metadata = { title: '입출고 · PackFlow' };

/** 입출고 화면 자리. testid: trades-page */
export default function TradesPage() {
  return (
    <main data-testid="trades-page">
      <h1>입출고</h1>
      <p>준비 중</p>
    </main>
  );
}
