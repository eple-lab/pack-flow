'use client';

/**
 * 재고 이력 화면 본문 — 품목 선택 · 검산 줄(현재 재고 = 이력 합계) · 이력 표 20건씩 · [더 보기].
 *
 * 하는 일
 * 1. 처음 그릴 때 품목 목록(`GET /api/items`)과 이력 첫 페이지(`GET /api/stock-logs?sku_id=&limit=20`)를 불러온다.
 * 2. [더 보기]는 `next_cursor`로 다음 20건을 붙인다. `next_cursor`가 null이면 숨긴다(04 4.5).
 * 3. 품목을 고르면 주소(`?sku_id=`)를 바꾼다 — page.tsx가 주소마다 새로 그린다.
 * 4. 검산 줄: 현재 재고는 품목 목록의 stock_qty(서버 값). 이력 합계는 API가 따로 주지 않아, **이력을 끝까지 불러온 뒤에만**
 *    불러온 행의 change_qty를 더해 보인다(그 전에는 "[더 보기]로 끝까지 불러오면 보여요"). 저장하지 않는 확인용 표시다.
 * 5. 이력 행 수정 · 삭제 버튼은 없다(원장은 추가만).
 *
 * 근거: docs/04-api-contract.md 3.5 · 4.5, docs/wireframes.html 6절, docs/work-units/WU-14-history-cancel.md 1 · 2번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-24  jkspawn  처음 작성 — 이력 불러오기 · 품목 선택 · 더 보기 · 검산 줄 (WU-14)
 */
import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { SubmitButton } from '@/components/common/SubmitButton';
import { api, ApiError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import type { Item, StockLog } from '@/types/erp';
import { LogTable } from './LogTable';
import styles from './history.module.css';

/** 한 번에 불러오는 이력 수(WU-14 1번 · T-S4-2). */
export const LOG_PAGE_SIZE = 20;

/** 이력 화면 주소. 품목이 없으면 전체. */
export function historyUrl(sku_id: string | null): string {
  return sku_id ? `/history?sku_id=${encodeURIComponent(sku_id)}` : '/history';
}

/**
 * 검산 줄 글자. 이력을 끝까지 불러왔을 때만 합계를 보인다.
 * @returns 보일 글자와 일치 여부(합계를 못 보이면 null)
 */
export function checkLine(
  stockQty: number,
  rows: Pick<StockLog, 'change_qty'>[],
  complete: boolean,
): { text: string; match: boolean | null } {
  if (!complete) return { text: `현재 재고 ${formatNumber(stockQty)} · 이력 합계는 [더 보기]로 끝까지 불러오면 보여요`, match: null };
  const total = rows.reduce((sum, row) => sum + row.change_qty, 0);
  return { text: `현재 재고 ${formatNumber(stockQty)} = 이력 합계 ${formatNumber(total)}`, match: total === stockQty };
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; items: Item[]; rows: StockLog[]; nextCursor: string | null };

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('PF_INTERNAL');
}

/**
 * 재고 이력 화면 본문.
 *
 * props
 * - skuId: 주소의 `?sku_id=`(없으면 전체 품목)
 *
 * testid: history-sku-select, history-check, btn-more-logs (표는 LogTable)
 * 부작용: GET /api/items, GET /api/stock-logs
 */
export function HistoryView({ skuId }: { skuId: string | null }) {
  const router = useRouter();
  const id = useId();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [moreError, setMoreError] = useState<ApiError | null>(null);

  useEffect(() => {
    // 응답 콜백 안에서만 setState(effect 본문 동기 setState 금지 — ai-cases 사례 1)
    let current = true;
    Promise.all([api.items(), api.stockLogs({ sku_id: skuId, limit: LOG_PAGE_SIZE })])
      .then(([items, page]) => {
        if (current) setState({ status: 'ready', items, rows: page.rows, nextCursor: page.next_cursor });
      })
      .catch((error: unknown) => {
        if (current) setState({ status: 'error', error: toApiError(error) });
      });
    return () => {
      current = false;
    };
  }, [skuId, attempt]);

  async function loadMore() {
    if (state.status !== 'ready' || !state.nextCursor) return;
    try {
      const page = await api.stockLogs({ sku_id: skuId, limit: LOG_PAGE_SIZE, cursor: state.nextCursor });
      setMoreError(null);
      setState((prev) =>
        prev.status === 'ready' ? { ...prev, rows: [...prev.rows, ...page.rows], nextCursor: page.next_cursor } : prev,
      );
    } catch (error) {
      setMoreError(toApiError(error));
    }
  }

  const item = state.status === 'ready' ? state.items.find((i) => i.sku_id === skuId) ?? null : null;
  const check = state.status === 'ready' && item ? checkLine(item.stock_qty, state.rows, state.nextCursor === null) : null;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>재고 이력</h1>

      <ErrorBanner
        error={state.status === 'error' ? state.error : moreError}
        onRetry={
          state.status === 'error'
            ? () => {
                setState({ status: 'loading' });
                setAttempt((n) => n + 1);
              }
            : () => void loadMore()
        }
      />

      {state.status === 'loading' && <Loading />}

      {state.status === 'ready' && (
        <>
          <div className={styles.bar}>
            <label className={styles.label} htmlFor={`${id}-sku`}>
              품목
            </label>
            <select
              id={`${id}-sku`}
              className={styles.select}
              data-testid="history-sku-select"
              value={skuId ?? ''}
              onChange={(event) => router.push(historyUrl(event.target.value || null))}
            >
              <option value="">전체 품목</option>
              {state.items.map((i) => (
                <option key={i.sku_id} value={i.sku_id}>
                  {i.sku_id} {i.item_name}
                </option>
              ))}
            </select>
            {check && (
              <span className={styles.check} data-testid="history-check">
                {check.text}
                {check.match !== null && (
                  <span className={`${styles.badge} ${check.match ? styles.badgeOk : styles.badgeBad}`}>
                    {check.match ? '일치' : '불일치'}
                  </span>
                )}
              </span>
            )}
          </div>

          <LogTable rows={state.rows} />

          {state.nextCursor && (
            <div className={styles.more}>
              <SubmitButton type="button" testid="btn-more-logs" onClick={loadMore}>
                더 보기
              </SubmitButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}
