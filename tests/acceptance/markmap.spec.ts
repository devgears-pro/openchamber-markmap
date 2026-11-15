import { expect, test } from '@playwright/test';

const scaleOf = (transform: string): number => Number(/scale\(([^)]+)\)/u.exec(transform)?.[1]);

test('[R-02] renders a real Markmap and mounts its toolbar', async ({ page }) => {
  await page.goto('/dev/');

  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await expect(page.locator('.mm-markmap-svg g').first()).toBeVisible();
  await expect(page.locator('.markmap-toolbar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fit to view' })).toBeVisible();
});

test('[R-02] opens a map at no more than 100% scale', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/dev/?map=showcase');
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();

  const transform = await page.locator('.mm-markmap-svg > g').first().getAttribute('transform');

  expect(scaleOf(transform ?? '')).toBeLessThanOrEqual(1);
});

test('[R-18] adds a marker from the toolbar', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Links', { exact: true }).first().click();

  await page.getByLabel('Add marker').selectOption({ label: '✅ Done' });

  await expect(page.locator('.mm-markmap-svg')).toContainText('✅ Links');
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

test('[R-03] draws no browser focus ring around the focused editor surface', async ({ page }) => {
  await page.goto('/dev/');

  const surface = page.locator('.mm-editor-surface');
  await expect(surface).toBeFocused();

  const outline = await surface.evaluate((node) => getComputedStyle(node).outlineStyle);

  expect(outline).toBe('none');
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

test('[R-11] removes a new empty node with Backspace while its field is open', async ({ page }) => {
  await page.goto('/dev/');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const nodes = page.locator('.mm-markmap-svg g[data-key^="node:"]');
  const field = page.locator('textarea.mm-editor-field');

  await page.getByText('Links', { exact: true }).first().click();
  await expect(nodes.first()).toBeVisible();
  const before = await nodes.count();

  await page.keyboard.press('Enter');
  await expect(field).toBeVisible();
  await expect(field).toHaveValue('');
  await expect(nodes).toHaveCount(before + 1);

  await page.keyboard.press('Backspace');
  await expect(field).toBeHidden();
  await expect(nodes).toHaveCount(before);
  await expect(page.locator('.mm-editor-selected')).toContainText('Links');

  await page.keyboard.press(`${modifier}+z`);
  await expect(nodes).toHaveCount(before + 1);
});

test('[R-11] keeps the edit text aligned with the node label', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Headings and lists become branches', { exact: true }).first().click();
  await page.keyboard.press('F2');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();

  const geometry = await page.evaluate(() => {
    const field = document.querySelector<HTMLTextAreaElement>('textarea.mm-editor-field');
    const selected = document.querySelector('.mm-editor-selected');
    const label = selected?.querySelector('text');
    if (!field || !selected || !label) return null;
    const style = getComputedStyle(field);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.font = style.font;
    const textWidth = context.measureText(field.value).width;
    const fieldRect = field.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const contentWidth =
      field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const offset = style.textAlign === 'center' ? (contentWidth - textWidth) / 2 : 0;
    return {
      textStart: fieldRect.x + parseFloat(style.paddingLeft) + offset,
      labelStart: labelRect.x,
      contentWidth,
      labelWidth: labelRect.width,
    };
  });
  if (!geometry) throw new Error('Missing editor geometry');
  expect(Math.abs(geometry.textStart - geometry.labelStart)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.contentWidth - geometry.labelWidth)).toBeLessThanOrEqual(2);
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

test('[R-13] does not edit a title root from frontmatter', async ({ page }) => {
  await page.goto('/dev/?map=title');
  await page.getByText('Root title', { exact: true }).first().dblclick();
  await expect(page.locator('textarea.mm-editor-field')).toBeHidden();
  await expect(page.locator('.mm-notice')).toContainText('frontmatter');
});

test('[R-14] pans with the wheel and zooms with the modifier', async ({ page }) => {
  await page.goto('/dev/');
  const root = page.locator('.mm-markmap-svg > g').first();
  const read = async (): Promise<string> => (await root.getAttribute('transform')) ?? '';
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

test('[R-04] follows the host light and dark theme', async ({ page }) => {
  await page.goto('/dev/?theme=light');
  await expect(page.locator('html')).toHaveAttribute('data-oc-theme', 'light');
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();

  await page.goto('/dev/?theme=dark');
  await expect(page.locator('html')).toHaveAttribute('data-oc-theme', 'dark');
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
});

test('[R-15] navigates with arrows, folds a branch, and edits by typing', async ({ page }) => {
  await page.goto('/dev/');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

  await page.getByText('Links', { exact: true }).first().click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.mm-editor-selected')).toContainText('Markmap');

  await page.getByText('Links', { exact: true }).first().click();
  await page.keyboard.down(modifier);
  await page.keyboard.press('/');
  await page.keyboard.up(modifier);
  await expect(page.getByText('Source', { exact: true })).toBeHidden();

  await page.getByText('Features', { exact: true }).first().click();
  await page.keyboard.type('x');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();
  await expect(field).toHaveValue('Featuresx');
  await page.keyboard.press('Escape');
});

test('[R-15] undoes the first typed character while editing', async ({ page }) => {
  const label = 'Headings and lists become branches';
  await page.goto('/dev/');
  await page.getByText(label, { exact: true }).first().click();
  await page.keyboard.type('123');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toHaveValue(`${label}123`);

  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${modifier}+z`);
  await expect(field).toHaveValue(label);
});

test('[R-15] undoes and redoes an inserted node', async ({ page }) => {
  await page.goto('/dev/');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

  await page.getByText('Links', { exact: true }).first().click();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Undo node');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mm-markmap-svg')).toContainText('Undo node');

  await page.keyboard.press(`${modifier}+z`);
  await expect(page.locator('.mm-markmap-svg')).not.toContainText('Undo node');

  await page.keyboard.press(`${modifier}+Shift+z`);
  await expect(page.locator('.mm-markmap-svg')).toContainText('Undo node');
});

test('[R-12] renders a read-only file without an editor field', async ({ page }) => {
  await page.goto('/dev/?readonly=1');

  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await page.getByText('Links', { exact: true }).first().click();
  await page.keyboard.press('F2');
  await expect(page.locator('textarea.mm-editor-field')).toHaveCount(0);
});

test('[R-16] opens a new empty file with an editable first node', async ({ page }) => {
  await page.goto('/dev/?map=empty');
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await expect(page.locator('.mm-editor-selection')).toBeHidden();

  await page.keyboard.type('First note');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();
  await expect(field).toHaveValue('First note');
  await expect(page.locator('.mm-editor-selection')).toBeVisible();

  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mm-markmap-svg')).toContainText('First note');
});
