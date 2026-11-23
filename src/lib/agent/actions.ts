/**
 * 챗봇 허용 액션 — 검증 · 품목 다시 찾기 · 대화(chat) 처리 · 실행(execute).
 *
 * 하는 일
 * 1. `handleChat`: 사용자 JWT로 내 품목을 읽고 → LLM에게 '허용 액션 JSON 하나'만 받아(자료 · 지시 분리 프롬프트) →
 *    스키마로 검사 → 서버가 품목 · 주문 · 구매를 내 데이터에서 **다시 찾는다**(LLM이 준 sku_id를 믿지 않는다).
 *    조회 액션은 DB 값으로 바로 답하고, 변경 액션은 실행하지 않고 제안(`proposed_action` + 확인 필요)만 돌려준다.
 *    답 문장 · 수치는 LLM이 아니라 코드가 DB 값으로 만든다(`facts`에 출처). LLM 글은 어디에도 그대로 나가지 않는다.
 * 2. `executeAction`: 사람이 [확인]을 누른 뒤 불린다. 받은 액션을 **처음부터 다시** 검사(스키마 · 소유 · 재고)하고
 *    재고 함수(`pf_*`)만 부른다. `ship_quantity`는 직접출고 판매를 만들어 바로 출고한다(P-14, 금액 = 판매가 × 수량, 코드 계산).
 * 3. 서비스 키를 쓰지 않는다 — 항상 사용자 JWT 클라이언트(RLS가 남의 데이터를 막는다).
 *
 * 근거: docs/work-units/WU-34-chat.md · docs/04-api-contract.md 3.8 · docs/05-security.md 4절 · docs/02-decisions.md P-14
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple     자리 생성 (WU-01) — 구현은 skygaul WU-34
 * 2026-11-23  skygaul  처음 구현 — 허용 액션 검증 · 대화 · 실행 (WU-34)
 * 2026-11-23  skygaul  주문 · 구매 번호는 사용자 메시지에 있을 때만 제안 — 실제 Ollama가 인젝션 문장에서 번호를 지어냄 (WU-34)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fromSupabaseError, messageFor, PfError } from '@/lib/api/errors';
import { createSale, setPurchaseStatus, setSaleStatus, shipSale } from '@/lib/inventory';
import { generate, type LlmRequest, type LlmResponse } from '@/lib/llm';
import { log } from '@/lib/log';
import { LIMITS } from '@/lib/validation';
import { agentAction } from '@/lib/validation/schemas';
import { AGENT_ACTION_TYPES, type AgentAction, type ChatReply } from '@/types/agent';
import type { ServerErrorCode } from '@/types/erp';
import { buildChatPrompt } from './prompts/chat';

/** 챗봇이 읽는 품목 수 상한(프롬프트 · 조회 크기). */
const ITEM_LIMIT = 200;
/** 목록 답에 나열하는 품목 수 상한. */
const LIST_LIMIT = 10;
/** 직접출고 판매의 채널(P-14). */
const DIRECT_CHANNEL = '직접출고';

type Row = Record<string, unknown>;
type QueryResult = { data: Row[] | null; error: { message?: unknown; details?: unknown; code?: unknown } | null };

/** 챗봇이 쓰는 품목 한 줄. */
type ChatItem = { sku_id: string; item_name: string; stock_qty: number; safety_stock: number; sale_price: number };

/** `executeAction`의 결과. 화면은 이 중 알림에 필요한 값만 쓴다. */
export type ActionResult =
  | { type: 'get_stock'; sku_id: string; item_name: string; stock_qty: number; safety_stock: number }
  | { type: 'list_low_stock'; items: Array<{ sku_id: string; item_name: string; stock_qty: number; safety_stock: number }> }
  | { type: 'ship_quantity'; sale_id: string; sku_id: string; qty: number; stock_qty: number }
  | { type: 'ship_sale'; sale_id: string; stock_qty: number }
  | { type: 'set_sale_status'; sale_id: string; status: string }
  | { type: 'set_purchase_status'; purchase_id: string; status: string };

/** 조회 결과의 오류를 코드 · detail이 보존된 PfError로 옮긴다(모르는 오류는 PF_INTERNAL, 원문은 서버 로그에만). */
function rowsOf(result: QueryResult): Row[] {
  if (result.error) {
    const body = fromSupabaseError(result.error).body.error;
    throw new PfError(body.code as ServerErrorCode, body.detail ?? null);
  }
  return result.data ?? [];
}

function toItem(row: Row): ChatItem {
  return {
    sku_id: String(row.sku_id),
    item_name: String(row.item_name),
    stock_qty: Number(row.stock_qty),
    safety_stock: Number(row.safety_stock),
    sale_price: Number(row.sale_price),
  };
}

/** 내 품목 전체(RLS 범위). */
async function readItems(supabase: SupabaseClient): Promise<ChatItem[]> {
  const result = (await supabase
    .from('items')
    .select('sku_id,item_name,stock_qty,safety_stock,sale_price')
    .order('sku_id', { ascending: true })
    .limit(ITEM_LIMIT)) as unknown as QueryResult;
  return rowsOf(result).map(toItem);
}

/** 내 품목 하나(코드가 정확히 같은 것). 없으면 null. */
async function readItem(supabase: SupabaseClient, sku_id: string): Promise<ChatItem | null> {
  const result = (await supabase
    .from('items')
    .select('sku_id,item_name,stock_qty,safety_stock,sale_price')
    .eq('sku_id', sku_id)
    .limit(1)) as unknown as QueryResult;
  const row = rowsOf(result).find((r) => r.sku_id === sku_id);
  return row ? toItem(row) : null;
}

/**
 * 허용 액션 6개 검증(04 3.8). 허용 밖 type · 필드 누락 · 범위 밖 수량 · 모르는 필드 · 잘못된 번호 · 허용 밖 상태는 거부.
 * @returns 맞으면 `{ ok: true, action }`, 아니면 `{ ok: false, reason }`
 */
export function validateAction(value: unknown): { ok: true; action: AgentAction } | { ok: false; reason: string } {
  const checked = agentAction.safeParse(value);
  if (checked.success) return { ok: true, action: checked.data as AgentAction };
  return { ok: false, reason: 'not_allowed_value' };
}

/** 이름 · 코드 비교용: 공백 제거, 소문자. */
function normalize(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

/** `findItem` 결과. */
export type FindItemResult = { kind: 'found'; item: ChatItem } | { kind: 'none' } | { kind: 'many'; candidates: ChatItem[] };

/**
 * LLM이 준 품목 값(코드 또는 이름)을 **내 품목 목록에서** 다시 찾는다.
 * 순서: 코드 정확 일치 → 이름 정확 일치 → 이름 부분 일치(하나로 좁혀질 때만). 여럿이면 many, 없으면 none.
 */
export function findItem(items: readonly ChatItem[], ref: string): FindItemResult {
  const key = normalize(ref);
  if (key === '') return { kind: 'none' };

  const bySku = items.filter((item) => normalize(item.sku_id) === key);
  if (bySku.length === 1) return { kind: 'found', item: bySku[0]! };

  const exact = items.filter((item) => normalize(item.item_name) === key);
  if (exact.length === 1) return { kind: 'found', item: exact[0]! };
  if (exact.length > 1) return { kind: 'many', candidates: exact };

  const partial = items.filter((item) => normalize(item.item_name).includes(key));
  if (partial.length === 1) return { kind: 'found', item: partial[0]! };
  if (partial.length > 1) return { kind: 'many', candidates: partial };
  return { kind: 'none' };
}

/** LLM 응답 글자에서 JSON 객체 하나를 꺼낸다(코드 울타리 · 앞뒤 말 허용). 못 꺼내면 null. */
function extractObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const NOT_SUPPORTED = '그 요청은 도와드릴 수 없어요. 재고 조회 · 출고 · 주문 상태 변경 같은 정해진 작업만 할 수 있어요';

function refuse(reason: string): ChatReply {
  return { reply: reason, facts: {}, proposed_action: null, needs_confirmation: false, refused: { reason } };
}

/** 품목을 못 찾았을 때의 거부 문장. 여럿이면 후보 코드를 보여 준다. */
function refuseItem(found: Exclude<FindItemResult, { kind: 'found' }>): ChatReply {
  if (found.kind === 'many') {
    const names = found.candidates
      .slice(0, 5)
      .map((c) => `${c.item_name}(${c.sku_id})`)
      .join(', ');
    return refuse(`품목이 여러 개예요: ${names}. 어떤 품목인지 알려 주세요`);
  }
  return refuse('품목을 찾지 못했어요. 어떤 품목인지 알려 주세요');
}

function stockFacts(item: ChatItem): Record<string, number> {
  return { [`${item.sku_id}.stock_qty`]: item.stock_qty, [`${item.sku_id}.safety_stock`]: item.safety_stock };
}

/** 주문 · 구매 번호는 LLM이 지어낼 수 있으므로, 사용자가 쓴 메시지에 그 번호가 실제로 있을 때만 쓴다(공백 · 대소문자 무시). */
function mentions(message: string, id: string): boolean {
  return normalize(message).includes(normalize(id));
}

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

/** 내 판매 · 구매 한 건을 번호(S-201 · P-101) 또는 uuid로 찾는다. 없으면 null. */
async function readRef(
  supabase: SupabaseClient,
  table: 'sales' | 'purchases',
  ref: string,
): Promise<Row | null> {
  const humanColumn = table === 'sales' ? 'sale_id' : 'purchase_id';
  const column = isUuid(ref) ? 'id' : humanColumn;
  const select = table === 'sales' ? 'id,sale_id,sku_id,sold_qty,fulfillment_status' : 'id,purchase_id,sku_id,order_qty,status';
  const result = (await supabase.from(table).select(select).eq(column, ref).limit(1)) as unknown as QueryResult;
  return rowsOf(result).find((row) => row[column] === ref) ?? null;
}

export type HandleChatOptions = {
  /** LLM 호출. 기본은 src/lib/llm.ts `generate` */
  generateText?: (request: LlmRequest) => Promise<LlmResponse>;
};

/**
 * 사용자 메시지를 허용 액션으로 해석해 답한다. 읽기만 한다(어떤 변경도 하지 않는다).
 *
 * @param supabase 사용자 JWT 클라이언트(서비스 키 금지 — 원칙 3)
 * @param message 사용자 메시지(1~500자는 라우트 스키마가 검사)
 * @returns 조회는 DB 값으로 만든 답 + facts, 변경은 제안(확인 필요), 허용 밖 · 못 찾음 · 재고 부족은 refused
 * @throws PfError PF_LLM_UNAVAILABLE · PF_QUOTA_EXCEEDED(LLM) · PF_UNAUTHENTICATED · PF_INTERNAL(조회 실패) — 가짜 답을 만들지 않는다
 * 부작용: LLM 호출 상한(`pf_llm_take`)이 1 올라간다
 */
export async function handleChat(supabase: SupabaseClient, message: string, options: HandleChatOptions = {}): Promise<ChatReply> {
  const generateText = options.generateText ?? generate;
  const items = await readItems(supabase);

  const prompt = buildChatPrompt(message, items);
  const reply = await generateText({ ...prompt, json: true });

  const raw = extractObject(reply.text);
  const type = raw?.type;
  if (!raw || typeof type !== 'string' || !(AGENT_ACTION_TYPES as readonly string[]).includes(type)) return refuse(NOT_SUPPORTED);

  const str = (key: string): string => (typeof raw[key] === 'string' ? (raw[key] as string) : '');

  switch (type as AgentAction['type']) {
    case 'get_stock': {
      const found = findItem(items, str('sku_id'));
      if (found.kind !== 'found') return refuseItem(found);
      const { item } = found;
      return {
        reply: `${item.item_name}(${item.sku_id}) 재고는 ${item.stock_qty}개예요. 안전재고는 ${item.safety_stock}개예요`,
        facts: stockFacts(item),
        proposed_action: null,
        needs_confirmation: false,
        refused: null,
      };
    }

    case 'list_low_stock': {
      const low = items.filter((item) => item.stock_qty < item.safety_stock);
      if (low.length === 0) {
        return { reply: '안전재고 미만인 품목이 없어요', facts: {}, proposed_action: null, needs_confirmation: false, refused: null };
      }
      const shown = low.slice(0, LIST_LIMIT);
      const lines = shown.map((item) => `${item.item_name}(${item.sku_id}) ${item.stock_qty}개 / 안전재고 ${item.safety_stock}개`);
      const more = low.length > shown.length ? ` 외 ${low.length - shown.length}개` : '';
      return {
        reply: `안전재고 미만인 품목이 ${low.length}개 있어요: ${lines.join(', ')}${more}`,
        facts: Object.assign({}, ...shown.map(stockFacts)) as Record<string, number>,
        proposed_action: null,
        needs_confirmation: false,
        refused: null,
      };
    }

    case 'ship_quantity': {
      const found = findItem(items, str('sku_id'));
      if (found.kind !== 'found') return refuseItem(found);
      const { item } = found;
      const checked = validateAction({ type: 'ship_quantity', sku_id: item.sku_id, qty: raw.qty });
      if (!checked.ok || checked.action.type !== 'ship_quantity') {
        return refuse(`출고 수량을 ${LIMITS.qty.min} ~ ${LIMITS.qty.max.toLocaleString('ko-KR')} 사이 정수로 알려 주세요`);
      }
      const { qty } = checked.action;
      if (qty > item.stock_qty) {
        return refuse(messageFor('PF_INSUFFICIENT_STOCK', { sku_id: item.sku_id, stock_qty: item.stock_qty }));
      }
      return {
        reply: `${item.item_name}(${item.sku_id}) ${qty}개를 직접출고로 등록하고 바로 출고할까요? (현재 재고 ${item.stock_qty}개) [실행]을 눌러야 반영돼요`,
        facts: stockFacts(item),
        proposed_action: checked.action,
        needs_confirmation: true,
        refused: null,
      };
    }

    case 'ship_sale': {
      const checked = validateAction({ type: 'ship_sale', sale_id: str('sale_id') });
      if (!checked.ok || checked.action.type !== 'ship_sale' || !mentions(message, checked.action.sale_id)) {
        return refuse('주문 번호(예: S-201)를 알려 주세요');
      }
      const sale = await readRef(supabase, 'sales', checked.action.sale_id);
      if (!sale) return refuse(`${checked.action.sale_id} 주문을 찾지 못했어요`);
      return {
        reply: `주문 ${String(sale.sale_id)}(${String(sale.sku_id)} ${Number(sale.sold_qty)}개, 현재 ${String(sale.fulfillment_status)})를 출고할까요? [실행]을 눌러야 반영돼요`,
        facts: { [`${String(sale.sale_id)}.sold_qty`]: Number(sale.sold_qty) },
        proposed_action: { type: 'ship_sale', sale_id: String(sale.sale_id) },
        needs_confirmation: true,
        refused: null,
      };
    }

    case 'set_sale_status': {
      const checked = validateAction({ type: 'set_sale_status', sale_id: str('sale_id'), to: raw.to });
      if (!checked.ok || checked.action.type !== 'set_sale_status' || !mentions(message, checked.action.sale_id)) {
        return refuse('주문 번호(예: S-201)와 바꿀 상태(출고대기 · 주문취소)를 알려 주세요');
      }
      const sale = await readRef(supabase, 'sales', checked.action.sale_id);
      if (!sale) return refuse(`${checked.action.sale_id} 주문을 찾지 못했어요`);
      return {
        reply: `주문 ${String(sale.sale_id)}(현재 ${String(sale.fulfillment_status)})를 ${checked.action.to} 상태로 바꿀까요? [실행]을 눌러야 반영돼요`,
        facts: {},
        proposed_action: { type: 'set_sale_status', sale_id: String(sale.sale_id), to: checked.action.to },
        needs_confirmation: true,
        refused: null,
      };
    }

    case 'set_purchase_status': {
      const checked = validateAction({ type: 'set_purchase_status', purchase_id: str('purchase_id'), to: raw.to });
      if (!checked.ok || checked.action.type !== 'set_purchase_status' || !mentions(message, checked.action.purchase_id)) {
        return refuse('구매 번호(예: P-101)와 바꿀 상태(이동·통관중 · 품절 · 취소)를 알려 주세요');
      }
      const purchase = await readRef(supabase, 'purchases', checked.action.purchase_id);
      if (!purchase) return refuse(`${checked.action.purchase_id} 구매를 찾지 못했어요`);
      return {
        reply: `구매 ${String(purchase.purchase_id)}(현재 ${String(purchase.status)})를 ${checked.action.to} 상태로 바꿀까요? [실행]을 눌러야 반영돼요`,
        facts: {},
        proposed_action: { type: 'set_purchase_status', purchase_id: String(purchase.purchase_id), to: checked.action.to },
        needs_confirmation: true,
        refused: null,
      };
    }
  }
}

/**
 * 사람이 확인한 액션을 실행한다. 받은 액션을 **처음부터 다시** 검사하고(스키마 · 소유 · 재고) 재고 함수만 부른다.
 *
 * @param supabase 사용자 JWT 클라이언트
 * @param value 확인된 액션(라우트 스키마를 지났더라도 여기서 다시 검사한다)
 * @returns 알림에 쓸 결과(판매 · 구매 번호, 새 재고 등)
 * @throws PfError PF_VALIDATION(허용 밖 · 값 범위) · PF_NOT_FOUND(내 것이 아님) · PF_INSUFFICIENT_STOCK(남은 수량 detail) ·
 *         재고 함수가 던지는 코드(PF_INVALID_TRANSITION 등)
 * 부작용: ship_quantity는 직접출고 판매 1건을 만들고 출고한다. 출고가 거부되면 만든 판매를 주문취소로 되돌린다(기록은 지우지 않는다)
 */
export async function executeAction(supabase: SupabaseClient, value: unknown): Promise<{ result: ActionResult }> {
  const checked = validateAction(value);
  if (!checked.ok) throw new PfError('PF_VALIDATION', { field: 'action', reason: 'not_allowed_value' });
  const action = checked.action;

  switch (action.type) {
    case 'get_stock': {
      const item = await readItem(supabase, action.sku_id);
      if (!item) throw new PfError('PF_NOT_FOUND');
      return {
        result: { type: 'get_stock', sku_id: item.sku_id, item_name: item.item_name, stock_qty: item.stock_qty, safety_stock: item.safety_stock },
      };
    }

    case 'list_low_stock': {
      const low = (await readItems(supabase))
        .filter((item) => item.stock_qty < item.safety_stock)
        .map(({ sku_id, item_name, stock_qty, safety_stock }) => ({ sku_id, item_name, stock_qty, safety_stock }));
      return { result: { type: 'list_low_stock', items: low } };
    }

    case 'ship_quantity': {
      const item = await readItem(supabase, action.sku_id);
      if (!item) throw new PfError('PF_NOT_FOUND');
      // 재고 확인(1차): 판매를 만들기 전에 막는다. 출고 직전에 달라지면 아래에서 DB 함수가 다시 막는다(2차).
      if (action.qty > item.stock_qty) {
        throw new PfError('PF_INSUFFICIENT_STOCK', { sku_id: item.sku_id, stock_qty: item.stock_qty });
      }
      const amount = item.sale_price * action.qty;
      if (amount > LIMITS.money.max) {
        throw new PfError('PF_VALIDATION', { field: 'qty', reason: 'out_of_range', min: LIMITS.qty.min, max: LIMITS.qty.max });
      }
      const sale = await createSale(supabase, {
        sku_id: item.sku_id,
        channel: DIRECT_CHANNEL,
        sold_qty: action.qty,
        sale_amount: amount,
        invoice_no: null,
        source: 'agent',
      });
      try {
        const shipped = await shipSale(supabase, { id: sale.id });
        return { result: { type: 'ship_quantity', sale_id: sale.sale_id, sku_id: item.sku_id, qty: action.qty, stock_qty: shipped.stock_qty } };
      } catch (error) {
        // 출고가 거부되면 방금 만든 판매를 주문취소로 닫는다(남은 '주문접수' 건이 없게). 실패해도 원래 오류를 던진다.
        try {
          await setSaleStatus(supabase, { id: sale.id, to_status: '주문취소' });
        } catch (rollbackError) {
          log.error('agent.ship_rollback_failed', { code: rollbackError instanceof PfError ? rollbackError.code : 'unknown' });
        }
        throw error;
      }
    }

    case 'ship_sale': {
      const sale = await readRef(supabase, 'sales', action.sale_id);
      if (!sale) throw new PfError('PF_NOT_FOUND');
      const shipped = await shipSale(supabase, { id: String(sale.id) });
      return { result: { type: 'ship_sale', sale_id: String(sale.sale_id), stock_qty: shipped.stock_qty } };
    }

    case 'set_sale_status': {
      const sale = await readRef(supabase, 'sales', action.sale_id);
      if (!sale) throw new PfError('PF_NOT_FOUND');
      const updated = await setSaleStatus(supabase, { id: String(sale.id), to_status: action.to });
      return { result: { type: 'set_sale_status', sale_id: String(sale.sale_id), status: updated.fulfillment_status } };
    }

    case 'set_purchase_status': {
      const purchase = await readRef(supabase, 'purchases', action.purchase_id);
      if (!purchase) throw new PfError('PF_NOT_FOUND');
      const updated = await setPurchaseStatus(supabase, { id: String(purchase.id), to_status: action.to });
      return { result: { type: 'set_purchase_status', purchase_id: String(purchase.purchase_id), status: updated.status } };
    }
  }
}
