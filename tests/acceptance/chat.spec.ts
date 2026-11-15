import { expect, test } from '@playwright/test';

test('[R-24] draws a read-only Markmap in a chat block frame', async ({ page }) => {
  await page.goto('/dev/block.html');

  await expect(page.getByRole('img', { name: 'Markmap mind map' })).toBeVisible();
  await expect(page.locator('.mm-chat-svg g').first()).toBeVisible();
  await expect(page.locator('.markmap-toolbar')).toHaveCount(0);
  await expect(page.locator('.mm-chat-notice')).toBeHidden();
});

test('[R-24] follows the host light theme', async ({ page }) => {
  await page.goto('/dev/block.html?theme=light');

  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await expect(page.locator('.mm-chat-svg g').first()).toBeVisible();
});
