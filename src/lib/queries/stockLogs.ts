/**
 * 재고 이력 조회 쿼리 — 키셋 페이지네이션과 커서 인코드 · 디코드.
 *
 * 하는 일
 * 1. 커서는 (created_at, log_id)를 담은 불투명 base64url 문자열이다. 화면은 내용을 해석하지 않고 그대로 돌려보낸다.
 * 2. listStockLogs는 created_at 내림차순 → log_id 내림차순으로 limit+1건을 읽어 다음 페이지 유무를 판단한다.
 * 3. 커서 조건 (created_at, log_id) < (커서값)은 PostgREST `or` 필터로 만든다. 필터 문자열에는
 *    형식을 정규식으로 검증한 시각과 양의 정수 log_id만 넣는다(필터 주입 방지).
 * 4. 서버는 사용자 JWT 클라이언트가 넘어오는 대로만 쓴다(권한은 RLS, 원칙 3). Supabase 오류는 throwIfDbError로 PfError로 바꿔 던진다.
 *
 * 근거: docs/04-api-contract.md 3.5 · 4.3, docs/03-data-model.md 2절(stock_logs 인덱스), WU-41
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 재고 이력 키셋 페이지네이션 (WU-41)
 * 2026-11-23  eple  DB 오류 변환을 다른 쿼리와 같은 throwIfDbError로 통일 (WU-41)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PfError } from '@/lib/api/errors';
import type { StockLog, StockLogPage } from '@/types/erp';
import { throwIfDbError } from './throwIfDbError';

/** 커서에 담는 값. */
export type StockLogCursor = { created_at: string; log_id: number };

/** listStockLogs 입력. limit은 라우트 스키마(1~50)가 이미 검사했다. */
export type ListStockLogsParams = { sku_id?: string; limit: number; cursor?: string };

const COLUMNS = 'log_id, sku_id, change_qty, reason, ref_type, ref_id, created_at';

/** 커서가 틀렸을 때의 오류. reason은 4.3 목록의 bad_format만 쓴다(새 사유를 만들지 않는다). */
function badCursor(): PfError {
  return new PfError('PF_VALIDATION', { field: 'cursor', reason: 'bad_format' });
}

/**
 * 시각 문자열을 `YYYY-MM-DDTHH:MM:SS[.ffffff]Z` 모양으로 맞춘다(마이크로초 보존 — Date를 거치면 잘려 같은 시각 비교가 어긋난다).
 * UTC(`Z` 또는 `+00:00`)만 받는다. 모양이나 날짜가 틀리면 null.
 */
function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d{1,6})?(?:Z|\+00(?::?00)?)$/.exec(value);
  if (!m) return null;
  const base = `${m[1]}T${m[2]}Z`;
  const parsed = new Date(base);
  // 2026-02-31 같은 없는 날짜는 Date가 넘겨 계산하므로 되돌려 비교한다
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 19) !== `${m[1]}T${m[2]}`) return null;
  return `${m[1]}T${m[2]}${m[3] ?? ''}Z`;
}

/**
 * 커서를 만든다(url-safe base64 of JSON).
 * @throws PfError PF_VALIDATION — 시각 · log_id가 올바르지 않을 때(서버 내부 값이 깨진 경우)
 */
export function encodeCursor(cursor: StockLogCursor): string {
  const created_at = normalizeTimestamp(cursor.created_at);
  if (created_at === null || !Number.isSafeInteger(cursor.log_id) || cursor.log_id <= 0) throw badCursor();
  return Buffer.from(JSON.stringify({ created_at, log_id: cursor.log_id }), 'utf8').toString('base64url');
}

/**
 * 커서를 푼다. base64url이 아니거나, JSON이 아니거나, 필드 모양 · 시각 · log_id가 틀리면 모두 같은 오류.
 * @throws PfError PF_VALIDATION `{ field: 'cursor', reason: 'bad_format' }`
 */
export function decodeCursor(cursor: string): StockLogCursor {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw badCursor();
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw badCursor();
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw badCursor();
  const { created_at, log_id } = parsed as Record<string, unknown>;
  const normalized = normalizeTimestamp(created_at);
  if (normalized === null || typeof log_id !== 'number' || !Number.isSafeInteger(log_id) || log_id <= 0) throw badCursor();
  return { created_at: normalized, log_id };
}

/**
 * 재고 이력을 최근순으로 limit건 읽는다(키셋 페이지네이션).
 * 왜 키셋: 이력이 계속 쌓여도 페이지 사이에 중복 · 누락이 없고 (user_id, created_at, log_id) 인덱스를 탄다.
 * @throws PfError PF_VALIDATION(커서 오류) · Supabase 오류 모양(handler가 코드로 변환)
 */
export async function listStockLogs(supabase: SupabaseClient, params: ListStockLogsParams): Promise<StockLogPage> {
  const { sku_id, limit, cursor } = params;
  // 커서는 DB를 부르기 전에 검사한다
  const after = cursor !== undefined ? decodeCursor(cursor) : null;

  let query = supabase.from('stock_logs').select(COLUMNS);
  if (sku_id !== undefined) query = query.eq('sku_id', sku_id);
  if (after) {
    query = query.or(`created_at.lt.${after.created_at},and(created_at.eq.${after.created_at},log_id.lt.${after.log_id})`);
  }
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('log_id', { ascending: false })
    .limit(limit + 1);
  throwIfDbError(error);

  const fetched = (data ?? []) as StockLog[];
  const hasMore = fetched.length > limit;
  const rows = hasMore ? fetched.slice(0, limit) : fetched;
  const last = rows[rows.length - 1];
  return { rows, next_cursor: hasMore && last ? encodeCursor({ created_at: last.created_at, log_id: last.log_id }) : null };
}

