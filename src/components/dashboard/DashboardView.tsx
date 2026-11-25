'use client';

/**
 * 대시보드 본문 — api.dashboard()를 불러 로딩 · 오류 · 내용 세 상태를 그린다.
 *
 * 하는 일
 * 1. 처음 그릴 때 api.dashboard()를 한 번 부른다(목 모드면 src/lib/mock 값).
 * 2. 불러오는 동안 Loading, 실패하면 ErrorBanner(error.message 그대로, 연결 실패 · 시간 초과면 [다시 시도]).
 * 3. 성공하면 KPI · 품절 임박 · 파이프라인 · 재고 표 · 최근 변경을 API 값 그대로 그린다(T-S1-3).
 * 4. page.tsx가 metadata를 내보내는 서버 컴포넌트라서, 상태가 있는 부분을 이 파일로 나눴다.
 * 5. 같은 화면의 다른 곳이 데이터를 바꿨다는 알림(data-changed.ts)을 받으면 다시 불러온다(#77).
 *
 * 근거: docs/04-api-contract.md 3.5 · 4.4 · 4.6 · WU-11 7번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  jkspawn  처음 작성 — 대시보드 불러오기 · 로딩 · 오류 상태 (WU-11)
 * 2026-11-25  jkspawn  데이터 변경 알림을 받으면 다시 불러오기 (#77)
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { api, ApiError } from '@/lib/api-client';
import type { Dashboard } from '@/types/erp';
import { AlertCards } from './AlertCards';
import { onDataChanged } from './data-changed';
import { KpiCards } from './KpiCards';
import { Pipeline } from './Pipeline';
import { RecentChanges } from './RecentChanges';
import { historyHref, StockTable } from './StockTable';
import styles from './dashboard.module.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; data: Dashboard };

/** api-client가 아닌 곳에서 난 예외(코드 버그 등)도 배너에 보일 수 있게 PF_INTERNAL로 바꾼다. */
function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('PF_INTERNAL');
}

/**
 * 대시보드 내용 묶음(불러온 값을 받는 순수 그리기). 시험에서 목 값을 넣어 그린다.
 *
 * props
 * - data: `GET /api/dashboard` 응답
 * - onRowClick: 재고 표 행을 눌렀을 때
 */
export function DashboardContent({ data, onRowClick }: { data: Dashboard; onRowClick: (sku_id: string) => void }) {
  return (
    <>
      <KpiCards kpi={data.kpi} />
      <AlertCards alerts={data.alerts} />
      <Pipeline pipeline={data.pipeline} />
      <StockTable items={data.items} onRowClick={onRowClick} />
      <RecentChanges changes={data.recent_changes} items={data.items} />
    </>
  );
}

/**
 * 대시보드 본문. 서버 호출은 api-client만 쓴다(AGENTS.md 3절).
 * 부작용: GET /api/dashboard 호출(목 모드면 네트워크 없음).
 *
 * testid: (각 조각의 testid)
 */
export function DashboardView() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  // 몇 번째 불러오기인지. 늦게 온 이전 응답이 새 응답을 덮지 않게 한다.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // 응답이 온 뒤 콜백 안에서만 setState한다(effect 본문에서 동기 setState 금지 — lint react-hooks/set-state-in-effect).
    // 첫 상태 · [다시 시도]가 이미 loading으로 바꿔 두므로 여기서는 바꾸지 않는다.
    let current = true;
    api
      .dashboard()
      .then((data) => {
        if (current) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (current) setState({ status: 'error', error: toApiError(error) });
      });
    return () => {
      current = false;
    };
  }, [attempt]);

  // [#77 bug] 에이전트 패널에서 발주 확정 · [실행]을 해도 처음 불러온 값을 그대로 보임 → 데이터 변경 알림을 받으면 다시 불러온다 (jkspawn)
  // 보던 내용은 그대로 두고(loading으로 바꾸지 않음) 새 응답이 오면 바꾼다. setAttempt는 이벤트 콜백 안에서만 부른다.
  useEffect(() => onDataChanged(() => setAttempt((n) => n + 1)), []);

  /** [다시 시도] — 이벤트 처리기라 loading으로 바로 바꾸고 effect를 다시 돌린다. */
  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>대시보드</h1>
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorBanner error={state.error} onRetry={retry} />}
      {state.status === 'ready' && (
        <DashboardContent data={state.data} onRowClick={(sku_id) => router.push(historyHref(sku_id))} />
      )}
    </div>
  );
}
