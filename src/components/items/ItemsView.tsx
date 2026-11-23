'use client';

/**
 * 품목 화면 본문 — 검색 · 등록 폼 · 목록 표 · 수정 창 · 오류 배너 · 알림.
 *
 * 하는 일
 * 1. 처음 그릴 때 api.items()로 목록을 불러온다(목 모드면 src/lib/mock).
 * 2. 등록 · 수정이 성공하면 서버가 돌려준 품목으로 목록을 바꾼다 — 새 품목은 재고 0으로 맨 위에 붙는다.
 *    다른 화면(입출고 · 대시보드)은 열 때 다시 불러오므로 그쪽에도 바로 반영된다.
 * 3. 검색은 화면에서 거르기만 한다(서버를 다시 부르지 않음).
 * 4. 칸 오류가 아닌 실패는 ErrorBanner에 error.message 그대로(목록은 그대로).
 *
 * 근거: docs/04-api-contract.md 3.2 · 4.4 · 4.6, docs/wireframes.html 5.4절, docs/work-units/WU-16-items.md
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  jkspawn  처음 작성 — 품목 불러오기 · 검색 · 등록 · 수정 처리 (WU-16)
 */
import { useEffect, useState } from 'react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { useToast } from '@/components/common/Toast';
import { api, ApiError } from '@/lib/api-client';
import type { Item } from '@/types/erp';
import { ItemEditDialog } from './ItemEditDialog';
import { ItemForm } from './ItemForm';
import { filterItems, ItemTable } from './ItemTable';
import styles from './items.module.css';

type LoadState = { status: 'loading' } | { status: 'error'; error: ApiError } | { status: 'ready'; items: Item[] };

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('PF_INTERNAL');
}

/** 목록에 서버가 돌려준 품목을 넣는다 — 이미 있으면 그 자리를 바꾸고, 없으면 맨 위에 붙인다. */
export function upsertItem(items: Item[], item: Item): Item[] {
  const index = items.findIndex((i) => i.sku_id === item.sku_id);
  if (index < 0) return [item, ...items];
  return items.map((i, n) => (n === index ? item : i));
}

/**
 * 품목 화면 본문.
 *
 * testid: item-search, error-banner(배너), toast(알림), 그 밖은 각 조각의 testid
 * 부작용: GET /api/items, POST /api/items, PATCH /api/items/{sku_id}
 */
export function ItemsView() {
  const toast = useToast();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);

  useEffect(() => {
    // 응답 콜백 안에서만 setState한다(effect 본문 동기 setState 금지 — ai-cases 사례 1).
    let current = true;
    api
      .items()
      .then((items) => {
        if (current) setState({ status: 'ready', items });
      })
      .catch((error: unknown) => {
        if (current) setState({ status: 'error', error: toApiError(error) });
      });
    return () => {
      current = false;
    };
  }, [attempt]);

  const putItem = (item: Item, message: string) => {
    setState((prev) => (prev.status === 'ready' ? { status: 'ready', items: upsertItem(prev.items, item) } : prev));
    setBanner(null);
    toast.show(message);
  };

  const fail = (error: ApiError) => setBanner(error);

  const items = state.status === 'ready' ? state.items : [];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>품목</h1>

      <ErrorBanner
        error={state.status === 'error' ? state.error : banner}
        onRetry={
          state.status === 'error'
            ? () => {
                setState({ status: 'loading' });
                setAttempt((n) => n + 1);
              }
            : undefined
        }
      />

      {state.status === 'loading' && <Loading />}

      {state.status === 'ready' && (
        <>
          <ItemForm onCreated={(item) => putItem(item, `품목 ${item.sku_id} 등록했어요 (재고 0)`)} onError={fail} />

          <input
            type="search"
            className={`${styles.input} ${styles.search}`}
            placeholder="품목코드 · 이름 검색"
            aria-label="품목 검색"
            data-testid="item-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <ItemTable
            items={filterItems(items, query)}
            query={query}
            onEdit={(item) => {
              setBanner(null);
              setEditing(item);
            }}
          />

          <ItemEditDialog
            key={editing?.sku_id ?? 'closed'}
            item={editing}
            onClose={() => setEditing(null)}
            onSaved={(item) => {
              setEditing(null);
              putItem(item, `품목 ${item.sku_id} 저장했어요`);
            }}
            onError={(error) => {
              setEditing(null);
              fail(error);
            }}
          />
        </>
      )}
    </div>
  );
}
