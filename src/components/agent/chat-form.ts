/**
 * 챗봇 패널의 순수 함수 — 보내기 가능 여부와 실행 결과 알림 문구.
 *
 * 하는 일
 * 1. `canSend`: 앞뒤 공백을 뺀 메시지가 1~500자일 때만 보낼 수 있다(04 4.2 · chatMessage와 같은 기준). 빈 · 공백만 → 보내기 버튼 잠김.
 * 2. `resultMessage`: `/execute` 결과(`unknown`)를 알림 한 줄로 바꾼다. 모양이 맞지 않으면 숫자를 지어내지 않고 일반 문구.
 *    결과의 값은 서버가 DB에서 읽은 값이다(LLM 글이 아니다).
 *
 * 근거: docs/work-units/WU-34-chat.md 6 · 다 됐다의 기준, docs/04-api-contract.md 3.8 · 4절
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  skygaul  처음 작성 — 보내기 가능 여부 · 실행 알림 문구 (WU-34)
 */

/** 메시지 글자 수 상한(04 3.8 chat 요청). */
export const MAX_CHAT_LENGTH = 500;

/** 보낼 수 있는 메시지인가: 앞뒤 공백을 뺀 글자 수가 1~500. */
export function canSend(text: string): boolean {
  const length = text.trim().length;
  return length >= 1 && length <= MAX_CHAT_LENGTH;
}

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => value !== null && typeof value === 'object' && !Array.isArray(value);

/** 실행 결과 → 알림 문구. 필요한 값이 문자열 · 숫자로 다 있을 때만 구체 문구, 아니면 '실행했어요'. */
export function resultMessage(result: unknown): string {
  const fallback = '실행했어요';
  if (!isRec(result)) return fallback;
  const s = (key: string) => (typeof result[key] === 'string' ? (result[key] as string) : null);
  const n = (key: string) => (typeof result[key] === 'number' ? (result[key] as number) : null);

  switch (result.type) {
    case 'ship_quantity': {
      const [sale, sku, qty, stock] = [s('sale_id'), s('sku_id'), n('qty'), n('stock_qty')];
      return sale && sku && qty !== null && stock !== null ? `${sku} ${qty}개를 출고했어요 (판매 ${sale}). 남은 재고는 ${stock}개예요` : fallback;
    }
    case 'ship_sale': {
      const [sale, stock] = [s('sale_id'), n('stock_qty')];
      return sale && stock !== null ? `주문 ${sale}을(를) 출고했어요. 남은 재고는 ${stock}개예요` : fallback;
    }
    case 'set_sale_status': {
      const [sale, status] = [s('sale_id'), s('status')];
      return sale && status ? `주문 ${sale}을(를) ${status} 상태로 바꿨어요` : fallback;
    }
    case 'set_purchase_status': {
      const [purchase, status] = [s('purchase_id'), s('status')];
      return purchase && status ? `구매 ${purchase}을(를) ${status} 상태로 바꿨어요` : fallback;
    }
    default:
      return fallback;
  }
}
