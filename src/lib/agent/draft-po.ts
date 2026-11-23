/**
 * 발주서 초안 만들기와 확정 — 조회 → 계산(코드) → 문안(LLM), 그리고 사람이 확인한 뒤의 구매 등록.
 *
 * 하는 일
 * 1. `createPoDraft`: 사용자 JWT 클라이언트로 품목 · 최근 7일 `실판매출고` 이력 · 구매를 읽고(RLS가 남의 데이터를 막는다),
 *    `reorder.ts`가 후보 · 추천 수량을 계산하고, LLM은 문안만 쓴다. DB에는 쓰지 않는다(원칙 4).
 * 2. 후보가 없으면 LLM을 부르지 않는다(호출 상한을 아낀다). LLM이 안 되거나 상한을 넘으면 문안만 null로
 *    두고 표는 그대로 준다(P-08) — 미리 써 둔 문안을 AI 결과처럼 보이지 않는다.
 * 3. `confirmPoLines`: 받은 줄을 처음부터 다시 검사한다 — 값 범위, 품목이 본인 것인지(RLS 조회).
 *    하나라도 남의 품목이면 아무것도 저장하지 않고 PF_NOT_FOUND. 통과하면 줄마다 `pf_create_purchase`(source "agent").
 *    LLM 문안은 저장에 쓰이지 않는다 — 저장은 사용자가 확인한 표 값만 쓴다.
 *
 * 근거: docs/04-api-contract.md 3.8 · docs/work-units/WU-33-draft-po.md · docs/02-decisions.md P-08 · 설계 원칙 3 · 4
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple     자리 생성 (WU-01) — 구현은 skygaul WU-33
 * 2026-11-23  skygaul  처음 구현 — 초안 만들기(조회 · 계산 · 문안) · 확정(재검증 · 구매 등록) (WU-33)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fromSupabaseError, messageFor, PfError } from '@/lib/api/errors';
import { getServerEnv, type LlmProviderSetting } from '@/lib/env-server';
import { createPurchase } from '@/lib/inventory';
import { generate, type LlmRequest, type LlmResponse } from '@/lib/llm';
import { kstDateString } from '@/lib/time';
import { LIMITS } from '@/lib/validation';
import type { LlmProvider, PoConfirmLine, PoDraft } from '@/types/agent';
import type { Purchase, ServerErrorCode } from '@/types/erp';
import { computeReorderCandidates, WINDOW_DAYS, type ReorderItem, type ReorderLog, type ReorderPurchase } from './reorder';
import { buildDraftPoPrompt } from './prompts/draft-po';

/** 문안 글자 수 상한. LLM이 길게 써도 패널 · 응답이 부풀지 않게 자른다. */
const MAX_MESSAGE_LENGTH = 2000;
/** 거래처를 찾으려고 읽는 최근 구매 수 상한. */
const PURCHASE_LOOKUP_LIMIT = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

type Row = Record<string, unknown>;
type QueryResult = { data: Row[] | null; error: { message?: unknown; details?: unknown; code?: unknown } | null };

/** 조회 결과의 오류를 코드 · detail이 보존된 PfError로 옮긴다(모르는 오류는 PF_INTERNAL, 원문은 서버 로그에만). */
function rowsOf(result: QueryResult): Row[] {
  if (result.error) {
    const body = fromSupabaseError(result.error).body.error;
    throw new PfError(body.code as ServerErrorCode, body.detail ?? null);
  }
  return result.data ?? [];
}

/** 계약(04 3.8)의 provider는 gemini · ollama뿐이다. fake(시험 전용)는 ollama로 적는다. */
function toDraftProvider(provider: LlmProviderSetting): LlmProvider {
  return provider === 'gemini' ? 'gemini' : 'ollama';
}

/** 지금 설정된 제공자. 환경변수가 틀려도 초안 표는 줄 수 있어야 하므로 오류는 삼키고 ollama로 둔다. */
function currentProvider(): LlmProvider {
  try {
    return toDraftProvider(getServerEnv().llmProvider);
  } catch {
    return 'ollama';
  }
}

export type CreatePoDraftOptions = {
  /** 초안 대상 품목코드. 없으면 품절 임박 전체 */
  skuIds?: readonly string[] | null;
  /** 지금 시각(7일 창 · 요청 납기 계산). 시험에서 고정한다 */
  now?: Date;
  /** LLM 호출. 기본은 src/lib/llm.ts `generate` */
  generateText?: (request: LlmRequest) => Promise<LlmResponse>;
  /** LLM 실패 · 후보 없음일 때 응답에 적을 제공자. 기본은 환경변수 설정 */
  provider?: LlmProvider;
};

/**
 * 발주서 초안을 만든다. 읽기만 한다(구매를 저장하지 않는다).
 *
 * @param supabase 사용자 JWT 클라이언트 (서비스 키 금지 — 원칙 3)
 * @returns 표(lines)는 항상 코드가 계산한 값, message는 LLM 문안(실패하면 null + llm_error)
 * @throws PfError PF_UNAUTHENTICATED · PF_INTERNAL(조회 실패) — LLM 오류와 상한 초과는 던지지 않고 llm_error로 돌려준다
 * 부작용: LLM을 부르면 호출 상한(`pf_llm_take`)이 1 올라간다
 */
export async function createPoDraft(supabase: SupabaseClient, options: CreatePoDraftOptions = {}): Promise<PoDraft> {
  const now = options.now ?? new Date();
  const skuIds = options.skuIds && options.skuIds.length > 0 ? [...options.skuIds] : null;
  const generateText = options.generateText ?? generate;

  const windowStart = new Date(now.getTime() - WINDOW_DAYS * DAY_MS).toISOString();

  let items = supabase.from('items').select('sku_id,item_name,unit_cost,stock_qty,safety_stock');
  let purchases = supabase.from('purchases').select('sku_id,supplier,order_qty,status,created_at');
  if (skuIds) {
    items = items.in('sku_id', skuIds);
    purchases = purchases.in('sku_id', skuIds);
  }
  const logs = supabase
    .from('stock_logs')
    .select('sku_id,change_qty,reason,created_at')
    .eq('reason', '실판매출고')
    .gte('created_at', windowStart);

  const [itemRows, logRows, purchaseRows] = await Promise.all([
    items as unknown as PromiseLike<QueryResult>,
    logs as unknown as PromiseLike<QueryResult>,
    purchases.order('created_at', { ascending: false }).limit(PURCHASE_LOOKUP_LIMIT) as unknown as PromiseLike<QueryResult>,
  ]);

  // 코드에서도 한 번 더 거른다(조회 필터가 빠져도 요청한 품목 밖은 표에 안 나오게)
  const wanted = (row: Row) => skuIds === null || skuIds.includes(String(row.sku_id));
  const lines = computeReorderCandidates({
    items: rowsOf(itemRows).filter(wanted) as unknown as ReorderItem[],
    logs: rowsOf(logRows) as unknown as ReorderLog[],
    purchases: rowsOf(purchaseRows) as unknown as ReorderPurchase[],
    now,
  });

  const fallbackProvider = options.provider ?? currentProvider();
  if (lines.length === 0) return { lines: [], message: null, llm_error: null, provider: fallbackProvider };

  try {
    const reply = await generateText(buildDraftPoPrompt(lines, { today: kstDateString(now) }));
    return {
      lines,
      message: reply.text.trim().slice(0, MAX_MESSAGE_LENGTH),
      llm_error: null,
      provider: toDraftProvider(reply.provider),
    };
  } catch (error) {
    // P-08: LLM 장애 · 상한 초과는 표를 그대로 주고 문안만 비운다. 다른 오류(로그인 · 내부)는 그대로 던진다.
    if (error instanceof PfError && (error.code === 'PF_LLM_UNAVAILABLE' || error.code === 'PF_QUOTA_EXCEEDED')) {
      return {
        lines,
        message: null,
        llm_error: { code: error.code, message: messageFor(error.code, error.detail) },
        provider: fallbackProvider,
      };
    }
    throw error;
  }
}

/** 한 줄의 값 범위를 다시 검사한다. 화면 · 라우트 스키마를 지나왔어도 DB에 가기 전에 한 번 더 막는다. */
function assertLine(line: PoConfirmLine): void {
  const { qty, money } = LIMITS;
  if (!Number.isInteger(line.order_qty) || line.order_qty < qty.min || line.order_qty > qty.max) {
    throw new PfError('PF_VALIDATION', { field: 'order_qty', reason: 'out_of_range', min: qty.min, max: qty.max });
  }
  if (!Number.isInteger(line.purchase_cost) || line.purchase_cost < money.min || line.purchase_cost > money.max) {
    throw new PfError('PF_VALIDATION', { field: 'purchase_cost', reason: 'out_of_range', min: money.min, max: money.max });
  }
}

/**
 * 사람이 확인한 발주서 줄을 구매로 등록한다(`source: "agent"`).
 *
 * 순서: 모든 줄 값 검사 → 품목이 모두 본인 것인지 확인(하나라도 아니면 아무것도 저장하지 않음) → 줄마다 등록.
 * 등록은 줄마다 DB 함수 한 번씩이라 중간 줄이 거부되면 앞 줄은 이미 저장돼 있다(함수 사이를 묶는 트랜잭션은 없다).
 *
 * @param supabase 사용자 JWT 클라이언트
 * @param lines 사용자가 고친 값(`poConfirm` 스키마를 지난 것). 문안(LLM)은 받지 않는다
 * @returns 만들어진 구매(발주완료), 입력 순서대로
 * @throws PfError PF_VALIDATION(값 범위) · PF_NOT_FOUND(남의 품목 · 없는 품목) · pf_create_purchase가 던지는 코드
 */
export async function confirmPoLines(supabase: SupabaseClient, lines: readonly PoConfirmLine[]): Promise<{ purchases: Purchase[] }> {
  for (const line of lines) assertLine(line);

  const skuIds = [...new Set(lines.map((line) => line.sku_id))];
  const owned = new Set(
    rowsOf((await supabase.from('items').select('sku_id').in('sku_id', skuIds)) as unknown as QueryResult).map((row) =>
      String(row.sku_id),
    ),
  );
  if (skuIds.some((sku_id) => !owned.has(sku_id))) throw new PfError('PF_NOT_FOUND');

  const purchases: Purchase[] = [];
  for (const line of lines) {
    purchases.push(
      await createPurchase(supabase, {
        sku_id: line.sku_id,
        supplier: line.supplier,
        order_qty: line.order_qty,
        purchase_cost: line.purchase_cost,
        invoice_no: null,
        source: 'agent',
      }),
    );
  }
  return { purchases };
}
