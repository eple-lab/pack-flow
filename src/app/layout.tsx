/**
 * 앱 전체의 뿌리 레이아웃 (html · body · 전역 스타일).
 *
 * 하는 일
 * 1. 한국어 문서(lang="ko")와 제목을 정한다.
 * 2. 색 · 간격 토큰(src/styles/tokens.css)과 전역 스타일(globals.css)을 한 번 불러온다. 토큰이 먼저다.
 * 3. 로그인 뒤 화면의 틀(상단 바 · 내비 · 에이전트 자리)은 src/app/(app)/layout.tsx가 맡는다.
 *
 * 근거: WU-01 · docs/06-work-plan.md 1절 '앱 뼈대'
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  처음 작성 — create-next-app 기본에서 웹 글꼴 · 영어 제목 제거 (WU-01)
 * 2026-11-23  eple  디자인 토큰(tokens.css) 불러오기 추가 (WU-05)
 */
import type { Metadata } from 'next';
import '@/styles/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'PackFlow',
  description: '구매 → 입고 → 재고 → 출고를 한 화면에서 — 소규모 판매자용 미니 ERP',
};

/** 모든 페이지를 감싸는 html · body. */
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
