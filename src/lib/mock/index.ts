/**
 * 목 모드 api — `NEXT_PUBLIC_USE_MOCK=1`일 때 api-client가 네트워크 대신 돌려주는 계약 모양 응답.
 *
 * 하는 일
 * 1. api-client의 `Api` 타입과 같은 함수 모음을 만든다. 데이터는 이 폴더의 목 파일(계획서 7절 시드 예시)이다.
 * 2. 상태를 저장하지 않는다(요청마다 같은 모양을 새로 만든다). 화면 개발용이라 계산은 단순하다.
 * 3. 오류 응답 사례: `MOCK_INSUFFICIENT_STOCK_ID`를 id로 출고하면 PF_INSUFFICIENT_STOCK을, 품목코드 `DUP-001`로 등록하면
 *    PF_DUPLICATE_SKU를 던진다(ErrorBanner · FieldError를 눈으로 확인하는 용도).
 *
 * 근거: docs/04-api-contract.md 3 · 4.4, WU-04 2 · 3번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 목 모드 api 구현 (WU-04)
 */
import { ApiError } from '@/lib/api/client-error';
import type { Api } from '@/lib/api-client';
import { mockChatReplyRefused, mockChatReplyShip, mockChatReplyStock, mockPoDraft } from './agent';
import { mockDashboard } from './dashboard';
import { mockItems } from './items';
import { mockPurchases } from './purchases';
import { mockSales } from './sales';
import { mockStockLogPage } from './stockLogs';

/** 이 id로 `shipSale`을 부르면 재고 부족 오류 사례(PF_INSUFFICIENT_STOCK)가 나온다. */
export const MOCK_INSUFFICIENT_STOCK_ID = 'mock-insufficient-stock';

const NOW = '2026-11-23T01:00:00.000Z';

/**
 * 목 모드 Api를 만든다.
 * 던지는 오류: PF_INSUFFICIENT_STOCK(출고, 위 id) · PF_DUPLICATE_SKU(품목 등록, `DUP-001`).
 */
export function createMockApi(): Api {
  const firstPurchase = mockPurchases[0];
  const firstSale = mockSales[0];
  const firstItem = mockItems[0];
  if (!firstPurchase || !firstSale || !firstItem) throw new Error('목 데이터가 비어 있어요');

  return {
    me: async () => ({ email: 'a-a@packflow.test', user_id: '00000000-0000-4000-8000-000000000001' }),
    logout: async () => ({ ok: true }),
    items: async () => mockItems,
    createItem: async (input) => {
      if (input.sku_id === 'DUP-001') throw new ApiError('PF_DUPLICATE_SKU', { sku_id: input.sku_id }, 409);
      return { ...firstItem, ...input, id: '00000000-0000-4000-8000-0000000000f1', stock_qty: 0, below_safety: input.safety_stock > 0 };
    },
    updateItem: async (sku_id, patch) => ({ ...(mockItems.find((i) => i.sku_id === sku_id) ?? firstItem), ...patch }),
    purchases: async (status) => (status ? mockPurchases.filter((p) => p.status === status) : mockPurchases),
    createPurchase: async (input) => ({
      ...firstPurchase,
      ...input,
      id: '00000000-0000-4000-8000-0000000000f2',
      purchase_id: 'P-102',
      status: '발주완료',
      source: 'form',
    }),
    setPurchaseStatus: async (id, to) => ({ ...firstPurchase, id, status: to }),
    receivePurchase: async (id, received_qty) => ({
      purchase: { ...firstPurchase, id, status: '입고완료', received_qty, received_at: NOW },
      stock_qty: firstItem.stock_qty + received_qty,
    }),
    cancelReceipt: async (id) => ({
      purchase: { ...firstPurchase, id, status: '입고취소' },
      stock_qty: firstItem.stock_qty,
    }),
    sales: async (status) => (status ? mockSales.filter((s) => s.fulfillment_status === status) : mockSales),
    createSale: async (input) => ({
      ...firstSale,
      ...input,
      id: '00000000-0000-4000-8000-0000000000f3',
      sale_id: 'S-203',
      fulfillment_status: '주문접수',
      source: 'form',
    }),
    setSaleStatus: async (id, to) => ({ ...firstSale, id, fulfillment_status: to }),
    shipSale: async (id) => {
      if (id === MOCK_INSUFFICIENT_STOCK_ID) {
        throw new ApiError('PF_INSUFFICIENT_STOCK', { sku_id: 'PRD-003', stock_qty: 3, requested: 5 }, 409);
      }
      return {
        sale: { ...firstSale, id, fulfillment_status: '출고완료', shipped_at: NOW },
        stock_qty: firstItem.stock_qty - firstSale.sold_qty,
      };
    },
    cancelShipment: async (id) => ({
      sale: { ...firstSale, id, fulfillment_status: '출고취소' },
      stock_qty: firstItem.stock_qty,
    }),
    stockLogs: async (query = {}) => {
      const rows = query.sku_id ? mockStockLogPage.rows.filter((r) => r.sku_id === query.sku_id) : mockStockLogPage.rows;
      return { rows: rows.slice(0, query.limit ?? 20), next_cursor: null };
    },
    dashboard: async () => mockDashboard,
    bulkPreview: async ({ text }) => ({
      rows: text
        .split('\n')
        .filter((line) => line.trim() !== '')
        .slice(0, 500)
        .map((_, index) => ({
          line: index + 1,
          kind: '입고',
          sku_id: 'PRD-001',
          qty: 5,
          partner: '가나물산',
          invoice_no: null,
          memo: null,
          valid: true,
          errors: [],
        })),
    }),
    bulkCommit: async (rows) => ({ applied: rows.length, skipped: [] }),
    seed: async () => ({ items: 3, purchases: 1, sales: 2, logs: 3 }),
    draftPo: async () => mockPoDraft,
    confirmPo: async (lines) => ({
      purchases: lines.map((line, index) => ({
        ...firstPurchase,
        ...line,
        id: `00000000-0000-4000-8000-0000000000e${index}`,
        purchase_id: `P-${103 + index}`,
        status: '발주완료',
        source: 'agent',
      })),
    }),
    chat: async (message) => {
      if (message.includes('거부') || message.includes('노트북')) return mockChatReplyRefused;
      return message.includes('출고') ? mockChatReplyShip : mockChatReplyStock;
    },
    executeAction: async () => ({ result: { ok: true } }),
  };
}
