import { expect, test, type Page } from '@playwright/test';

const snapshotOf = async (page: Page): Promise<string> => {
  const content = await page.evaluate(() => window.devFileSnapshot());
  if (content === null) throw new Error('Missing snapshot');
  return content;
};

const centerOf = async (page: Page, label: string): Promise<{ x: number; y: number }> => {
  const box = await page.getByText(label, { exact: true }).first().boundingBox();
  if (!box) throw new Error(`Missing bounding box for ${label}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const handleCenterOf = async (page: Page): Promise<{ x: number; y: number }> => {
  const box = await page.locator('.mm-editor-connect-handle').first().boundingBox();
  if (!box) throw new Error('Missing bounding box for handle');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test('[R-37] renders relationship arrow in read-only mode', async ({ page }) => {
  await page.goto('/dev/?map=graph&readonly=1');

  const relation = page.locator('.mm-markmap-svg g[data-key="relation:a:b"]');
  await expect(relation).toBeVisible();
  await expect(relation.locator('path').first()).toHaveAttribute('d', /M.*C.*/u);
  await expect(relation.getByText('depends')).toBeVisible();
});

test('[R-37] selects relationship arrow on click and deletes it with Backspace', async ({
  page,
}) => {
  await page.goto('/dev/?map=graph');

  const relation = page.locator('.mm-markmap-svg g[data-key="relation:a:b"]');
  await expect(relation).toBeVisible();

  await relation.getByText('depends').click();
  await expect(relation).toHaveClass(/mm-editor-relation-selected/u);

  await page.keyboard.press('Backspace');
  await expect(relation).toHaveCount(0);

  const snapshot = await snapshotOf(page);
  expect(snapshot).not.toContain('from: "a"');
  expect(snapshot).not.toContain('to: "b"');
  expect(snapshot).not.toContain('<!-- ^b -->');
});

test('[R-37] edits relationship label via Enter key', async ({ page }) => {
  await page.goto('/dev/?map=graph');

  const relation = page.locator('.mm-markmap-svg g[data-key="relation:a:b"]');
  await expect(relation).toBeVisible();

  await relation.getByText('depends').click();
  await expect(relation).toHaveClass(/mm-editor-relation-selected/u);

  await page.keyboard.press('Enter');
  const field = page.locator('.mm-editor-relation-field');
  await expect(field).toBeVisible();
  await expect(field).toHaveValue('depends');

  await field.fill('relies');
  await page.keyboard.press('Enter');
  await expect(field).toBeHidden();

  await expect(relation.getByText('relies')).toBeVisible();
  const snapshot = await snapshotOf(page);
  expect(snapshot).toContain('relies');
});

test('[R-37] creates a relationship arrow by dragging connection handle', async ({ page }) => {
  await page.goto('/dev/?map=graph');

  await page.getByText('B', { exact: true }).first().click();
  const handle = page.locator('.mm-editor-connect-handle');
  await expect(handle).toBeVisible();

  const handlePos = await handleCenterOf(page);
  const targetPos = await centerOf(page, 'A');

  await page.mouse.move(handlePos.x, handlePos.y);
  await page.mouse.down();
  await page.mouse.move(handlePos.x + 8, handlePos.y + 2, { steps: 2 });
  await page.mouse.move(targetPos.x, targetPos.y, { steps: 8 });
  await page.mouse.up();

  const createdRelation = page.locator('.mm-markmap-svg g[data-key="relation:b:a"]');
  await expect(createdRelation).toBeVisible();

  const snapshot = await snapshotOf(page);
  expect(snapshot).toContain('from: "b"');
  expect(snapshot).toContain('to: "a"');
});
