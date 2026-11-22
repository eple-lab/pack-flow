/**
 * AI 에이전트 전용 타입 — 발주서 초안 · 챗봇 응답 · 실행 액션.
 *
 * 하는 일
 * 1. 04 3.8의 PoDraft · AgentAction · ChatReply를 그대로 정의한다.
 * 2. 허용 액션은 6개뿐이다. LLM이 다른 type을 내면 서버가 refused로 바꾼다.
 *
 * 파트 간 계약이라 바꾸려면 04 문서와 함께 PR을 올리고 skygaul이 리뷰한다.
 *
 * 근거: docs/04-api-contract.md 3.8 · 5절 · WU-03
 * 구역: eple (파트 간 계약 — 바꿀 때 skygaul 리뷰)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — PoDraft · AgentAction · ChatReply (WU-03)
 */
import type { PurchaseStatusChangeTarget, SaleStatusChangeTarget } from './erp';

/** LLM 제공자(D-06). 화면에 보이는 값은 gemini · ollama. */
export type LlmProvider = 'gemini' | 'ollama';

/** 발주서 초안 한 줄. 수량 · 단가 · 근거는 코드가 정한다(LLM 아님). */
export type PoDraftLine = {
  sku_id: string;
  item_name: string;
  stock_qty: number;
  safety_stock: number;
  /** 코드가 계산 (src/lib/agent/reorder.ts) */
  recommended_qty: number;
  /** items.unit_cost */
  unit_cost: number;
  /** 최근 구매의 거래처, 없으면 "미지정" */
  supplier: string;
  /** 계산 근거 문장 (코드가 만든 것) */
  basis: string;
};

/** `POST /api/agent/draft-po`의 응답. LLM 실패여도 표(lines)는 그대로 준다(P-08). */
export type PoDraft = {
  lines: PoDraftLine[];
  /** LLM이 쓴 발주서 문안. LLM 실패면 null */
  message: string | null;
  llm_error: { code: string; message: string } | null;
  provider: LlmProvider;
};

/** 챗봇이 제안하고 사람이 [확인]을 눌러야 실행되는 액션. 이 6개 밖은 거부한다. */
export type AgentAction =
  | { type: 'get_stock'; sku_id: string }
  | { type: 'list_low_stock' }
  /** 새 판매(직접출고) 후 출고 (P-14) */
  | { type: 'ship_quantity'; sku_id: string; qty: number }
  /** 기존 주문 출고 */
  | { type: 'ship_sale'; sale_id: string }
  | { type: 'set_sale_status'; sale_id: string; to: SaleStatusChangeTarget }
  | { type: 'set_purchase_status'; purchase_id: string; to: PurchaseStatusChangeTarget };

/** 허용 액션 type 목록. 검증 스키마와 LLM 응답 걸러내기가 같이 쓴다. */
export const AGENT_ACTION_TYPES = [
  'get_stock',
  'list_low_stock',
  'ship_quantity',
  'ship_sale',
  'set_sale_status',
  'set_purchase_status',
] as const satisfies ReadonlyArray<AgentAction['type']>;

/** `POST /api/agent/chat`의 응답. 수치는 서버 조회 결과에서만 온다. */
export type ChatReply = {
  /** 사용자에게 보일 문장 */
  reply: string;
  /** reply에 들어간 수치의 출처 (예: { "PRD-001.stock_qty": 4 }) */
  facts: Record<string, number>;
  /** 변경 액션이면 화면이 [확인]/[취소]를 띄운다 */
  proposed_action: AgentAction | null;
  /** 조회 액션은 false (바로 결과를 reply에 담음) */
  needs_confirmation: boolean;
  /** 허용 밖 요청 · 재고 부족 등 */
  refused: { reason: string } | null;
};

/** `POST /api/agent/draft-po/confirm`의 한 줄(사용자가 고친 값). */
export type PoConfirmLine = {
  sku_id: string;
  supplier: string;
  order_qty: number;
  purchase_cost: number;
};
