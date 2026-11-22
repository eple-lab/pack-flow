/**
 * 시드 로더 — 이름(demo · small · large)으로 JSON 시드를 읽고 형식을 검사한다.
 *
 * 하는 일
 * 1. `loadSeed('demo')`가 같은 폴더의 `demo.json`을(LOADERS 표로) 불러와 zod로 검사한 뒤 돌려준다. 형식이 깨졌거나 파일이 없으면 분명한 오류(SeedError).
 * 2. 검사 내용: 03 7절 형식(items · purchases · sales · events · expected) + 교차 확인(구매 · 판매 · 이벤트가 있는 품목 · 번호를 가리키는지,
 *    번호 중복 없음, 재고에 영향 주는 상태는 시드 행에 넣지 않고 events로 만든다 — DB 함수 pf_reset_and_seed와 같은 규칙).
 * 3. JSON에는 주석을 달 수 없어 데이터 설명은 여기에 적는다:
 *    - demo.json = 계획서 7절 예시(PRD-001~003 · P-101 · S-201 · S-202). 완료 테스트 1 · 2가 바로 이어진다. 데이터 주인은 sorek-charlie(이후 8~12개로 늘림).
 *    - small.json · large.json = Step 4 정답표 · 응답 시간용. sorek-charlie가 만든다(지금은 없다 — 부르면 "아직 없어요" 오류).
 *    - `initial_qty`는 `재고조정` 이력으로 들어간다. `events`는 재고 함수로 실행된다. `expected`는 손으로 구한 정답이다(검산 기준).
 * 4. 서버(`POST /api/seed`)와 테스트 도우미(tests/db/helpers.ts)가 같은 로더를 쓴다. 실제 거래처명 · 매출을 넣지 않는다(가상 데이터만).
 *
 * 근거: docs/03-data-model.md 7절, docs/work-units/WU-00-skeleton.md WU-08 5번, docs/04-api-contract.md 3.7
 * 구역: eple(로더) — 데이터 주인은 sorek-charlie (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 시드 로더 · 형식 검사 · demo (WU-08)
 */
import { z } from 'zod';
import { SEED_DATASETS, type SeedDataset } from '@/types/erp';

/** 시드를 못 읽거나 형식이 틀릴 때 던진다. 메시지에 어느 시드의 어느 칸인지 적는다. */
export class SeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeedError';
  }
}

const sku = z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,19}$/, '품목코드 형식(예 PRD-001)');
const money = z.number().int().min(0).max(1_000_000_000);
const qty = z.number().int().min(1).max(100_000);
const text = (max: number) => z.string().trim().min(1).max(max);
const invoice = z.string().regex(/^[A-Za-z0-9_-]{1,50}$/).nullable().optional();

const item = z.strictObject({
  sku_id: sku,
  item_name: text(100),
  source_url: z.string().trim().min(1).max(500).nullable().optional(),
  unit_cost: money,
  sale_price: money,
  initial_qty: z.number().int().min(0).max(100_000),
  safety_stock: z.number().int().min(0).max(100_000),
});

/** 시드 구매 행의 상태는 재고에 영향이 없는 것만(입고완료 · 입고취소는 events). */
const purchase = z.strictObject({
  purchase_id: z.string().regex(/^P-[0-9]{1,9}$/),
  sku_id: sku,
  supplier: text(50),
  order_qty: qty,
  purchase_cost: money,
  status: z.enum(['발주완료', '이동·통관중', '품절', '취소']).optional(),
  invoice_no: invoice,
});

/** 시드 판매 행의 상태는 재고에 영향이 없는 것만(출고완료 · 출고취소는 events). */
const sale = z.strictObject({
  sale_id: z.string().regex(/^S-[0-9]{1,9}$/),
  sku_id: sku,
  channel: text(30),
  sold_qty: qty,
  sale_amount: money,
  fulfillment_status: z.enum(['주문접수', '출고대기', '주문취소']).optional(),
  invoice_no: invoice,
});

/** 재고 함수로 실행할 사건. pf_reset_and_seed가 알아듣는 op와 같다. */
const event = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('receive'), purchase_id: z.string(), received_qty: qty }),
  z.strictObject({ op: z.literal('cancel_receipt'), purchase_id: z.string() }),
  z.strictObject({ op: z.literal('purchase_status'), purchase_id: z.string(), to: z.enum(['이동·통관중', '품절', '취소']) }),
  z.strictObject({ op: z.literal('ship'), sale_id: z.string() }),
  z.strictObject({ op: z.literal('cancel_shipment'), sale_id: z.string() }),
  z.strictObject({ op: z.literal('sale_status'), sale_id: z.string(), to: z.enum(['출고대기', '주문취소']) }),
]);

const expected = z.strictObject({
  kpi: z.strictObject({ item_count: z.number().int(), stock_total: z.number().int(), below_safety: z.number().int() }).partial().optional(),
  stock: z.record(z.string(), z.number().int()).optional(),
});

/** 시드 JSON의 형식(03 7절). */
export const seedSchema = z.strictObject({
  items: z.array(item),
  purchases: z.array(purchase).default([]),
  sales: z.array(sale).default([]),
  events: z.array(event).default([]),
  expected: expected.optional(),
});

/** 검사를 통과한 시드. */
export type SeedData = z.output<typeof seedSchema>;

/** 같은 값이 두 번 나오면 그 값을 돌려준다. */
function firstDuplicate(values: string[]): string | null {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) return v;
    seen.add(v);
  }
  return null;
}

/**
 * 시드 데이터를 검사한다(형식 + 교차 확인).
 * @param raw JSON으로 읽은 값
 * @param label 오류 메시지에 붙일 이름(예: 'demo')
 * @throws SeedError 형식이 틀리거나 가리키는 대상이 없거나 번호가 겹칠 때
 */
export function parseSeed(raw: unknown, label = '시드'): SeedData {
  const result = seedSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue && issue.path.length > 0 ? issue.path.join('.') : '(최상위)';
    throw new SeedError(`${label} 형식 오류 — ${where}: ${issue?.message ?? '알 수 없음'}`);
  }
  const data = result.data;

  const dupSku = firstDuplicate(data.items.map((i) => i.sku_id));
  if (dupSku) throw new SeedError(`${label} 형식 오류 — items: 품목코드 ${dupSku}가 두 번 나와요`);
  const dupP = firstDuplicate(data.purchases.map((p) => p.purchase_id));
  if (dupP) throw new SeedError(`${label} 형식 오류 — purchases: ${dupP}가 두 번 나와요`);
  const dupS = firstDuplicate(data.sales.map((s) => s.sale_id));
  if (dupS) throw new SeedError(`${label} 형식 오류 — sales: ${dupS}가 두 번 나와요`);

  const skus = new Set(data.items.map((i) => i.sku_id));
  for (const p of data.purchases) {
    if (!skus.has(p.sku_id)) throw new SeedError(`${label} 형식 오류 — purchases ${p.purchase_id}: 없는 품목 ${p.sku_id}`);
  }
  for (const s of data.sales) {
    if (!skus.has(s.sku_id)) throw new SeedError(`${label} 형식 오류 — sales ${s.sale_id}: 없는 품목 ${s.sku_id}`);
  }

  const purchaseIds = new Set(data.purchases.map((p) => p.purchase_id));
  const saleIds = new Set(data.sales.map((s) => s.sale_id));
  data.events.forEach((e, index) => {
    const ref = 'purchase_id' in e ? purchaseIds.has(e.purchase_id) : saleIds.has(e.sale_id);
    if (!ref) throw new SeedError(`${label} 형식 오류 — events.${index}: 가리키는 구매 · 판매가 없어요`);
  });
  return data;
}

/** 이름이 시드 벌 이름(demo · small · large)인가. */
export function isSeedName(value: unknown): value is SeedDataset {
  return typeof value === 'string' && (SEED_DATASETS as readonly string[]).includes(value);
}

/**
 * 이름 → JSON 불러오기. 파일마다 글자 그대로 import해야 Next 번들러가 파일을 포함한다(변수로 만든 경로는 번들에 안 들어간다).
 * small.json · large.json을 만들면 아래에 한 줄씩 더한다:
 *   small: () => import('./small.json'),
 *   large: () => import('./large.json'),
 * (그리고 seed.test.ts의 'S4-4' 시험에서 해당 이름을 뺀다.)
 */
const LOADERS: Partial<Record<SeedDataset, () => Promise<{ default: unknown }>>> = {
  demo: () => import('./demo.json'),
};

/**
 * 이름으로 시드를 읽어 검사한다.
 * @param name 'demo' | 'small' | 'large'
 * @throws SeedError 모르는 이름 · 파일이 아직 없음(small · large는 sorek-charlie가 만든다) · 형식 오류
 */
export async function loadSeed(name: string): Promise<SeedData> {
  if (!isSeedName(name)) {
    throw new SeedError(`모르는 시드 이름이에요: ${String(name).slice(0, 20)} (demo · small · large 중 하나)`);
  }
  const loader = LOADERS[name];
  if (!loader) {
    throw new SeedError(`시드 ${name}.json이 아직 없어요 (src/lib/seed/${name}.json — 데이터 주인 sorek-charlie)`);
  }
  const raw = (await loader()).default;
  return parseSeed(raw, name);
}
