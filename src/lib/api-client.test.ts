/**
 * api-client 단위 테스트 — 실제 모드(가짜 fetch)와 목 모드.
 *
 * 하는 일
 * 1. A: X-PF · credentials, 401 → 로그인 이동, 15초 → PF_TIMEOUT(가짜 타이머), fetch 실패 → PF_NETWORK,
 *    `{error}` → 04 4.4 문구, 성공 → data.
 * 2. M: 목 모드가 네트워크 없이 계약 타입 모양의 응답을 돌려준다(품절 임박 · 오류 사례 포함).
 *
 * 근거: docs/04-api-contract.md 1 · 2 · 4.4 · 4.6, WU-04 (A · M 기준)
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — api-client 실제 · 목 모드 시험 (WU-04)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatReply, PoDraft } from '@/types/agent';
import type { Dashboard, Item, Purchase, Sale, SaleWithStock } from '@/types/erp';
import { ApiError, createApiClient, REQUEST_TIMEOUT_MS } from './api-client';
import { mockInsufficientStockError } from './mock/errors';
import { MOCK_INSUFFICIENT_STOCK_ID } from './mock';

const json = (body: unknown, status = 200) => Response.json(body, { status });

function setup(responder: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const fetchFake = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => responder(String(input), init ?? {}));
  const navigate = vi.fn();
  const api = createApiClient({
    fetch: fetchFake as unknown as typeof fetch,
    navigate,
    currentLocation: () => ({ pathname: '/trades', search: '?tab=sales' }),
    mock: false,
  });
  return { api, fetchFake, navigate };
}

describe('A: api-client 실제 모드', () => {
  afterEach(() => vi.useRealTimers());

  it('A-1 GET: credentials same-origin, X-PF는 붙이지 않는다, 성공하면 data', async () => {
    const { api, fetchFake } = setup(() => json({ data: [{ sku_id: 'PRD-001' }] }));
    await expect(api.items()).resolves.toEqual([{ sku_id: 'PRD-001' }]);
    const [url, init] = fetchFake.mock.calls[0]!;
    expect(url).toBe('/api/items');
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('same-origin');
    expect((init?.headers as Record<string, string>)['X-PF']).toBeUndefined();
  });

  it('A-2 POST: X-PF: 1 · JSON 헤더 · 본문이 붙는다', async () => {
    const { api, fetchFake } = setup(() => json({ data: { applied: 1, skipped: [] } }, 200));
    await api.bulkCommit([{ line: 1, kind: '입고', sku_id: 'PRD-001', qty: 5, partner: '가나물산', invoice_no: null, memo: null }]);
    const [url, init] = fetchFake.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(url).toBe('/api/bulk/commit');
    expect(init?.method).toBe('POST');
    expect(headers['X-PF']).toBe('1');
    expect(headers['Content-Type']).toBe('application/json');
    expect(init?.credentials).toBe('same-origin');
    expect(JSON.parse(String(init?.body))).toEqual({ rows: [expect.objectContaining({ sku_id: 'PRD-001', qty: 5 })] });
  });

  it('A-3 본문 없는 POST(출고)도 X-PF가 붙고 본문은 없다, id는 인코딩된다', async () => {
    const { api, fetchFake } = setup(() => json({ data: {} }));
    await api.shipSale('a/b');
    const [url, init] = fetchFake.mock.calls[0]!;
    expect(url).toBe('/api/sales/a%2Fb/ship');
    expect((init?.headers as Record<string, string>)['X-PF']).toBe('1');
    expect(init?.body).toBeUndefined();
  });

  it('A-4 쿼리: 값이 있는 것만 붙는다(null · 빈 값은 뺌)', async () => {
    const { api, fetchFake } = setup(() => json({ data: [] }));
    await api.purchases('입고완료');
    await api.purchases(null);
    await api.stockLogs({ sku_id: 'PRD-001', limit: 5, cursor: null });
    expect(fetchFake.mock.calls.map((c) => c[0])).toEqual([
      `/api/purchases?status=${encodeURIComponent('입고완료')}`,
      '/api/purchases',
      '/api/stock-logs?sku_id=PRD-001&limit=5',
    ]);
  });

  it('A-5 401 → /login?next=<지금 경로>로 이동시키고 PF_UNAUTHENTICATED를 던진다', async () => {
    const { api, navigate } = setup(() => json({ error: { code: 'PF_UNAUTHENTICATED', message: '서버 문장' } }, 401));
    await expect(api.dashboard()).rejects.toMatchObject({ code: 'PF_UNAUTHENTICATED', status: 401 });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login?next=%2Ftrades%3Ftab%3Dsales');
  });

  it('A-6 15초 안에 응답이 없으면 PF_TIMEOUT(요청을 취소한다)', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const { api } = setup(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );
    const outcome = expect(api.items()).rejects.toMatchObject({ code: 'PF_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(aborted).toBe(false); // 14.999초에는 아직
    await vi.advanceTimersByTimeAsync(1);
    await outcome;
    expect(aborted).toBe(true);
    expect(REQUEST_TIMEOUT_MS).toBe(15_000);
  });

  it('A-7 fetch가 실패하면(연결 안 됨) PF_NETWORK, 시간 초과와 구분된다', async () => {
    const { api } = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(api.items()).rejects.toMatchObject({ code: 'PF_NETWORK', status: null });
  });

  it('A-8 {error}는 04 4.4 문구로 바뀐다(서버가 보낸 문장은 쓰지 않는다) + detail 전달', async () => {
    const detail = { sku_id: 'PRD-001', stock_qty: 4, requested: 9 };
    const { api } = setup(() => json({ error: { code: 'PF_INSUFFICIENT_STOCK', message: '무시될 서버 문장', detail } }, 409));
    const error = await api.shipSale('x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('재고가 부족해요. PRD-001 남은 수량 4개');
    expect((error as ApiError).code).toBe('PF_INSUFFICIENT_STOCK');
    expect((error as ApiError).detail).toEqual(detail);
    expect((error as ApiError).status).toBe(409);
  });

  it('A-9 PF_VALIDATION detail(field · reason)이 그대로 오른다', async () => {
    const detail = { field: 'order_qty', reason: 'out_of_range', min: 1, max: 100000 };
    const { api } = setup(() => json({ error: { code: 'PF_VALIDATION', message: 'x', detail } }, 400));
    await expect(api.createPurchase({ sku_id: 'PRD-001', supplier: 'a', order_qty: 0, purchase_cost: 1, invoice_no: null })).rejects.toMatchObject({
      code: 'PF_VALIDATION',
      detail,
    });
  });

  it('A-10 모르는 코드 · JSON이 아닌 오류 응답 · data 없는 성공 응답은 PF_INTERNAL', async () => {
    for (const make of [
      () => json({ error: { code: 'PF_MADE_UP' } }, 500),
      () => json({ error: { code: 'PF_NETWORK' } }, 502), // 화면 전용 코드는 서버가 보낼 수 없다
      () => new Response('<html>bad gateway</html>', { status: 502 }),
      () => json({ something: 1 }, 200),
      () => new Response('not json', { status: 200 }),
    ]) {
      const { api } = setup(make);
      await expect(api.items()).rejects.toMatchObject({ code: 'PF_INTERNAL' });
    }
  });

  it('A-11 오류 문구가 04 4.4의 PF_NETWORK · PF_TIMEOUT 원문과 같다', () => {
    expect(new ApiError('PF_NETWORK').message).toBe('서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요');
    expect(new ApiError('PF_TIMEOUT').message).toBe('응답이 늦어요. 잠시 뒤 다시 시도해 주세요 (배포 서버가 깨어나는 중일 수 있어요)');
  });
});

describe('M: api-client 목 모드', () => {
  const mockApi = () => createApiClient({ mock: true, fetch: (() => Promise.reject(new Error('목 모드는 네트워크를 쓰지 않아요'))) as unknown as typeof fetch });

  it('M-1 dashboard: 계약 모양(kpi · pipeline · items · alerts · recent_changes)과 품절 임박 사례', async () => {
    const d: Dashboard = await mockApi().dashboard();
    expect(Object.keys(d).sort()).toEqual(['alerts', 'items', 'kpi', 'pipeline', 'recent_changes']);
    expect(d.kpi).toEqual(expect.objectContaining({ item_count: 3, stock_total: 53, below_safety: 1 }));
    expect(d.alerts).toEqual([{ sku_id: 'PRD-003', item_name: '노트북 거치대', stock_qty: 3, safety_stock: 4 }]);
    expect(d.items.filter((i) => i.below_safety).map((i) => i.sku_id)).toEqual(['PRD-003']);
    expect(Object.keys(d.pipeline.purchase)).toHaveLength(6);
    expect(Object.keys(d.pipeline.sale)).toHaveLength(5);
    expect(d.recent_changes.length).toBeLessThanOrEqual(5);
  });

  it('M-2 items: 시드 예시 3개, below_safety = 재고 < 안전재고', async () => {
    const items: Item[] = await mockApi().items();
    expect(items.map((i) => i.sku_id)).toEqual(['PRD-001', 'PRD-002', 'PRD-003']);
    for (const i of items) expect(i.below_safety).toBe(i.stock_qty < i.safety_stock);
    expect(items.find((i) => i.sku_id === 'PRD-003')?.below_safety).toBe(true);
  });

  it('M-3 purchases · sales: P-101 · S-201 · S-202, status 필터', async () => {
    const api = mockApi();
    const purchases: Purchase[] = await api.purchases();
    const sales: Sale[] = await api.sales();
    expect(purchases.map((p) => p.purchase_id)).toEqual(['P-101']);
    expect(purchases[0]).toMatchObject({ status: '이동·통관중', received_qty: null, order_qty: 10 });
    expect(sales.map((s) => s.sale_id)).toEqual(['S-201', 'S-202']);
    expect((await api.sales('출고대기')).map((s) => s.sale_id)).toEqual(['S-201']);
    expect(await api.purchases('입고완료')).toEqual([]);
  });

  it('M-4 shipSale: 출고완료 + 새 재고(10 − 6 = 4), 재고 부족 사례 id는 04 4.4 문구의 오류', async () => {
    const api = mockApi();
    const shipped: SaleWithStock = await api.shipSale('00000000-0000-4000-8000-000000000001');
    expect(shipped.sale.fulfillment_status).toBe('출고완료');
    expect(shipped.stock_qty).toBe(4);
    const error = await api.shipSale(MOCK_INSUFFICIENT_STOCK_ID).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('PF_INSUFFICIENT_STOCK');
    expect((error as ApiError).message).toBe(mockInsufficientStockError.error.message);
    expect(mockInsufficientStockError.error.message).toBe('재고가 부족해요. PRD-003 남은 수량 3개');
  });

  it('M-5 에이전트 목: draftPo · chat이 PoDraft · ChatReply 모양', async () => {
    const api = mockApi();
    const draft: PoDraft = await api.draftPo();
    expect(draft.lines[0]).toMatchObject({ sku_id: 'PRD-003', stock_qty: 3, safety_stock: 4 });
    expect(draft.lines[0]!.recommended_qty).toBeGreaterThan(0);
    const stock: ChatReply = await api.chat('PRD-001 재고 알려줘');
    expect(stock).toMatchObject({ needs_confirmation: false, refused: null });
    const ship: ChatReply = await api.chat('S-201 출고해줘');
    expect(ship).toMatchObject({ needs_confirmation: true, proposed_action: { type: 'ship_sale' } });
  });

  it('M-6 품목 등록 오류 사례: 품목코드 DUP-001은 PF_DUPLICATE_SKU', async () => {
    await expect(
      mockApi().createItem({ sku_id: 'DUP-001', item_name: 'x', unit_cost: 1, sale_price: 1, safety_stock: 1, source_url: null }),
    ).rejects.toMatchObject({ code: 'PF_DUPLICATE_SKU', message: '이미 있는 품목코드예요 (DUP-001)' });
  });

  it('M-7 목 모드는 fetch를 부르지 않는다', async () => {
    const fetchSpy = vi.fn();
    const api = createApiClient({ mock: true, fetch: fetchSpy as unknown as typeof fetch });
    await api.items();
    await api.dashboard();
    await api.seed('demo');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
