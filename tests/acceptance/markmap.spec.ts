import { expect, test } from '@playwright/test';

test('[R-02] renders a real Markmap and mounts its toolbar', async ({ page }) => {
  await page.goto('/dev/');

  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await expect(page.locator('.mm-markmap-svg g').first()).toBeVisible();
  await expect(page.locator('.markmap-toolbar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fit to view' })).toBeVisible();
  await expect(page.locator('.mm-source')).toHaveValue(/# Markmap/u);
});

test('[R-03] [R-10] exposes the source and the map with accessible names', async ({ page }) => {
  await page.goto('/dev/');

  await expect(page.locator('.mm-source')).toHaveAttribute('aria-label', 'Markdown source');
  await expect(page.locator('.mm-markmap-svg')).toHaveAttribute('role', 'img');
  await expect(page.locator('.mm-markmap-svg')).toHaveAttribute('aria-label', 'Markmap mind map');
  await expect(page.locator('.mm-source')).toHaveValue(/## Links/u);
});

test('[R-11] edits Markdown and redraws the real Markmap', async ({ page }) => {
  await page.goto('/dev/');
  const source = page.locator('.mm-source');

  await source.fill('# Edited\n\n## New branch\n\n- New leaf\n');

  await expect(page.locator('.mm-markmap-svg')).toContainText('New branch');
  await expect(page.locator('.mm-markmap-svg')).toContainText('New leaf');
});

test('[R-12] focuses the Markdown line when a node is clicked', async ({ page }) => {
  await page.goto('/dev/');
  const source = page.locator('.mm-source');

  await page.getByText('Links', { exact: true }).first().click();

  await expect(source).toBeFocused();
  const selection = await source.evaluate((element: HTMLTextAreaElement) => ({
    start: element.selectionStart,
    end: element.selectionEnd,
    text: element.value.slice(element.selectionStart, element.selectionEnd),
  }));
  expect(selection.end).toBeGreaterThan(selection.start);
  expect(selection.text).toContain('Links');
});
