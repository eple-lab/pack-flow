/**
 * Step 3 화면 시험 — 출고 취소, 재고 부족, 일괄 반영, 필수 입력을 확인한다.
 * 각 시험은 전용 계정 A에 demo 시드를 넣고 화면에서 재고와 오류를 확인한다.
 * 근거: docs/work-units/WU-24-regression.md, docs/07-test-strategy.md 2절
 * 구역: sorek-charlie
 *
 * 이력
 * 2026-11-24  sorek-charlie  처음 작성 — Step 3 화면 시나리오 (WU-24)
 */
import { expect, test } from '@playwright/test';
import type { Sale } from '@/types/erp';
import { loginViaUi, resetViaApi } from './helpers';

test.beforeEach(async ({ page }) => {
  // 자바스크립트가 준비되기 전에 기본 GET 제출이 URL에 입력값을 붙이는 것을 막는다.
  await page.route(
    (url) => url.pathname === '/login' && (url.searchParams.has('email') || url.searchParams.has('password')),
    (route) => route.abort(),
  );
  await loginViaUi(page, 'A');
  await resetViaApi(page, 'demo');
});

test('T-S3-1 출고를 취소하면 재고 10과 출고·취소 이력이 남는다', async ({ page }) => {
  await page.goto('/trades?tab=sale');
  const sale = page.getByTestId('sale-row-S-201');
  await page.getByTestId('btn-ship-S-201').click();
  await expect(sale).toContainText('출고완료', { timeout: 15_000 });
  await page.getByTestId('btn-cancel-shipment-S-201').click();
  await page.getByTestId('confirm-ok').click();
  await expect(sale).toContainText('출고취소');

  await page.goto('/history?sku_id=PRD-001');
  const logs = page.getByTestId(/^log-row-/).filter({ hasText: 'S-201' });
  await expect(logs.filter({ hasText: '실판매출고' })).toContainText(/[−-]\s*6/);
  await expect(logs.filter({ hasText: '출고취소' })).toContainText(/\+\s*6/);
  await page.goto('/');
  await expect(page.getByTestId('stock-qty-PRD-001')).toHaveText('10');
});

test('T-S3-2 재고 4에서 50개 출고를 거부하고 재고를 유지한다', async ({ page }) => {
  await page.goto('/trades?tab=sale');
  await page.getByTestId('btn-ship-S-201').click();
  await expect(page.getByTestId('sale-row-S-201')).toContainText('출고완료', { timeout: 15_000 });

  const origin = new URL(page.url()).origin;
  const response = await page.request.post(new URL('/api/sales', origin).toString(), {
    headers: { 'X-PF': '1', Origin: origin },
    data: { sku_id: 'PRD-001', channel: '테스트 판매처', sold_qty: 50, sale_amount: 1000, invoice_no: null },
  });
  expect(response.ok()).toBe(true);
  const { data: sale } = (await response.json()) as { data: Sale };

  await page.reload();
  await page.getByTestId(`btn-ready-${sale.sale_id}`).click();
  const ship = page.getByTestId(`btn-ship-${sale.sale_id}`);
  const refusal = page.waitForResponse((result) =>
    new URL(result.url()).pathname === `/api/sales/${sale.id}/ship` && result.request().method() === 'POST',
  );
  await ship.click();
  const denied = await refusal;
  expect(denied.status()).toBe(409);
  expect(await denied.json()).toMatchObject({ error: { code: 'PF_INSUFFICIENT_STOCK' } });
  await expect(page.getByTestId('error-banner')).toContainText(/재고/);
  await expect(ship).toBeVisible();
  await page.goto('/');
  await expect(page.getByTestId('stock-qty-PRD-001')).toHaveText('4');
});

test('T-S3-5 빈 입력은 반영할 수 없고 오류가 섞인 10행 중 7행이 반영된다', async ({ page }) => {
  await page.goto('/trades?tab=bulk');
  const preview = page.getByTestId('btn-bulk-preview');
  const commit = page.getByTestId('btn-bulk-commit');
  await preview.click();
  await expect(page.getByTestId('bulk-preview-empty')).toContainText('행이 없어요');
  await expect(commit).toHaveCount(0);

  await page.getByTestId('btn-bulk-sample').click();
  await preview.click();
  await expect(page.getByTestId('bulk-row-error-5')).toContainText('미등록 품목코드');
  await expect(page.getByTestId('bulk-row-error-7')).toContainText('수량이 0 이하');
  await expect(page.getByTestId('bulk-row-error-9')).toContainText('같은 붙여넣기 안 송장번호 중복');
  await expect(commit).toContainText('유효한 7행 반영');
  await commit.click();
  await expect(page.getByTestId('bulk-result')).toContainText('7행 반영, 3행 제외');
});

test('T-S4-4 반영한 송장을 다시 붙여넣으면 중복 경고를 표시한다', async ({ page }) => {
  await page.goto('/trades?tab=bulk');
  const text = page.getByTestId('bulk-textarea');
  const preview = page.getByTestId('btn-bulk-preview');
  const commit = page.getByTestId('btn-bulk-commit');
  const row = '출고\tPRD-001\t1\t테스트 판매처\tWU24-INV-001\t중복 확인';

  await text.fill(row);
  await preview.click();
  await expect(commit).toContainText('유효한 1행 반영');
  await commit.click();
  await expect(page.getByTestId('bulk-result')).toContainText('1행 반영, 0행 제외');

  await page.reload();
  await text.fill(row);
  await preview.click();
  await expect(page.getByTestId('bulk-row-error-1')).toContainText('이미 등록된 송장번호');
  await expect(commit).toBeDisabled();
});

test('T-VAL-5 필수 칸을 비우면 칸 아래 오류를 표시하고 등록 요청을 보내지 않는다', async ({ page }) => {
  await page.goto('/trades?tab=sale');
  const form = page.getByTestId('form-sale');
  let registrations = 0;
  await page.route('**/api/sales', async (route) => {
    if (route.request().method() === 'POST') {
      registrations += 1;
      await route.abort();
      return;
    }
    await route.continue();
  });

  await form.getByRole('button', { name: '판매 등록', exact: true }).click();
  await expect(form.getByText('필수 항목이에요', { exact: true }).first()).toBeVisible();
  expect(registrations).toBe(0);
});
