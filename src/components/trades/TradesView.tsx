'use client';

/**
 * 입출고 화면 본문 — 구매 · 입고 / 판매 · 출고 탭, 등록 폼, 표, 입고 확정 창, 오류 배너 · 알림.
 *
 * 하는 일
 * 1. 처음 그릴 때 품목 · 구매 · 판매 목록을 api-client로 불러온다(목 모드면 src/lib/mock). 상태 필터는 서버에 넘긴다.
 * 2. 등록 · 입고 확정 · 출고대기로 · 출고가 성공하면 목록을 다시 불러오고 "재고 10 → 4" 같은 알림(Toast).
 *    재고 숫자는 작업 전 품목 목록 값과 서버 응답 stock_qty를 그대로 쓴다 — 화면에서 계산하지 않는다.
 * 3. 실패는 ErrorBanner에 error.message 그대로(남은 수량 문구는 서버 · api-client가 만든다).
 *    재고 부족이면 목록을 그대로 두고, 전이 오류면 목록을 새로고침한다(04 4.4).
 * 4. 탭을 바꾸면 주소(`?tab=`)를 바꾼다. page.tsx가 주소마다 이 컴포넌트를 새로 그린다(key).
 *
 * 근거: docs/04-api-contract.md 3.3 · 3.4 · 4.4 · 4.6, docs/work-units/WU-12-trades.md
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  jkspawn  처음 작성 — 입출고 탭 · 불러오기 · 작업 처리 (WU-12)
 * 2026-11-24  jkspawn  일괄 등록 탭(BulkTab) 추가 — 반영 뒤 목록 새로고침 · 알림 (WU-13)
 */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BulkTab } from '@/components/bulk/BulkTab';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { useToast } from '@/components/common/Toast';
import { api, ApiError } from '@/lib/api-client';
import type { Item, Purchase, PurchaseWithStock, Sale } from '@/types/erp';
import { stockChangeMessage } from './form-utils';
import { PurchaseForm } from './PurchaseForm';
import { PurchaseTable } from './PurchaseTable';
import type { TradesQuery, TradesTab } from './query';
import { tradesUrl } from './query';
import { ReceiveDialog } from './ReceiveDialog';
import { SaleForm } from './SaleForm';
import { SALE_READY, SaleTable } from './SaleTable';
import styles from './trades.module.css';

type Lists = { items: Item[]; purchases: Purchase[]; sales: Sale[] };

type LoadState = { status: 'loading' } | { status: 'error'; error: ApiError } | { status: 'ready'; lists: Lists };

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('PF_INTERNAL');
}

/**
 * 입출고 화면 본문.
 *
 * props
 * - query: 주소에서 읽은 탭 · 상태 필터(`parseTradesQuery`)
 *
 * testid: tab-purchase, tab-sale, status-filter, error-banner(배너), toast(알림)
 * 부작용: GET items · purchases · sales, POST purchases · sales · receive · status · ship
 */
export function TradesView({ query }: { query: TradesQuery }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [receiving, setReceiving] = useState<Purchase | null>(null);
  // 몇 번째 불러오기인지. 올리면 effect가 다시 돈다(늦게 온 이전 응답은 버린다).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // 응답 콜백 안에서만 setState한다(effect 본문 동기 setState 금지 — lint react-hooks/set-state-in-effect, ai-cases 사례 1).
    let current = true;
    const purchaseStatus = query.tab === 'purchase' ? query.status : null;
    const saleStatus = query.tab === 'sale' ? query.status : null;
    Promise.all([api.items(), api.purchases(purchaseStatus), api.sales(saleStatus)])
      .then(([items, purchases, sales]) => {
        if (current) setState({ status: 'ready', lists: { items, purchases, sales } });
      })
      .catch((error: unknown) => {
        if (current) setState({ status: 'error', error: toApiError(error) });
      });
    return () => {
      current = false;
    };
  }, [query.tab, query.status, attempt]);

  /** 목록 다시 불러오기. 지금 목록은 그대로 보이게 두고 응답이 오면 바꾼다. */
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const lists = state.status === 'ready' ? state.lists : null;
  const itemNames = useMemo(() => new Map((lists?.items ?? []).map((i) => [i.sku_id, i.item_name])), [lists]);
  const stockBefore = (sku_id: string) => lists?.items.find((i) => i.sku_id === sku_id)?.stock_qty ?? null;

  /** 작업 실패 공통 처리 — 배너 + 전이 오류면 목록 새로고침(04 4.4). 재고 부족은 목록을 그대로 둔다. */
  const fail = (error: unknown) => {
    const apiError = toApiError(error);
    setBanner(apiError);
    if (apiError.code === 'PF_INVALID_TRANSITION' || apiError.code === 'PF_NOT_FOUND') reload();
  };

  const succeed = (message: string) => {
    setBanner(null);
    toast.show(message);
    reload();
  };

  const onReceived = (result: PurchaseWithStock) => {
    const before = receiving ? stockBefore(receiving.sku_id) : null;
    setReceiving(null);
    succeed(stockChangeMessage(`${result.purchase.purchase_id} 입고 확정`, result.purchase.sku_id, before, result.stock_qty));
  };

  const onReady = async (sale: Sale) => {
    try {
      const updated = await api.setSaleStatus(sale.id, SALE_READY);
      succeed(`${updated.sale_id} ${updated.fulfillment_status}로 바꿨어요`);
    } catch (error) {
      fail(error);
    }
  };

  const onShip = async (sale: Sale) => {
    const before = stockBefore(sale.sku_id);
    try {
      const result = await api.shipSale(sale.id);
      succeed(stockChangeMessage(`${result.sale.sale_id} 출고`, result.sale.sku_id, before, result.stock_qty));
    } catch (error) {
      fail(error);
    }
  };

  const switchTab = (tab: TradesTab) => {
    if (tab !== query.tab) router.push(tradesUrl(tab));
  };

  const filterText = query.status ? `'${query.status}' 상태` : null;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>입출고</h1>

      <div className={styles.tabs} role="tablist">
        {(
          [
            ['purchase', '구매 · 입고'],
            ['sale', '판매 · 출고'],
            ['bulk', '일괄 등록'],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={query.tab === tab}
            className={`${styles.tab} ${query.tab === tab ? styles.tabActive : ''}`}
            data-testid={`tab-${tab}`}
            onClick={() => switchTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {filterText && (
        <div className={styles.filter} data-testid="status-filter">
          <span>{filterText}만 보는 중</span>
          <Link href={tradesUrl(query.tab)} className={styles.filterClear}>
            전체 보기
          </Link>
        </div>
      )}

      <ErrorBanner
        error={state.status === 'error' ? state.error : banner}
        onRetry={state.status === 'error' ? () => {
          setState({ status: 'loading' });
          reload();
        } : undefined}
      />

      {state.status === 'loading' && <Loading />}

      {lists && query.tab === 'purchase' && (
        <>
          <PurchaseForm
            items={lists.items}
            onCreated={(p) => succeed(`구매 ${p.purchase_id} 등록했어요`)}
            onError={fail}
          />
          <PurchaseTable
            purchases={lists.purchases}
            itemNames={itemNames}
            onReceive={(p) => {
              setBanner(null);
              setReceiving(p);
            }}
            emptyText={filterText ? `${filterText} 구매가 없어요` : undefined}
          />
          <ReceiveDialog
            key={receiving?.id ?? 'closed'}
            purchase={receiving}
            onClose={() => setReceiving(null)}
            onDone={onReceived}
            onError={(error) => {
              setReceiving(null);
              fail(error);
            }}
          />
        </>
      )}

      {lists && query.tab === 'sale' && (
        <>
          <SaleForm items={lists.items} onCreated={(s) => succeed(`판매 ${s.sale_id} 등록했어요`)} onError={fail} />
          <SaleTable
            sales={lists.sales}
            itemNames={itemNames}
            onReady={onReady}
            onShip={onShip}
            emptyText={filterText ? `${filterText} 판매가 없어요` : undefined}
          />
        </>
      )}

      {lists && query.tab === 'bulk' && <BulkTab onApplied={succeed} onError={fail} />}
    </div>
  );
}
