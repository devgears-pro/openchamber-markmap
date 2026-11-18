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

const selectedNodeGeometry = async (
  page: Page,
): Promise<{
  node: { x: number; y: number; width: number; height: number };
  fold: { x: number; y: number; width: number; height: number };
  handle: { x: number; y: number; width: number; height: number };
}> =>
  page.evaluate(() => {
    const node = document.querySelector('.mm-editor-selected');
    const handle = document.querySelector('.mm-editor-connect-handle');
    if (!(node instanceof SVGGElement) || !(handle instanceof HTMLElement)) {
      throw new Error('Missing selected node or connection handle');
    }
    const shapes = [...node.querySelectorAll('rect')].map((shape) => ({
      box: shape.getBoundingClientRect(),
      area: shape.getBoundingClientRect().width * shape.getBoundingClientRect().height,
    }));
    const nodeShape = shapes.reduce((largest, shape) =>
      shape.area > largest.area ? shape : largest,
    );
    const foldShape = shapes.reduce((smallest, shape) =>
      shape.area < smallest.area ? shape : smallest,
    );
    const rectOf = (rect: DOMRect): { x: number; y: number; width: number; height: number } => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
    return {
      node: rectOf(nodeShape.box),
      fold: rectOf(foldShape.box),
      handle: rectOf(handle.getBoundingClientRect()),
    };
  });

const overlaps = (
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): boolean =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y;

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

test('[R-37] routes around a blocker and adapts to layout without editing Markdown', async ({
  page,
}) => {
  await page.goto('/dev/?map=relationship-routing');
  await page.getByText('Blocker', { exact: true }).first().click();

  const relation = page.locator('.mm-markmap-svg g[data-key="relation:a:b"]');
  const line = relation.locator('.mm-relation-line');
  await expect(relation).toBeVisible();
  const pathBefore = await line.getAttribute('d');
  if (pathBefore === null) throw new Error('Missing relationship path');
  const original = await snapshotOf(page);
  const crossesBlocker = async (): Promise<boolean> => {
    const blocker = await page.locator('.mm-editor-selection').boundingBox();
    if (blocker === null) throw new Error('Missing selected blocker geometry');
    return line.evaluate((path, blockerBox) => {
      if (!(path instanceof SVGPathElement)) throw new Error('Missing relationship path');
      const matrix = path.getScreenCTM();
      if (matrix === null) throw new Error('Missing relationship transform');
      const count = Math.ceil(path.getTotalLength() / 2);
      for (let index = 0; index <= count; index += 1) {
        const point = path.getPointAtLength((path.getTotalLength() * index) / count);
        const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        if (
          screen.x > blockerBox.x &&
          screen.x < blockerBox.x + blockerBox.width &&
          screen.y > blockerBox.y &&
          screen.y < blockerBox.y + blockerBox.height
        ) {
          return true;
        }
      }
      return false;
    }, blocker);
  };

  expect(await crossesBlocker()).toBe(false);
  expect(await page.evaluate(() => window.devFileChangeSummary().dirty)).toBe(false);

  await page.getByRole('button', { name: 'Org chart' }).click();

  await expect.poll(() => line.getAttribute('d')).not.toBe(pathBefore);
  expect(await crossesBlocker()).toBe(false);
  const updated = await snapshotOf(page);
  expect(updated.replace('layout: org-chart', 'layout: tree')).toBe(original);
  expect(await page.evaluate(() => window.devFileChangeSummary().dirty)).toBe(true);
});

test('[R-36] renders group boundaries with dashed outlines', async ({ page }) => {
  await page.goto('/dev/?map=relationship-routing');

  const boundary = page
    .locator('g[data-group-id="group-0"] path, g[data-group-id="group-0"] rect')
    .first();
  await expect(boundary).toBeVisible();
  await expect
    .poll(() => boundary.evaluate((element) => getComputedStyle(element).strokeDasharray))
    .not.toBe('none');
});

test('[R-37] keeps relationship dash gaps clickable', async ({ page }) => {
  await page.goto('/dev/?map=relationship-routing');

  const relation = page.locator('.mm-markmap-svg g[data-key="relation:a:b"]');
  const shaft = relation.locator('.mm-relation-line');
  const arrowhead = relation.locator('.mm-relation-arrow');
  await expect(relation).toBeVisible();
  await expect(shaft).toBeVisible();
  await expect(arrowhead).toBeVisible();
  const dash = await shaft.evaluate((path) => {
    if (!(path instanceof SVGPathElement)) throw new Error('Missing relationship path');
    const dashArray = getComputedStyle(path).strokeDasharray;
    const segments = dashArray
      .split(/[,\s]+/u)
      .map((segment) => Number.parseFloat(segment))
      .filter(Number.isFinite);
    const dashLength = segments[0];
    const gapLength = segments[1];
    if (dashLength === undefined || gapLength === undefined) return { dashArray, point: null };
    const length = path.getTotalLength();
    const period = segments.reduce((sum, segment) => sum + segment, 0);
    let distance = dashLength + gapLength / 2 + period * 3;
    if (distance >= length - dashLength) distance = dashLength + gapLength / 2;
    const point = path.getPointAtLength(distance);
    const matrix = path.getScreenCTM();
    if (matrix === null) throw new Error('Missing relationship transform');
    const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { dashArray, point: { x: screen.x, y: screen.y } };
  });

  expect(dash.dashArray).not.toBe('none');
  await expect
    .poll(() => arrowhead.evaluate((path) => getComputedStyle(path).strokeDasharray))
    .toBe('none');
  await expect
    .poll(() => arrowhead.evaluate((path) => getComputedStyle(path).fill))
    .not.toBe('none');
  if (dash.point === null) throw new Error('Missing relationship dash gap');

  const group = page.locator('g[data-group-id="group-0"]');
  await group.getByText('Delivery', { exact: true }).click();
  await expect(group).toHaveClass(/mm-editor-group-selected/u);
  await page.mouse.click(dash.point.x, dash.point.y);
  await expect(relation).toHaveClass(/mm-editor-relation-selected/u);
  await expect(group).not.toHaveClass(/mm-editor-group-selected/u);
});

test('[R-37] keeps the connection handle clear of fold controls across layouts', async ({
  page,
}) => {
  await page.goto('/dev/?map=relationship-routing');
  await page.getByText('Branch', { exact: true }).first().click();
  const original = await snapshotOf(page);
  const horizontalGeometries: Awaited<ReturnType<typeof selectedNodeGeometry>>[] = [];

  for (const layout of ['Tree', 'Two-sided']) {
    await page.getByRole('button', { name: layout }).click();
    horizontalGeometries.push(await selectedNodeGeometry(page));
    const snap = await snapshotOf(page);
    expect(snap.replace(/layout: .*\n/u, 'layout: tree\n')).toBe(original);
  }

  await page.getByText('Branch', { exact: true }).first().click();
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.down(modifier);
  await page.keyboard.press('/');
  await page.keyboard.up(modifier);
  await expect(page.getByText('Source', { exact: true })).toBeHidden();
  const foldedSnap = await snapshotOf(page);
  expect(foldedSnap.replace(/layout: .*\n/u, 'layout: tree\n')).toBe(original);

  await page.getByRole('button', { name: 'Org chart' }).click();
  await page.getByText('Routing', { exact: true }).first().click();
  const rootGeometry = await selectedNodeGeometry(page);
  const finalSnap = await snapshotOf(page);
  expect(finalSnap.replace(/layout: .*\n/u, 'layout: tree\n')).toBe(original);

  for (const geometry of horizontalGeometries) {
    expect(overlaps(geometry.handle, geometry.fold)).toBe(false);
    expect(
      geometry.handle.y + geometry.handle.height <= geometry.node.y ||
        geometry.handle.y >= geometry.node.y + geometry.node.height,
    ).toBe(true);
  }
  expect(overlaps(rootGeometry.handle, rootGeometry.fold)).toBe(false);
  expect(
    rootGeometry.handle.x + rootGeometry.handle.width <= rootGeometry.node.x ||
      rootGeometry.handle.x >= rootGeometry.node.x + rootGeometry.node.width,
  ).toBe(true);
});

test('[R-37] starts the connection preview at its handle', async ({ page }) => {
  await page.goto('/dev/?map=relationship-routing');
  await page.getByRole('button', { name: 'Tree' }).click();
  await page.getByText('Branch', { exact: true }).first().click();
  const original = await snapshotOf(page);
  const handle = await handleCenterOf(page);

  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x + 10, handle.y + 4, { steps: 2 });
  const preview = page.locator('.mm-editor-connect-preview path').first();
  await expect(preview).toBeVisible();
  const previewStart = await preview.evaluate((path) => {
    if (!(path instanceof SVGPathElement)) throw new Error('Missing preview path');
    const point = path.getPointAtLength(0);
    const matrix = path.getScreenCTM();
    if (matrix === null) throw new Error('Missing preview transform');
    const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: screen.x, y: screen.y };
  });
  expect(Math.hypot(previewStart.x - handle.x, previewStart.y - handle.y)).toBeLessThan(2);

  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(await snapshotOf(page)).toBe(original);
  expect(await page.evaluate(() => window.devFileChangeSummary().dirty)).toBe(false);
});

test('[R-22] preserves relationship selection across layout switch', async ({ page }) => {
  await page.goto('/dev/?map=graph');
  const relation = page.locator('.mm-markmap-svg g[data-key="relation:a:b"]');
  await expect(relation).toBeVisible();

  await relation.getByText('depends').click();
  await expect(relation).toHaveClass(/mm-editor-relation-selected/u);

  await page.getByRole('button', { name: 'Org chart' }).click();
  await expect(page.getByRole('button', { name: 'Org chart' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(relation).toHaveClass(/mm-editor-relation-selected/u);
});
