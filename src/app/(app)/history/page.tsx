/**
 * 재고 이력 페이지 — 품목별 재고 변동(최근순 20건씩, 취소는 반대 기록으로 남음).
 *
 * 하는 일
 * 1. 주소 `?sku_id=`를 읽어 본문 HistoryView에 넘긴다(대시보드 · 품목 화면의 [이력] 링크가 이 주소로 온다).
 * 2. 품목이 바뀌면 key로 본문을 새로 그린다(첫 페이지부터 다시 불러온다).
 * 3. 불러오기는 api-client가 브라우저 쿠키 세션으로 하므로 HistoryView(클라이언트)가 한다.
 *
 * 내용 · 규칙은 docs/work-units/WU-14-history-cancel.md
 * 근거: docs/10-screens 화면 표(docs/wireframes.html 6절) · WU-05 · WU-14
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  자리 생성 (WU-05) — 구현은 jkspawn WU-14
 * 2026-11-24  jkspawn  `?sku_id=` 읽기 · 본문(HistoryView) 연결 (WU-14)
 */
import { HistoryView } from '@/components/history/HistoryView';

export const metadata = { title: '이력 · PackFlow' };

/** 첫 값만, 공백 제거, 빈 값이면 null. */
function firstParam(value: string | string[] | undefined): string | null {
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === 'string' && text.trim() !== '' ? text.trim() : null;
}

/** 재고 이력 화면. testid: history-page */
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const skuId = firstParam((await searchParams).sku_id);
  return (
    <div data-testid="history-page">
      <HistoryView key={skuId ?? 'all'} skuId={skuId} />
    </div>
  );
}
