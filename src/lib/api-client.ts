/**
 * 화면 · 패널이 서버를 부르는 유일한 fetch 래퍼.
 *
 * 하는 일
 * 1. 라우트마다 함수 하나(`api.dashboard()`, `api.shipSale(id)` …). 화면은 fetch를 직접 쓰지 않는다(AGENTS.md 3절).
 * 2. 변경 요청에는 `X-PF: 1`과 JSON 헤더를, 모든 요청에 `credentials: 'same-origin'`(쿠키 세션)을 붙인다(04 1절).
 * 3. 실패는 `ApiError(code, message, detail)`로 던진다. 문구는 04 4.4 표(`messageFor`)로 코드에서 만든다 — 서버가 보낸 문장을 쓰지 않는다.
 *    - 15초 안에 응답 없음 → PF_TIMEOUT, 서버에 닿지 못함 → PF_NETWORK (둘 다 화면 전용, 04 2절)
 *    - 401 → `/login?next=<지금 경로>`로 이동시키고 PF_UNAUTHENTICATED를 던진다(04 4.4 · 4.6)
 *    - 알 수 없는 오류 본문 · 깨진 응답 → PF_INTERNAL
 * 4. `NEXT_PUBLIC_USE_MOCK=1`이면 네트워크 없이 `src/lib/mock/`의 같은 모양 응답을 돌려준다(화면 개발용).
 * 5. 서버 전용 코드를 가져오지 않는다(errors.ts는 server-only가 없다 — 문구 표 재사용).
 *
 * 근거: docs/04-api-contract.md 1 · 2 · 3 · 4.4 · 4.6, WU-04 3번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — api-client · 15초 시간 초과 · 401 이동 · 목 모드 (WU-04)
 */
import { loginUrlFor } from '@/lib/auth/next-path';
import { isMockMode } from '@/lib/env';
import { ApiError } from '@/lib/api/client-error';
import { isServerErrorCode } from '@/lib/api/errors';
import { createMockApi } from '@/lib/mock';
import type { AgentAction, ChatReply, PoConfirmLine, PoDraft } from '@/types/agent';
import type {
  BulkCommitResult,
  BulkFormat,
  BulkPreviewResult,
  BulkRowInput,
  Dashboard,
  Item,
  Purchase,
  PurchaseStatus,
  PurchaseStatusChangeTarget,
  PurchaseWithStock,
  Sale,
  SaleStatus,
  SaleStatusChangeTarget,
  SaleWithStock,
  SeedDataset,
  SeedResult,
  StockLogPage,
} from '@/types/erp';
import type { ItemCreateInput, ItemUpdateInput, PurchaseCreateInput, SaleCreateInput } from '@/lib/validation/schemas';

/** 서버에 닿지 않고 이 시간(밀리초)이 지나면 PF_TIMEOUT(04 4.6). */
export const REQUEST_TIMEOUT_MS = 15_000;

export { ApiError };

/** 화면이 쓰는 함수 모음. 라우트와 1:1(04 3절). 목 모드 구현도 같은 모양이다. */
export type Api = {
  me(): Promise<{ email: string | null; user_id: string }>;
  logout(): Promise<{ ok: true }>;
  items(): Promise<Item[]>;
  createItem(input: ItemCreateInput): Promise<Item>;
  updateItem(sku_id: string, patch: ItemUpdateInput): Promise<Item>;
  purchases(status?: PurchaseStatus | null): Promise<Purchase[]>;
  createPurchase(input: PurchaseCreateInput): Promise<Purchase>;
  setPurchaseStatus(id: string, to: PurchaseStatusChangeTarget): Promise<Purchase>;
  receivePurchase(id: string, received_qty: number): Promise<PurchaseWithStock>;
  cancelReceipt(id: string): Promise<PurchaseWithStock>;
  sales(status?: SaleStatus | null): Promise<Sale[]>;
  createSale(input: SaleCreateInput): Promise<Sale>;
  setSaleStatus(id: string, to: SaleStatusChangeTarget): Promise<Sale>;
  shipSale(id: string): Promise<SaleWithStock>;
  cancelShipment(id: string): Promise<SaleWithStock>;
  stockLogs(query?: { sku_id?: string | null; limit?: number; cursor?: string | null }): Promise<StockLogPage>;
  dashboard(): Promise<Dashboard>;
  bulkPreview(input: { format: BulkFormat; text: string }): Promise<BulkPreviewResult>;
  bulkCommit(rows: BulkRowInput[]): Promise<BulkCommitResult>;
  seed(dataset: SeedDataset): Promise<SeedResult>;
  draftPo(sku_ids?: string[]): Promise<PoDraft>;
  confirmPo(lines: PoConfirmLine[]): Promise<{ purchases: Purchase[] }>;
  chat(message: string): Promise<ChatReply>;
  executeAction(action: AgentAction): Promise<{ result: unknown }>;
};

/** 시험에서 바꿔 끼울 수 있는 의존성. 기본은 브라우저 값. */
export type ApiClientDeps = {
  fetch?: typeof fetch;
  /** 401일 때 호출. 기본은 `window.location.assign` */
  navigate?: (url: string) => void;
  /** 지금 경로(로그인 뒤 돌아올 곳). 기본은 `window.location` */
  currentLocation?: () => { pathname: string; search: string };
  timeoutMs?: number;
  /** true면 목 응답, 생략하면 NEXT_PUBLIC_USE_MOCK=1 여부 */
  mock?: boolean;
};

type Method = 'GET' | 'POST' | 'PATCH';

/** 쿼리 문자열을 만든다(null · undefined · 빈 값은 뺀다). */
function withQuery(path: string, query: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

/**
 * api 클라이언트를 만든다. 보통은 아래의 `api`를 그대로 쓰고, 단위 시험에서만 이 함수로 가짜 fetch를 넣는다.
 * @param deps 시험용 의존성(fetch · navigate · 시간 · 목 여부)
 */
export function createApiClient(deps: ApiClientDeps = {}): Api {
  if (deps.mock ?? isMockMode()) return createMockApi();

  const doFetch = deps.fetch ?? ((input, init) => fetch(input, init));
  const navigate = deps.navigate ?? ((url: string) => window.location.assign(url));
  const currentLocation = deps.currentLocation ?? (() => ({ pathname: window.location.pathname, search: window.location.search }));
  const timeoutMs = deps.timeoutMs ?? REQUEST_TIMEOUT_MS;

  /** 요청 한 번. 성공하면 `data`, 실패하면 ApiError. */
  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    let response: Response;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (method !== 'GET') headers['X-PF'] = '1';
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      response = await doFetch(path, {
        method,
        headers,
        credentials: 'same-origin',
        signal: controller.signal,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiError(timedOut ? 'PF_TIMEOUT' : 'PF_NETWORK');
    } finally {
      clearTimeout(timer);
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // 본문이 JSON이 아니면 아래에서 상태 코드만으로 판단한다
    }

    if (response.status === 401) {
      const here = currentLocation();
      navigate(loginUrlFor(here.pathname, here.search));
      throw new ApiError('PF_UNAUTHENTICATED', null, 401);
    }

    if (!response.ok) {
      const error = (payload as { error?: { code?: unknown; detail?: unknown } } | null)?.error;
      const code = isServerErrorCode(error?.code) ? error.code : 'PF_INTERNAL';
      const detail =
        error?.detail && typeof error.detail === 'object' && !Array.isArray(error.detail)
          ? (error.detail as Record<string, unknown>)
          : null;
      throw new ApiError(code, detail, response.status);
    }

    if (payload === null || typeof payload !== 'object' || !('data' in payload)) {
      throw new ApiError('PF_INTERNAL', null, response.status);
    }
    return (payload as { data: T }).data;
  }

  const id = (value: string) => encodeURIComponent(value);

  return {
    me: () => request('GET', '/api/me'),
    logout: () => request('POST', '/api/auth/logout'),
    items: () => request('GET', '/api/items'),
    createItem: (input) => request('POST', '/api/items', input),
    updateItem: (sku_id, patch) => request('PATCH', `/api/items/${id(sku_id)}`, patch),
    purchases: (status) => request('GET', withQuery('/api/purchases', { status })),
    createPurchase: (input) => request('POST', '/api/purchases', input),
    setPurchaseStatus: (pid, to) => request('POST', `/api/purchases/${id(pid)}/status`, { to }),
    receivePurchase: (pid, received_qty) => request('POST', `/api/purchases/${id(pid)}/receive`, { received_qty }),
    cancelReceipt: (pid) => request('POST', `/api/purchases/${id(pid)}/cancel-receipt`),
    sales: (status) => request('GET', withQuery('/api/sales', { status })),
    createSale: (input) => request('POST', '/api/sales', input),
    setSaleStatus: (sid, to) => request('POST', `/api/sales/${id(sid)}/status`, { to }),
    shipSale: (sid) => request('POST', `/api/sales/${id(sid)}/ship`),
    cancelShipment: (sid) => request('POST', `/api/sales/${id(sid)}/cancel-shipment`),
    stockLogs: (query = {}) =>
      request('GET', withQuery('/api/stock-logs', { sku_id: query.sku_id, limit: query.limit, cursor: query.cursor })),
    dashboard: () => request('GET', '/api/dashboard'),
    bulkPreview: (input) => request('POST', '/api/bulk/preview', input),
    bulkCommit: (rows) => request('POST', '/api/bulk/commit', { rows }),
    seed: (dataset) => request('POST', '/api/seed', { dataset }),
    draftPo: (sku_ids) => request('POST', '/api/agent/draft-po', sku_ids ? { sku_ids } : {}),
    confirmPo: (lines) => request('POST', '/api/agent/draft-po/confirm', { lines }),
    chat: (message) => request('POST', '/api/agent/chat', { message }),
    executeAction: (action) => request('POST', '/api/agent/execute', { action }),
  };
}

/** 화면이 쓰는 기본 클라이언트. 예: `const items = await api.items();` */
export const api: Api = createApiClient();
