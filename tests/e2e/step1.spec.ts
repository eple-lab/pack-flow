/**
 * 화면 출고·부분 입고와 대시보드 갱신을 검증한다 (WU-22).
 * 구역: sorek-charlie
 * 2026-11-23  sorek-charlie  처음 작성 (WU-22)
 */
import { expect, test } from '@playwright/test';
import type { Dashboard } from '@/types/erp';
import { loadSeed } from '@/lib/seed';
import { loginViaUi, resetViaApi } from './helpers';

test('T-S1-1 · T-S1-2 출고 후 4개, 부분 입고 후 12개', async ({ page }) => {
  await loginViaUi(page, 'A');
  await resetViaApi(page, 'demo');
  await page.goto('/');
  const total = page.getByTestId('kpi-stock-total');
  const quantity = page.getByTestId('stock-qty-PRD-001');
  await expect(quantity).toHaveText('10');
  await expect(total).toHaveText(/^[\d,]+$/);
  const initialTotal = Number((await total.innerText()).replaceAll(',', ''));

  await page.goto('/trades');
  await page.getByTestId('tab-sale').click();
  await page.getByTestId('btn-ship-S-201').click();
  await expect(page.getByTestId('sale-row-S-201')).toContainText('출고완료');

  await page.goto('/');
  await expect(quantity).toHaveText('4');
  await expect(page.getByTestId('alert-card-PRD-001')).toBeVisible();
  await expect(total).toHaveText((initialTotal - 6).toLocaleString('ko-KR'));

  await page.goto('/trades');
  await page.getByTestId('tab-purchase').click();
  await page.getByTestId('btn-receive-P-101').click();
  await page.getByTestId('input-received-qty').fill('8');
  await page.getByTestId('btn-receive-confirm').click();
  await expect(page.getByTestId('purchase-row-P-101')).toContainText('입고완료');

  await page.goto('/');
  await expect(quantity).toHaveText('12');
  await expect(page.getByTestId('alert-card-PRD-001')).toHaveCount(0);
  await expect(total).toHaveText((initialTotal + 2).toLocaleString('ko-KR'));
});

for (const name of ['demo', 'small', 'large'] as const) {
  test(`T-S4-1 ${name} 초기화 뒤 대시보드 API가 정답과 일치한다`, async ({ page }) => {
    const { expected } = await loadSeed(name);
    if (!expected?.stock || !expected.kpi) throw new Error(`${name}: 손으로 계산한 expected가 필요합니다`);
    await loginViaUi(page, 'A');
    await resetViaApi(page, name);

    const response = await page.request.get('/api/dashboard');
    expect(response.ok()).toBe(true);
    const { data } = (await response.json()) as { data: Dashboard };
    const { item_count, stock_total, below_safety } = data.kpi;
    expect({ item_count, stock_total, below_safety }).toEqual(expected.kpi);
    expect(Object.fromEntries(data.items.map((item) => [item.sku_id, item.stock_qty]))).toEqual(expected.stock);
  });
}
