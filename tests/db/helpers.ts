/**
 * DB 시험 도우미 — 테스트 계정 로그인, 초기화 · 시드, 불변식 검산, 품목 만들기.
 *
 * 하는 일
 * 1. signIn('A' | 'B')로 사용자 JWT 클라이언트를 얻는다. 서비스 키는 읽지도 쓰지도 않는다(D-20).
 * 2. resetAndSeed는 재고 함수 래퍼(src/lib/inventory.ts)를 통해서만 DB를 부른다.
 * 3. checkInvariants는 순수 함수다(DB 없이 시험 가능). assertInvariants는 사용자 클라이언트로 읽어 검산한다.
 * 4. 환경변수 이름만 쓴다. 키 · 비밀번호 · 이메일 값은 코드 · 오류 메시지 어디에도 넣지 않는다.
 *
 * 근거: docs/work-units/WU-00-skeleton.md WU-08 · docs/03-data-model.md 6절 · docs/07-test-strategy.md
 * 구역: eple (docs/06-work-plan.md 1절 '테스트 기반')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 로그인 · 초기화 · 불변식 검산 · 품목 도우미 (WU-08)
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createItem, resetAndSeed as rpcResetAndSeed } from '@/lib/inventory';
import type { Item, SeedDataset, SeedResult } from '@/types/erp';

/** 공개 주소 · 공개 키 환경변수 이름(값은 여기 없다). 테스트 계정 이름 두 쌍과 합쳐 여섯 개를 검사한다. */
const SUPABASE_ENV_NAMES = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

/** 저장소 루트의 .env.local을 한 번 읽는다. 없으면 아무것도 하지 않는다. */
export function loadLocalEnv(): void {
  // 이 파일은 tests/db/ 에 있으므로 두 단계 위가 저장소 루트다.
  const file = fileURLToPath(new URL('../../.env.local', import.meta.url));
  if (!existsSync(file)) return;
  try {
    // Node 24: 이미 설정된 환경변수는 덮어쓰지 않는다(빈 문자열로 설정된 값도 그대로 둔다).
    process.loadEnvFile(file);
  } catch {
    // 형식이 깨졌으면 무시한다. 빠진 값은 signIn이 변수 이름으로 알려 준다.
  }
}

/**
 * 테스트 계정 A 또는 B로 로그인해 사용자 JWT 클라이언트를 돌려준다.
 * 던지는 오류: Error — 환경변수가 비면 빠진 이름 전부, 로그인이 실패하면 계정 표시만(이메일 · 비밀번호 없음).
 * 부작용: 없음(세션을 저장하지 않는다).
 */
export async function signIn(which: 'A' | 'B'): Promise<SupabaseClient> {
  loadLocalEnv();

  const emailName = `TEST_USER_${which}_EMAIL`;
  const passwordName = `TEST_USER_${which}_PASSWORD`;
  const names = [...SUPABASE_ENV_NAMES, emailName, passwordName];
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`환경변수가 비어 있습니다: ${missing.join(', ')}. .env.local을 채우세요(.env.example 참고).`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();
  const email = process.env[emailName]!.trim();
  const password = process.env[passwordName]!;

  // 사용자 JWT 클라이언트다. 세션을 디스크 · 브라우저에 남기지 않는다.
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`테스트 계정 ${which} 로그인 실패`);
  }
  return client;
}

/**
 * 데이터를 전부 비우고 넣는다(본인 데이터만, pf_reset_and_seed). 건수를 돌려준다.
 * source가 문자열이면 src/lib/seed의 loadSeed로 읽고, 객체면 그대로 넘긴다.
 * 던지는 오류: 재고 래퍼의 PfError(함수가 stub이면 PF_NOT_IMPLEMENTED), 시드 이름 오류(loadSeed).
 * 주석: 시드 모듈은 호출할 때만 불러온다(import 시점에 파일을 읽지 않으려고).
 */
export async function resetAndSeed(
  client: SupabaseClient,
  source: SeedDataset | Record<string, unknown>,
): Promise<SeedResult> {
  let data: Record<string, unknown>;
  if (typeof source === 'string') {
    const { loadSeed } = await import('@/lib/seed');
    data = (await loadSeed(source)) as unknown as Record<string, unknown>;
  } else {
    data = source;
  }
  return rpcResetAndSeed(client, { data });
}

/** checkInvariants가 읽는 스냅샷 모양(검산 쿼리 결과와 같다). */
export type InvariantSnapshot = {
  items: { sku_id: string; stock_qty: number }[];
  stock_logs: { sku_id: string; change_qty: number; reason: string; ref_id: string | null }[];
  purchases: { purchase_id: string; status: string }[];
  sales: { sale_id: string; fulfillment_status: string }[];
};

/** 구매 · 판매의 입고 · 출고 기록 사유 묶음. T-INV-3 · 4에서 쓴다. */
const PURCHASE_LOG = { in: '구매입고', cancel: '입고취소' } as const;
const SALE_LOG = { out: '실판매출고', cancel: '출고취소' } as const;

/**
 * 03 6절 불변식 T-INV-1~4 검산(순수 함수). 위반 문장 목록을 돌려준다. 없으면 [].
 * 각 문장은 규칙 번호(T-INV-n)와 대상 번호(품목 · 구매 · 판매)를 담는다.
 */
export function checkInvariants(snapshot: InvariantSnapshot): string[] {
  const violations: string[] = [];

  // T-INV-1 · T-INV-2: 품목별 이력 합 = 재고, 재고 ≥ 0
  const logSum = new Map<string, number>();
  for (const log of snapshot.stock_logs) {
    logSum.set(log.sku_id, (logSum.get(log.sku_id) ?? 0) + log.change_qty);
  }
  const stockBySku = new Map<string, number>();
  for (const item of snapshot.items) {
    stockBySku.set(item.sku_id, item.stock_qty);
  }
  const allSkus = new Set([...stockBySku.keys(), ...logSum.keys()]);
  for (const sku of allSkus) {
    const stock = stockBySku.get(sku);
    const sum = logSum.get(sku) ?? 0;
    if (stock === undefined) {
      violations.push(`T-INV-1 품목 ${sku}: 품목 행이 없는데 이력 합 ${sum}`);
    } else if (stock !== sum) {
      violations.push(`T-INV-1 품목 ${sku}: 재고 ${stock}, 이력 합 ${sum}`);
    }
  }
  for (const item of snapshot.items) {
    if (item.stock_qty < 0) {
      violations.push(`T-INV-2 품목 ${item.sku_id}: 재고 ${item.stock_qty} (0 미만)`);
    }
  }

  // T-INV-3: 구매 상태별 입고 기록 개수
  for (const purchase of snapshot.purchases) {
    const logs = snapshot.stock_logs.filter((log) => log.ref_id === purchase.purchase_id);
    const countIn = logs.filter((log) => log.reason === PURCHASE_LOG.in).length;
    const countCancel = logs.filter((log) => log.reason === PURCHASE_LOG.cancel).length;
    const id = purchase.purchase_id;
    const status = purchase.status;
    if (status === '입고완료') {
      if (countIn !== 1) violations.push(`T-INV-3 구매 ${id}(${status}): 구매입고 기록 ${countIn}개 (1개여야 함)`);
      if (countCancel !== 0) violations.push(`T-INV-3 구매 ${id}(${status}): 입고취소 기록 ${countCancel}개 (0개여야 함)`);
    } else if (status === '입고취소') {
      if (countIn !== 1) violations.push(`T-INV-3 구매 ${id}(${status}): 구매입고 기록 ${countIn}개 (1개여야 함)`);
      if (countCancel !== 1) violations.push(`T-INV-3 구매 ${id}(${status}): 입고취소 기록 ${countCancel}개 (1개여야 함)`);
    } else if (countIn + countCancel !== 0) {
      violations.push(`T-INV-3 구매 ${id}(${status}): 입고 관련 기록 ${countIn + countCancel}개 (0개여야 함)`);
    }
  }

  // T-INV-4: 판매 상태별 출고 기록 개수
  for (const sale of snapshot.sales) {
    const logs = snapshot.stock_logs.filter((log) => log.ref_id === sale.sale_id);
    const countOut = logs.filter((log) => log.reason === SALE_LOG.out).length;
    const countCancel = logs.filter((log) => log.reason === SALE_LOG.cancel).length;
    const id = sale.sale_id;
    const status = sale.fulfillment_status;
    if (status === '출고완료') {
      if (countOut !== 1) violations.push(`T-INV-4 판매 ${id}(${status}): 실판매출고 기록 ${countOut}개 (1개여야 함)`);
      if (countCancel !== 0) violations.push(`T-INV-4 판매 ${id}(${status}): 출고취소 기록 ${countCancel}개 (0개여야 함)`);
    } else if (status === '출고취소') {
      if (countOut !== 1) violations.push(`T-INV-4 판매 ${id}(${status}): 실판매출고 기록 ${countOut}개 (1개여야 함)`);
      if (countCancel !== 1) violations.push(`T-INV-4 판매 ${id}(${status}): 출고취소 기록 ${countCancel}개 (1개여야 함)`);
    } else if (countOut + countCancel !== 0) {
      violations.push(`T-INV-4 판매 ${id}(${status}): 출고 관련 기록 ${countOut + countCancel}개 (0개여야 함)`);
    }
  }

  return violations;
}

/**
 * 사용자 클라이언트로 네 표를 읽어 검산한다. 위반이 있으면 줄바꿈으로 이은 Error를 던진다.
 * 던지는 오류: Error(읽기 실패 · 위반 목록). 읽기 한도: PostgREST 기본 1000행 — 시험 데이터는 이보다 작다.
 */
export async function assertInvariants(client: SupabaseClient): Promise<void> {
  const [items, logs, purchases, sales] = await Promise.all([
    client.from('items').select('sku_id, stock_qty'),
    client.from('stock_logs').select('sku_id, change_qty, reason, ref_id'),
    client.from('purchases').select('purchase_id, status'),
    client.from('sales').select('sale_id, fulfillment_status'),
  ]);
  const results = { items, stock_logs: logs, purchases, sales };
  for (const [table, result] of Object.entries(results)) {
    if (result.error) {
      throw new Error(`검산 읽기 실패 (${table}): ${result.error.message}`);
    }
  }

  const violations = checkInvariants({
    items: (items.data ?? []) as InvariantSnapshot['items'],
    stock_logs: (logs.data ?? []) as InvariantSnapshot['stock_logs'],
    purchases: (purchases.data ?? []) as InvariantSnapshot['purchases'],
    sales: (sales.data ?? []) as InvariantSnapshot['sales'],
  });
  if (violations.length > 0) {
    throw new Error(violations.join('\n'));
  }
}

/**
 * 테스트용 품목을 하나 만든다(재고 0). 기본값: sku_id TST-<6자리 난수>, 이름 '테스트 품목'.
 * 던지는 오류: PfError — 재고 함수가 아직 stub이면 PF_NOT_IMPLEMENTED가 그대로 올라온다.
 */
export async function makeItem(
  client: SupabaseClient,
  overrides: Partial<{
    sku_id: string;
    item_name: string;
    unit_cost: number;
    sale_price: number;
    safety_stock: number;
    source_url: string | null;
  }> = {},
): Promise<Item> {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return createItem(client, {
    sku_id: `TST-${digits}`,
    item_name: '테스트 품목',
    unit_cost: 1000,
    sale_price: 2000,
    safety_stock: 0,
    source_url: null,
    ...overrides,
  });
}
