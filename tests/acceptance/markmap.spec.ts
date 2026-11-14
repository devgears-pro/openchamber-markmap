import { expect, test } from '@playwright/test';

test('[R-02] renders a real Markmap and mounts its toolbar', async ({ page }) => {
  await page.goto('/dev/');

  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await expect(page.locator('.mm-markmap-svg g').first()).toBeVisible();
  await expect(page.locator('.markmap-toolbar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fit to view' })).toBeVisible();
  await expect(page.locator('.mm-source')).toContainText('# Markmap');
});

test('[R-03] [R-10] exposes the source and the map with accessible names', async ({ page }) => {
  await page.goto('/dev/');

  await expect(page.locator('.mm-source')).toHaveAttribute('aria-label', 'Markdown source');
  await expect(page.locator('.mm-markmap-svg')).toHaveAttribute('role', 'img');
  await expect(page.locator('.mm-markmap-svg')).toHaveAttribute('aria-label', 'Markmap mind map');
  await expect(page.locator('.mm-source')).toContainText('## Links');
});
