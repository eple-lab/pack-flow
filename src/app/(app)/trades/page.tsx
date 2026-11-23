/**
 * 입출고 페이지 — 구매 · 입고 / 판매 · 출고 탭(등록 폼 · 표 · 입고 확정 · 출고).
 *
 * 하는 일
 * 1. 주소 `?tab=purchase|sale&status=...`를 읽어(parseTradesQuery) 본문 TradesView에 넘긴다.
 *    대시보드 파이프라인은 `?status=`만 보내므로 상태로 탭을 고른다.
 * 2. 주소가 바뀌면 key로 본문을 새로 그린다(탭 · 필터마다 목록을 다시 불러온다).
 * 3. 불러오기 · 작업은 api-client가 브라우저 쿠키 세션으로 하므로 TradesView(클라이언트)가 한다.
 *
 * 내용 · 규칙은 docs/work-units/WU-12-trades.md
 * 근거: docs/10-screens 화면 표(docs/wireframes.html) · WU-05 · WU-12
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  자리 생성 (WU-05) — 구현은 jkspawn WU-12
 * 2026-11-23  jkspawn  탭 · 상태 쿼리 읽기 · 본문(TradesView) 연결 (WU-12)
 */
import { parseTradesQuery } from '@/components/trades/query';
import { TradesView } from '@/components/trades/TradesView';

export const metadata = { title: '입출고 · PackFlow' };

/** 입출고 화면. testid: trades-page */
export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = parseTradesQuery(await searchParams);
  return (
    <div data-testid="trades-page">
      <TradesView key={`${query.tab}|${query.status ?? ''}`} query={query} />
    </div>
  );
}
