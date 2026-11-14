import { expect, test } from '@playwright/test';

test('[R-02] renders a real Markmap and mounts its toolbar', async ({ page }) => {
  await page.goto('/dev/');

  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await expect(page.locator('.mm-markmap-svg g').first()).toBeVisible();
  await expect(page.locator('.markmap-toolbar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fit to view' })).toBeVisible();
});

test('[R-03] [R-10] selects a node and exposes accessible names', async ({ page }) => {
  await page.goto('/dev/');

  await expect(page.locator('.mm-markmap-svg')).toHaveAttribute('role', 'img');
  await expect(page.locator('.mm-markmap-svg')).toHaveAttribute('aria-label', 'Markmap mind map');

  await page.getByText('Links', { exact: true }).first().click();

  await expect(page.locator('.mm-editor-selected')).toContainText('Links');
  await expect(page.locator('.mm-editor-selection')).toBeVisible();
  await expect(page.locator('.mm-editor-surface')).toBeFocused();
});

test('[R-11] inserts a sibling with Enter and edits its label', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Links', { exact: true }).first().click();

  await page.keyboard.press('Enter');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();
  await expect(field).toHaveValue('');

  await page.keyboard.type('Keyboard node');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');

  await expect(page.locator('.mm-markmap-svg')).toContainText('Keyboard node');
});

test('[R-11] inserts a child with Tab and deletes it', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Markmap', { exact: true }).first().click();

  await page.keyboard.press('Tab');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();
  await page.keyboard.type('Child node');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mm-markmap-svg')).toContainText('Child node');

  await page.getByText('Child node', { exact: true }).first().click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.mm-markmap-svg')).not.toContainText('Child node');
});

test('[R-13] shows an editor error for a line break in a heading', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Links', { exact: true }).first().click();

  await page.keyboard.press('F2');
  await expect(page.locator('textarea.mm-editor-field')).toBeVisible();
  await page.keyboard.press('Shift+Enter');

  await expect(page.locator('.mm-notice')).toContainText('heading label cannot contain');
  await page.keyboard.press('Escape');
});

test('[R-14] pans with the wheel and zooms with the modifier', async ({ page }) => {
  await page.goto('/dev/');
  const root = page.locator('.mm-markmap-svg > g').first();
  const read = async (): Promise<string> => (await root.getAttribute('transform')) ?? '';
  const scaleOf = (transform: string): number => Number(/scale\(([^)]+)\)/u.exec(transform)?.[1]);
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

  const before = await read();
  await page.mouse.move(600, 400);
  await page.mouse.wheel(60, 80);
  await page.waitForTimeout(200);
  const panned = await read();
  expect(panned).not.toBe(before);
  expect(scaleOf(panned)).toBeCloseTo(scaleOf(before));

  await page.keyboard.down(modifier);
  await page.mouse.wheel(0, -120);
  await page.keyboard.up(modifier);
  await page.waitForTimeout(300);
  const zoomed = await read();
  expect(scaleOf(zoomed)).toBeGreaterThan(scaleOf(panned));
});
