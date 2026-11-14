import { expect, test, type Page } from '@playwright/test';

const waitForMap = async (page: Page): Promise<void> => {
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await expect(page.locator('.mm-markmap-svg g').first()).toBeVisible();
  await expect(page.locator('.markmap-toolbar')).toBeVisible();
};

const select = async (page: Page, label: string): Promise<void> => {
  await page.getByText(label, { exact: true }).first().click();
  await expect(page.locator('.mm-editor-selection')).toBeVisible();
};

test('[R-02] [R-03] captures the README screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });

  await page.goto('/dev/?map=showcase&theme=dark');
  await waitForMap(page);
  await select(page, 'Design');
  await page.screenshot({ path: 'docs/images/editor-dark.png' });

  await page.goto('/dev/?map=showcase&theme=light');
  await waitForMap(page);
  await select(page, 'Design');
  await page.screenshot({ path: 'docs/images/editor-light.png' });

  await page.goto('/dev/?map=showcase&theme=dark');
  await waitForMap(page);
  await select(page, 'Private beta');
  await page.keyboard.press('F2');
  await expect(page.locator('textarea.mm-editor-field')).toBeVisible();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type('Beta plan');
  await page.screenshot({ path: 'docs/images/editor-editing.png' });
});
