/**
 * DB 없이 시드 사건을 재생해 사람이 작성한 정답표를 검산한다 (WU-22).
 * 실행: node --test tests/regression/seed-expected.test.ts
 * 구역: sorek-charlie
 * 2026-11-23  sorek-charlie  처음 작성 (WU-22)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SeedData } from '../../src/lib/seed/index.ts';

for (const [name, itemCount, logCount] of [
  ['demo', 8, 8], ['small', 5, 20], ['large', 10, 50],
] as const) {
  const seed = JSON.parse(readFileSync(new URL(`../../src/lib/seed/${name}.json`, import.meta.url), 'utf8')) as SeedData;

  test(`C-01 ${name} 시드의 규모와 입출고 이력`, () => {
    assert.equal(seed.items.length, itemCount);
    assert.equal(seed.items.filter((item) => item.initial_qty > 0).length + seed.events.length, logCount);
  });

  test(`T-S4-1 ${name} 시드 사건의 결과가 수기 정답과 일치한다`, () => {
    const expected = seed.expected;
    assert.ok(expected?.stock && expected.kpi, `${name}: 손으로 계산한 expected가 필요합니다`);
    const stock = Object.fromEntries(seed.items.map((item) => [item.sku_id, item.initial_qty]));

    for (const event of seed.events) {
      switch (event.op) {
        case 'receive': {
          const purchase = seed.purchases.find((row) => row.purchase_id === event.purchase_id);
          assert.ok(purchase);
          assert.ok(event.received_qty <= purchase.order_qty);
          stock[purchase.sku_id] += event.received_qty;
          break;
        }
        case 'ship': {
          const sale = seed.sales.find((row) => row.sale_id === event.sale_id);
          assert.ok(sale);
          stock[sale.sku_id] -= sale.sold_qty;
          assert.ok(stock[sale.sku_id] >= 0);
          break;
        }
        default:
          assert.fail(`검산에 지원하지 않는 시드 사건: ${event.op}`);
      }
    }

    assert.deepEqual(stock, expected.stock);
    assert.deepEqual({
      item_count: seed.items.length,
      stock_total: Object.values(stock).reduce((total, count) => total + count, 0),
      below_safety: seed.items.filter((item) => stock[item.sku_id] < item.safety_stock).length,
    }, expected.kpi);
  });
}
