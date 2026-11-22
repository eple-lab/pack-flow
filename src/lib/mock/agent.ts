/**
 * AI 에이전트 응답 목 — 발주서 초안 · 챗봇 응답을 화면 개발용으로 흉내 낸다.
 *
 * 하는 일
 * 1. 화면 개발용 목이다. NEXT_PUBLIC_USE_MOCK=1일 때만 쓴다(실제 LLM을 부르지 않는다).
 * 2. 수량 · 단가 · 근거 문장은 코드가 만든 것처럼 적었다. 문안(message)만 LLM이 쓴 것처럼 예시다.
 * 3. 챗봇 목의 수치(facts)는 reply에 든 숫자와 같은 값을 가리킨다(수치는 서버 조회 결과에서만 온다, 04 3.8).
 * 4. skygaul이 화면을 만들 때 쓴다. 실제 응답 모양은 docs/04-api-contract.md 3.8이 원본이다.
 *
 * 근거: docs/04-api-contract.md 3.8 · 5절 · WU-04
 * 구역: eple (agent.ts 는 구역: eple, 에이전트 응답 목 — skygaul이 화면을 만들 때 씀)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 발주서 초안(정상 · LLM 실패) · 챗봇 응답 목 (WU-04)
 */
import { messageFor } from '@/lib/api/errors';
import type { ChatReply, PoDraft, PoDraftLine } from '@/types/agent';

/** 발주서 초안 한 줄 목. PRD-003 노트북 거치대: 재고 3, 안전재고 4, 권장 8개(여유 7은 목 값). */
const mockPoDraftLines: PoDraftLine[] = [
  {
    sku_id: 'PRD-003',
    item_name: '노트북 거치대',
    stock_qty: 3,
    safety_stock: 4,
    recommended_qty: 8,
    unit_cost: 12000,
    supplier: '가나물산',
    basis: '안전재고 4 − 현재고 3 + 여유 7 = 권장 8개',
  },
];

/** 발주서 초안 정상 응답 목. LLM 문안이 있고 llm_error는 없다. */
export const mockPoDraft: PoDraft = {
  lines: mockPoDraftLines,
  message: '발주서 문안 예시',
  llm_error: null,
  provider: 'ollama',
};

/** 발주서 초안 LLM 실패 목. 표(lines)는 그대로 오고 문안만 null이다(P-08). */
export const mockPoDraftLlmFailed: PoDraft = {
  lines: mockPoDraftLines,
  message: null,
  llm_error: { code: 'PF_LLM_UNAVAILABLE', message: messageFor('PF_LLM_UNAVAILABLE') },
  provider: 'ollama',
};

/** 챗봇 조회 응답 목. 조회 액션은 바로 답하므로 proposed_action이 없다. */
export const mockChatReplyStock: ChatReply = {
  reply: 'PRD-001 무선 마우스 재고는 10개예요',
  facts: { 'PRD-001.stock_qty': 10 },
  proposed_action: null,
  needs_confirmation: false,
  refused: null,
};

/** 챗봇 변경 제안 응답 목. 화면이 [확인]/[취소]를 띄운다. */
export const mockChatReplyShip: ChatReply = {
  reply: 'S-201 주문 6개를 출고할까요?',
  facts: { 'PRD-001.stock_qty': 10, 'S-201.sold_qty': 6 },
  proposed_action: { type: 'ship_sale', sale_id: 'S-201' },
  needs_confirmation: true,
  refused: null,
};

/** 챗봇 거부 응답 목. 재고 부족 등 허용 밖 요청. */
export const mockChatReplyRefused: ChatReply = {
  reply: '재고가 부족해서 출고할 수 없어요',
  facts: { 'PRD-003.stock_qty': 3 },
  proposed_action: null,
  needs_confirmation: false,
  refused: { reason: '재고가 부족해요. PRD-003 남은 수량 3개' },
};
