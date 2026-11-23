/**
 * 품목 페이지 — 품목 목록 · 검색 · 등록 · 수정(재고 수량은 바꾸지 않음).
 *
 * 하는 일
 * 1. 제목(metadata)을 정하고 본문은 클라이언트 컴포넌트 ItemsView에 맡긴다.
 *    api-client가 브라우저 쿠키 세션으로 부르므로 불러오기 · 저장은 화면 쪽에서 한다.
 * 2. 재고 수량 입력 칸 · 삭제 버튼 · 거래처 마스터는 없다. 내용 · 규칙은 docs/work-units/WU-16-items.md
 *
 * 근거: docs/10-screens 화면 표(docs/wireframes.html 5.4절) · WU-05 · WU-16
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  자리 생성 (WU-05) — 구현은 jkspawn WU-16
 * 2026-11-23  jkspawn  품목 본문(ItemsView) 연결 (WU-16)
 */
import { ItemsView } from '@/components/items/ItemsView';

export const metadata = { title: '품목 · PackFlow' };

/** 품목 화면. testid: items-page */
export default function ItemsPage() {
  return (
    <div data-testid="items-page">
      <ItemsView />
    </div>
  );
}
