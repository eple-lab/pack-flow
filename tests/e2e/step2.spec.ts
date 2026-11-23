/**
 * 재로그인 뒤 재고 보존, 계정 격리, 세션 만료 복귀 경로를 검증한다 (WU-22).
 * 구역: sorek-charlie
 * 2026-11-23  sorek-charlie  처음 작성 (WU-22)
 */
import { expect, test } from '@playwright/test';
import type { Dashboard, Purchase } from '@/types/erp';
import { loginViaUi, resetViaApi } from './helpers';

test('T-AUTH 재로그인 뒤 A 재고가 유지되고 B에는 표시되지 않는다', async ({ browser, page }) => {
  await loginViaUi(page, 'A');
  await resetViaApi(page, 'demo');
  await page.goto('/trades');
  await page.getByTestId('tab-sale').click();
  await page.getByTestId('btn-ship-S-201').click();
  await expect(page.getByTestId('sale-row-S-201')).toContainText('출고완료');

  await page.getByTestId('btn-logout').click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await loginViaUi(page, 'A');
  await page.goto('/');
  await expect(page.getByTestId('stock-qty-PRD-001')).toHaveText('4');

  const origin = new URL(page.url()).origin;
  const purchasesUrl = new URL('/api/purchases', origin).toString();
  const purchasesResponse = await page.request.get(purchasesUrl);
  expect(purchasesResponse.ok()).toBe(true);
  const purchases = (await purchasesResponse.json()) as { data: Purchase[] };
  const purchase = purchases.data.find((row) => row.purchase_id === 'P-101');
  if (!purchase) throw new Error('계정 A의 시드 구매 P-101을 찾지 못했습니다');

  const accountB = await browser.newContext();
  try {
    const other = await accountB.newPage();
    await loginViaUi(other, 'B');
    await resetViaApi(other, 'small');
    const response = await other.request.get(new URL('/api/dashboard', other.url()).toString());
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as { data: Dashboard };
    expect(body.data.items.map((item) => item.sku_id)).not.toContain('PRD-001');
    const otherPurchasesResponse = await other.request.get(purchasesUrl);
    expect(otherPurchasesResponse.ok()).toBe(true);
    const otherPurchases = (await otherPurchasesResponse.json()) as { data: Purchase[] };
    expect(otherPurchases.data.map((row) => row.id)).not.toContain(purchase.id);

    const denied = await other.request.post(new URL(`/api/purchases/${purchase.id}/receive`, origin).toString(), {
      headers: { 'X-PF': '1', Origin: origin },
      data: { received_qty: 8 },
    });
    expect(denied.status()).toBe(404);
    expect(await denied.json()).toMatchObject({ error: { code: 'PF_NOT_FOUND' } });
    await other.reload();
    await expect(other.getByTestId('kpi-item-count')).toHaveText(/^[\d,]+$/);
    await expect(other.getByTestId('stock-row-PRD-001')).toHaveCount(0);
  } finally {
    await accountB.close();
  }
  const afterResponse = await page.request.get(purchasesUrl);
  expect(afterResponse.ok()).toBe(true);
  const after = (await afterResponse.json()) as { data: Purchase[] };
  expect(after.data.find((row) => row.id === purchase.id)).toEqual(purchase);
  await page.reload();
  await expect(page.getByTestId('stock-qty-PRD-001')).toHaveText('4');
});

test('T-VAL-6 출고 시 세션이 없으면 로그인 후 거래 화면으로 복귀한다', async ({ context, page }) => {
  await loginViaUi(page, 'A');
  await resetViaApi(page, 'demo');
  const trades = '/trades?tab=sale';
  await page.goto(trades);
  const ship = page.getByTestId('btn-ship-S-201');
  await expect(ship).toBeVisible();

  await context.clearCookies();
  await ship.click();
  await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('next') === trades);
  await page.getByTestId('login-email').fill(process.env.TEST_USER_A_EMAIL!.trim());
  await page.getByTestId('login-password').fill(process.env.TEST_USER_A_PASSWORD!);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL((url) => url.pathname + url.search === trades);
  await expect(ship).toBeVisible();
});
