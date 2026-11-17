import { expect, test, type Locator, type Page } from '@playwright/test';

declare global {
  interface Window {
    __devSnapshot?: string;
  }
}

const scaleOf = (transform: string): number => Number(/scale\(([^)]+)\)/u.exec(transform)?.[1]);

const markdownOf = async (page: Page): Promise<string> => {
  await page.evaluate(() => window.dispatchEvent(new Event('dev-file-snapshot')));
  await expect.poll(() => page.evaluate(() => window.__devSnapshot)).toBeDefined();
  return (await page.evaluate(() => window.__devSnapshot)) ?? '';
};

const snapshotOf = async (page: Page): Promise<string> => {
  const content = await page.evaluate(() => window.devFileSnapshot());
  if (content === null) throw new Error('Missing snapshot');
  return content;
};

const boxOf = async (
  page: Page,
  label: string,
): Promise<{ x: number; y: number; width: number; height: number }> => {
  const box = await page.getByText(label, { exact: true }).first().boundingBox();
  if (!box) throw new Error(`No box for ${label}`);
  return box;
};

const center = async (page: Page, label: string): Promise<{ x: number; y: number }> => {
  const box = await boxOf(page, label);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

type Box = { x: number; y: number; width: number; height: number };

type TopicGeometry = {
  block: Box;
  frame: Box;
  frameBorder: number;
  field:
    | (Box & {
        centerX: number;
        paddingTop: number;
        paddingRight: number;
        paddingBottom: number;
        paddingLeft: number;
        textAlign: string;
        scale: number;
      })
    | null;
  placeholderWidth: number;
};

const emptyCanvasPoint = async (page: Page): Promise<{ x: number; y: number }> =>
  page.evaluate(() => {
    const svg = document.querySelector('.mm-markmap-svg');
    if (!(svg instanceof SVGSVGElement)) throw new Error('Missing map');
    const box = svg.getBoundingClientRect();
    for (let y = box.y + 40; y < box.y + box.height - 40; y += 20) {
      for (let x = box.x + 40; x < box.x + box.width - 40; x += 20) {
        const hit = document.elementFromPoint(x, y);
        if (!(hit instanceof Element)) continue;
        if (hit.closest('g[data-key]') !== null) continue;
        if (hit.closest('.mm-markmap-toolbar') !== null) continue;
        if (hit.closest('.mm-notice') !== null) continue;
        return { x, y };
      }
    }
    throw new Error('No empty canvas point');
  });

const topicGeometry = async (page: Page): Promise<TopicGeometry> =>
  page.evaluate(() => {
    const group = document.querySelector('.mm-editor-selected');
    const frame = document.querySelector('.mm-editor-selection');
    const block = group?.querySelector('rect');
    if (!(frame instanceof HTMLElement) || !(block instanceof SVGGraphicsElement)) {
      throw new Error('Missing selection geometry');
    }
    const rectOf = (element: Element): { x: number; y: number; width: number; height: number } => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const input = document.querySelector('textarea.mm-editor-field');
    const inputStyle = input instanceof HTMLTextAreaElement ? getComputedStyle(input) : null;
    const inputRect = input instanceof HTMLTextAreaElement ? input.getBoundingClientRect() : null;
    const label = group?.querySelector('text');
    return {
      block: rectOf(block),
      frame: rectOf(frame),
      frameBorder: Number.parseFloat(getComputedStyle(frame).borderLeftWidth),
      field:
        inputRect === null || inputStyle === null || inputStyle.display === 'none'
          ? null
          : {
              x: inputRect.x,
              y: inputRect.y,
              width: inputRect.width,
              height: inputRect.height,
              centerX: inputRect.x + inputRect.width / 2,
              paddingTop: Number.parseFloat(inputStyle.paddingTop),
              paddingRight: Number.parseFloat(inputStyle.paddingRight),
              paddingBottom: Number.parseFloat(inputStyle.paddingBottom),
              paddingLeft: Number.parseFloat(inputStyle.paddingLeft),
              textAlign: inputStyle.textAlign,
              scale: inputStyle.transform === 'none' ? 1 : new DOMMatrix(inputStyle.transform).a,
            },
      placeholderWidth:
        label === null || label === undefined ? 0 : label.getBoundingClientRect().width,
    };
  });

const nodeBoxOf = async (
  page: Page,
  label: string,
): Promise<{ x: number; y: number; width: number; height: number }> =>
  page.evaluate((wanted) => {
    const text = [...document.querySelectorAll('.mm-markmap-svg text')].find(
      (element) => element.textContent.trim() === wanted,
    );
    const group = text?.closest('g[data-key^="node:"]');
    if (!group) throw new Error(`No node box for ${wanted}`);
    const rect = group.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, label);

const startDrag = async (page: Page, label: string): Promise<{ x: number; y: number }> => {
  const from = await center(page, label);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y + 2, { steps: 2 });
  return from;
};

const clickNode = async (
  page: Page,
  label: string,
  modifiers: ('Control' | 'Meta' | 'Shift')[] = [],
): Promise<void> => {
  await page.getByText(label, { exact: true }).first().click({ modifiers });
};

const selectedNodes = (page: Page): Locator => page.locator('.mm-markmap-svg g.mm-editor-selected');

const copySelectedBlock = async (page: Page): Promise<string> => {
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${modifier}+c`);
  return page.evaluate(() => navigator.clipboard.readText());
};

type MapMetrics = {
  transform: string;
  svg: { x: number; y: number; width: number; height: number };
  node: { x: number; y: number; width: number; height: number };
};

const mapMetrics = async (page: Page, label: string): Promise<MapMetrics> => {
  const metrics = await page.evaluate((text) => {
    const svg = document.querySelector('.mm-markmap-svg');
    const node = [...document.querySelectorAll('.mm-markmap-svg text')].find(
      (element) => element.textContent.trim() === text,
    );
    if (!(svg instanceof SVGSVGElement) || !(node instanceof SVGTextElement)) return null;
    const group = svg.querySelector('g');
    if (group === null) return null;
    const svgBox = svg.getBoundingClientRect();
    const nodeBox = node.getBoundingClientRect();
    return {
      transform: group.getAttribute('transform') ?? '',
      svg: { x: svgBox.x, y: svgBox.y, width: svgBox.width, height: svgBox.height },
      node: { x: nodeBox.x, y: nodeBox.y, width: nodeBox.width, height: nodeBox.height },
    };
  }, label);
  if (metrics === null) throw new Error(`Missing map metrics for ${label}`);
  return metrics;
};

const centered = (metrics: MapMetrics): { x: number; y: number } => ({
  x: Math.abs(metrics.node.x + metrics.node.width / 2 - (metrics.svg.x + metrics.svg.width / 2)),
  y: Math.abs(metrics.node.y + metrics.node.height / 2 - (metrics.svg.y + metrics.svg.height / 2)),
});

const textBounds = async (
  page: Page,
): Promise<{ minX: number; minY: number; maxX: number; maxY: number }> => {
  const bounds = await page.evaluate(() => {
    const rects = [...document.querySelectorAll('.mm-markmap-svg text')].map((element) =>
      element.getBoundingClientRect(),
    );
    return {
      minX: Math.min(...rects.map((rect) => rect.left)),
      minY: Math.min(...rects.map((rect) => rect.top)),
      maxX: Math.max(...rects.map((rect) => rect.right)),
      maxY: Math.max(...rects.map((rect) => rect.bottom)),
    };
  });
  return bounds;
};

test('[R-02] renders a real Markmap and mounts its toolbar', async ({ page }) => {
  await page.goto('/dev/');

  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await expect(page.locator('.mm-markmap-svg g').first()).toBeVisible();
  await expect(page.locator('.markmap-toolbar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fit to view' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible();
});

test('[R-02] opens a large file at 100% and Fit shows it whole', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 500 });
  await page.goto('/dev/?map=showcase');
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();

  await page.getByRole('button', { name: 'Fit to view' }).click();
  const fit = await page.locator('.mm-markmap-svg > g').first().getAttribute('transform');
  expect(scaleOf(fit ?? '')).toBeLessThan(1);

  await page.getByRole('button', { name: 'Reset view' }).click();
  const metrics = await mapMetrics(page, 'Atlas release');

  expect(scaleOf(metrics.transform)).toBeCloseTo(1);
  expect(centered(metrics).x).toBeLessThanOrEqual(20);
  expect(centered(metrics).y).toBeLessThanOrEqual(20);
});

test('[R-02] opens a read-only file at 100% centered on the root', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 500 });
  await page.goto('/dev/?map=showcase&readonly=1');
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();

  const metrics = await mapMetrics(page, 'Atlas release');

  expect(scaleOf(metrics.transform)).toBeCloseTo(1);
  expect(centered(metrics).x).toBeLessThanOrEqual(20);
  expect(centered(metrics).y).toBeLessThanOrEqual(20);
});

test('[R-33] resets the view to 100% on the selected node', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 500 });
  await page.goto('/dev/?map=showcase');
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await page.getByText('Product', { exact: true }).first().click();

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.mouse.move(350, 250);
  await page.mouse.wheel(80, 60);

  await expect
    .poll(async () => scaleOf((await mapMetrics(page, 'Product')).transform))
    .toBeGreaterThan(1);

  const reset = page.getByRole('button', { name: 'Reset view' });
  await reset.focus();
  await page.keyboard.press('Enter');

  await expect
    .poll(async () => scaleOf((await mapMetrics(page, 'Product')).transform))
    .toBeCloseTo(1);
  await expect
    .poll(async () => centered(await mapMetrics(page, 'Product')).x)
    .toBeLessThanOrEqual(20);
  await expect
    .poll(async () => centered(await mapMetrics(page, 'Product')).y)
    .toBeLessThanOrEqual(20);
});

test('[R-33] centers a tree that fits at 100%', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 500 });
  await page.goto('/dev/?map=notes');
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();

  await page.getByRole('button', { name: 'Tree' }).click();
  await expect(page.getByRole('button', { name: 'Tree' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Reset view' }).click();

  const bounds = await textBounds(page);

  expect(bounds.minX).toBeGreaterThanOrEqual(0);
  expect(bounds.maxX).toBeLessThanOrEqual(700);
  expect(bounds.minY).toBeGreaterThanOrEqual(0);
  expect(bounds.maxY).toBeLessThanOrEqual(500);
  expect(Math.abs(bounds.minX - (700 - bounds.maxX))).toBeLessThanOrEqual(40);
  expect(Math.abs(bounds.minY - (500 - bounds.maxY))).toBeLessThanOrEqual(40);
});

test('[R-33] starts a large tree at the left on reset', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 500 });
  await page.goto('/dev/?map=move');
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();

  await page.getByRole('button', { name: 'Tree' }).click();
  await expect(page.getByRole('button', { name: 'Tree' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Reset view' }).click();

  const metrics = await mapMetrics(page, 'Atlas release');

  expect(scaleOf(metrics.transform)).toBeCloseTo(1);
  expect(metrics.node.x - metrics.svg.x).toBeLessThanOrEqual(80);
  expect(centered(metrics).x).toBeGreaterThan(100);
  expect(centered(metrics).y).toBeLessThanOrEqual(20);
});

test('[R-33] starts a large org chart at the top on reset', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 500 });
  await page.goto('/dev/?map=move');
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();

  await page.getByRole('button', { name: 'Org chart' }).click();
  await expect(page.getByRole('button', { name: 'Org chart' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Reset view' }).click();

  const metrics = await mapMetrics(page, 'Atlas release');

  expect(scaleOf(metrics.transform)).toBeCloseTo(1);
  expect(metrics.node.y - metrics.svg.y).toBeLessThanOrEqual(80);
  expect(centered(metrics).y).toBeGreaterThan(100);
  expect(centered(metrics).x).toBeLessThanOrEqual(20);
});

test('[R-02] opens a file as a two-sided map by default', async ({ page }) => {
  await page.goto('/dev/');

  await expect(page.getByRole('group', { name: 'Layout' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Two-sided' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const positions = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.mm-markmap-svg text')];
    const find = (label: string): DOMRect | undefined =>
      labels.find((element) => element.textContent.trim() === label)?.getBoundingClientRect();
    const root = find('Markmap');
    const features = find('Features');
    const controls = find('Controls');
    if (!root || !features || !controls) throw new Error('Missing labels');
    return { rootX: root.x, featuresX: features.x, controlsX: controls.x };
  });

  expect(positions.featuresX).toBeGreaterThan(positions.rootX);
  expect(positions.controlsX).toBeLessThan(positions.rootX);
});

test('[R-22] switches the live map between the native layouts', async ({ page }) => {
  await page.goto('/dev/');
  await expect(page.getByRole('button', { name: 'Tree' })).toBeVisible();

  const positions = async (): Promise<{
    rootX: number;
    rootY: number;
    featuresX: number;
    featuresY: number;
    controlsX: number;
    controlsY: number;
  }> =>
    page.evaluate(() => {
      const labels = [...document.querySelectorAll('.mm-markmap-svg text')];
      const find = (label: string): DOMRect | undefined =>
        labels.find((element) => element.textContent.trim() === label)?.getBoundingClientRect();
      const root = find('Markmap');
      const features = find('Features');
      const controls = find('Controls');
      if (!root || !features || !controls) throw new Error('Missing labels');
      return {
        rootX: root.x,
        rootY: root.y,
        featuresX: features.x,
        featuresY: features.y,
        controlsX: controls.x,
        controlsY: controls.y,
      };
    });

  await page.getByRole('button', { name: 'Tree' }).click();
  await expect(page.getByRole('button', { name: 'Tree' })).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => {
      const next = await positions();
      return next.featuresX > next.rootX && next.controlsX > next.rootX;
    })
    .toBe(true);

  await page.getByRole('button', { name: 'Org chart' }).click();
  await expect(page.getByRole('button', { name: 'Org chart' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(async () => {
      const next = await positions();
      return next.featuresY > next.rootY && next.controlsY > next.rootY;
    })
    .toBe(true);
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

test('[R-03] clears selection and focus when clicking the empty canvas', async ({ page }) => {
  const surface = page.locator('.mm-editor-surface');
  await page.goto('/dev/?map=showcase&theme=light');
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await page.getByText('Product', { exact: true }).first().click();
  await expect(page.locator('.mm-editor-selected')).toContainText('Product');
  await expect(page.locator('.mm-editor-selection')).toBeVisible();
  await expect(surface).toBeFocused();

  const point = await emptyCanvasPoint(page);
  await page.mouse.click(point.x, point.y);

  await expect(surface).not.toBeFocused();
  await expect(page.locator('.mm-editor-selected')).toHaveCount(0);
  await expect(page.locator('.mm-editor-selection')).toBeHidden();

  await page.getByText('Design', { exact: true }).first().click();
  await expect(page.locator('.mm-editor-selected')).toContainText('Design');
  await expect(page.locator('.mm-editor-selection')).toBeVisible();
  await expect(surface).toBeFocused();
});

test('[R-03] [R-32] keeps an empty first-level topic frame and edit field aligned at initial scale', async ({
  page,
}) => {
  await page.goto('/dev/?map=showcase&theme=light');
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await page.getByText('Atlas release', { exact: true }).first().click();
  await page.keyboard.press('Tab');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();

  const editing = await topicGeometry(page);
  const input = editing.field;
  if (input === null) throw new Error('Missing edit field');
  const blockCenterX = editing.block.x + editing.block.width / 2;
  expect(input.paddingTop).toBe(9);
  expect(input.paddingRight).toBe(14);
  expect(input.paddingBottom).toBe(9);
  expect(input.paddingLeft).toBe(14);
  expect(input.textAlign).toBe('center');
  expect(editing.placeholderWidth).toBe(0);
  expect(Math.abs(input.centerX - blockCenterX)).toBeLessThanOrEqual(2);
  expect(Math.abs(input.y - editing.block.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(input.height - editing.block.height)).toBeLessThanOrEqual(2);
  expect(input.width).toBeGreaterThanOrEqual(editing.block.width);
  expect(input.scale).toBe(1);
  expect(input.width / input.scale).toBeGreaterThanOrEqual(40);

  const frameLeft = editing.frame.x + editing.frameBorder;
  const frameTop = editing.frame.y + editing.frameBorder;
  const frameWidth = editing.frame.width - editing.frameBorder * 2;
  const frameHeight = editing.frame.height - editing.frameBorder * 2;
  expect(Math.abs(frameLeft - editing.block.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(frameTop - editing.block.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(frameWidth - editing.block.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(frameHeight - editing.block.height)).toBeLessThanOrEqual(2);

  await page.keyboard.type('x');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve();
        });
      }),
  );
  const grown = await topicGeometry(page);
  if (grown.field === null) throw new Error('Missing grown edit field');
  const grownBlockCenterX = grown.block.x + grown.block.width / 2;
  expect(Math.abs(grown.field.centerX - grownBlockCenterX)).toBeLessThanOrEqual(2);
  const grownFrameLeft = grown.frame.x + grown.frameBorder;
  const grownFrameTop = grown.frame.y + grown.frameBorder;
  const grownFrameWidth = grown.frame.width - grown.frameBorder * 2;
  const grownFrameHeight = grown.frame.height - grown.frameBorder * 2;
  expect(Math.abs(grownFrameLeft - grown.block.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(grownFrameTop - grown.block.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(grownFrameWidth - grown.block.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(grownFrameHeight - grown.block.height)).toBeLessThanOrEqual(2);

  await page.keyboard.press('Escape');
  await expect(field).toBeHidden();
  const selected = await topicGeometry(page);
  expect(selected.field).toBeNull();
  expect(Math.abs(selected.block.x + selected.block.width / 2 - blockCenterX)).toBeLessThanOrEqual(
    2,
  );
  const selectedFrameLeft = selected.frame.x + selected.frameBorder;
  const selectedFrameTop = selected.frame.y + selected.frameBorder;
  const selectedFrameWidth = selected.frame.width - selected.frameBorder * 2;
  const selectedFrameHeight = selected.frame.height - selected.frameBorder * 2;
  expect(Math.abs(selectedFrameLeft - selected.block.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(selectedFrameTop - selected.block.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(selectedFrameWidth - selected.block.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(selectedFrameHeight - selected.block.height)).toBeLessThanOrEqual(2);
});

test('[R-19] Enter exits editing before the next Enter inserts a sibling', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Links', { exact: true }).first().click();

  await page.keyboard.press('Enter');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();
  await expect(field).toHaveValue('');

  await page.keyboard.type('Keyboard node');
  await page.keyboard.press('Enter');
  await expect(field).toBeHidden();
  await expect(page.locator('.mm-editor-selected')).toContainText('Keyboard node');

  await page.keyboard.press('Enter');
  await expect(field).toBeVisible();
  await expect(field).toHaveValue('');
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
  await page.getByRole('button', { name: 'Tree' }).click();
  await page.getByText('Headings and lists become branches', { exact: true }).first().click();
  await page.keyboard.press('Space');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();

  const geometry = await page.evaluate(() => {
    const input = document.querySelector<HTMLTextAreaElement>('textarea.mm-editor-field');
    const selected = document.querySelector('.mm-editor-selected');
    const label = selected?.querySelector('text');
    if (!input || !selected || !label) return null;
    const style = getComputedStyle(input);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.font = style.font;
    const textWidth = context.measureText(input.value).width;
    const inputRect = input.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const contentWidth =
      input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const offset = style.textAlign === 'center' ? (contentWidth - textWidth) / 2 : 0;
    return {
      textStart: inputRect.x + parseFloat(style.paddingLeft) + offset,
      labelStart: labelRect.x,
      contentWidth,
      labelWidth: labelRect.width,
    };
  });
  if (!geometry) throw new Error('Missing editor geometry');
  expect(Math.abs(geometry.textStart - geometry.labelStart)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.contentWidth - geometry.labelWidth)).toBeLessThanOrEqual(2);
});

test('[R-11] keeps the edit field anchored while the label grows', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByRole('button', { name: 'Tree' }).click();
  await page.getByText('Headings and lists become branches', { exact: true }).first().click();
  await page.keyboard.press('Space');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();

  const geometry = async (): Promise<{
    textStart: number;
    fieldLeft: number;
    fieldWidth: number;
  }> =>
    page.evaluate(() => {
      const input = document.querySelector<HTMLTextAreaElement>('textarea.mm-editor-field');
      if (!input) throw new Error('Missing editor field');
      const style = getComputedStyle(input);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Missing canvas context');
      context.font = style.font;
      const textWidth = context.measureText(input.value).width;
      const rect = input.getBoundingClientRect();
      const contentWidth =
        input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const offset = style.textAlign === 'center' ? (contentWidth - textWidth) / 2 : 0;
      return {
        textStart: rect.x + parseFloat(style.paddingLeft) + offset,
        fieldLeft: rect.x,
        fieldWidth: rect.width,
      };
    });

  const before = await geometry();
  await page.keyboard.type(' with a much longer label');
  const after = await geometry();

  expect(Math.abs(after.textStart - before.textStart)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.fieldLeft - before.fieldLeft)).toBeLessThanOrEqual(2);
  expect(after.fieldWidth).toBeGreaterThan(before.fieldWidth);
});

test('[R-11] reflows child branches right while the label grows', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Features', { exact: true }).first().click();
  await page.keyboard.press('Space');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();

  const geometry = async (): Promise<{ fieldRight: number; childLeft: number }> =>
    page.evaluate(() => {
      const input = document.querySelector<HTMLTextAreaElement>('textarea.mm-editor-field');
      const child = [...document.querySelectorAll('.mm-markmap-svg text')].find(
        (element) => element.textContent.trim() === 'Inline Markdown works',
      );
      if (!input || !child) throw new Error('Missing editor geometry');
      return {
        fieldRight: input.getBoundingClientRect().right,
        childLeft: child.getBoundingClientRect().x,
      };
    });

  const before = await geometry();
  await page.keyboard.type(' with a much longer label');
  const after = await geometry();

  expect(after.childLeft).toBeGreaterThan(before.childLeft + 50);
  expect(after.fieldRight).toBeLessThanOrEqual(after.childLeft);
});

test('[R-13] shows an editor error for a line break in a heading', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Links', { exact: true }).first().click();

  await page.keyboard.press('Space');
  await expect(page.locator('textarea.mm-editor-field')).toBeVisible();
  await page.keyboard.press('Shift+Enter');

  await expect(page.locator('.mm-notice')).toContainText('heading label cannot contain');
  await page.keyboard.press('Escape');
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

test('[R-15] navigates with arrows, folds a branch, and edits with Space', async ({ page }) => {
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
  await page.keyboard.press('Space');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();
  await expect(field).toHaveValue('Features');
  await page.keyboard.type('x');
  await expect(field).toHaveValue('Featuresx');
  await page.keyboard.press('Escape');
});

test('[R-15] undoes the first typed character while editing', async ({ page }) => {
  const label = 'Headings and lists become branches';
  await page.goto('/dev/');
  await page.getByText(label, { exact: true }).first().click();
  await page.keyboard.press('Space');
  await page.keyboard.type('123');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toHaveValue(`${label}123`);

  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${modifier}+z`);
  await expect(field).toHaveValue(label);
});

test('[R-19] ignores printable keys in selection mode', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Features', { exact: true }).first().click();

  await page.keyboard.type('x');

  await expect(page.locator('textarea.mm-editor-field')).toBeHidden();
  await expect(page.locator('.mm-editor-selected')).toContainText('Features');
  await expect(page.locator('.mm-markmap-svg')).not.toContainText('Featuresx');
});

test('[R-19] leaves F2 unbound', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Features', { exact: true }).first().click();

  await page.keyboard.press('F2');

  await expect(page.locator('textarea.mm-editor-field')).toBeHidden();
  await expect(page.locator('.mm-editor-selected')).toContainText('Features');
});

test('[R-19] starts editing when typing on an empty selected node', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Links', { exact: true }).first().click();
  await page.keyboard.press('Tab');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(field).toBeHidden();

  await page.keyboard.type('x');

  await expect(field).toBeVisible();
  await expect(field).toHaveValue('x');
  await expect(page.locator('.mm-editor-surface')).toHaveClass(/mm-editor-mode-edit/u);
});

test('[R-19] enters editing with Space, exits with Escape, and keeps the selection', async ({
  page,
}) => {
  await page.goto('/dev/');
  const surface = page.locator('.mm-editor-surface');
  await page.getByText('Features', { exact: true }).first().click();
  await expect(surface).toHaveClass(/mm-editor-mode-select/u);

  await page.keyboard.press('Space');
  await expect(surface).toHaveClass(/mm-editor-mode-edit/u);
  await expect(page.locator('textarea.mm-editor-field')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(surface).toHaveClass(/mm-editor-mode-select/u);
  await expect(page.locator('textarea.mm-editor-field')).toBeHidden();
  await expect(page.locator('.mm-editor-selected')).toContainText('Features');
});

test('[R-19] enters editing with a double click', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Features', { exact: true }).first().dblclick();

  await expect(page.locator('.mm-editor-surface')).toHaveClass(/mm-editor-mode-edit/u);
  await expect(page.locator('textarea.mm-editor-field')).toBeVisible();
});

test('[R-19] navigates with arrows without folding', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Links', { exact: true }).first().click();

  await page.keyboard.press('ArrowLeft');

  await expect(page.locator('.mm-editor-selected')).toContainText('Markmap');
  await expect(page.getByText('Source', { exact: true })).toBeVisible();
});

test('[R-20] keeps editing active during an autosave snapshot', async ({ page }) => {
  await page.goto('/dev/');
  await page.getByText('Markmap', { exact: true }).first().click();
  await page.keyboard.press('Tab');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();
  await page.keyboard.type('Child node');

  await page.evaluate(() => window.dispatchEvent(new Event('dev-file-snapshot')));

  await expect(field).toBeVisible();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Child node');
  await page.keyboard.type(' continued');
  await expect(field).toHaveValue('Child node continued');
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

test('[R-21] copies a subtree and pastes it as a child', async ({ page }) => {
  await page.goto('/dev/');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const nodes = page.locator('.mm-markmap-svg g[data-key^="node:"]');
  await expect(nodes.first()).toBeVisible();
  const before = await nodes.count();

  await page.getByText('Links', { exact: true }).first().click();
  await page.keyboard.press(`${modifier}+c`);
  await page.getByText('Markmap', { exact: true }).first().click();
  await page.keyboard.press(`${modifier}+v`);

  await expect(nodes).toHaveCount(before + 3);
  await expect(page.locator('.mm-editor-selected')).toContainText('Links');
});

test('[R-21] cuts a subtree and pastes it back', async ({ page }) => {
  await page.goto('/dev/');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const nodes = page.locator('.mm-markmap-svg g[data-key^="node:"]');
  await expect(nodes.first()).toBeVisible();
  const before = await nodes.count();

  await page.getByText('Links', { exact: true }).first().click();
  await page.keyboard.press(`${modifier}+x`);
  await expect(nodes).toHaveCount(before - 3);

  await page.keyboard.press(`${modifier}+v`);
  await expect(nodes).toHaveCount(before);
  await expect(page.locator('.mm-editor-selected')).toContainText('Links');
});

test('[R-21] pastes a heading subtree under a list item', async ({ page }) => {
  await page.goto('/dev/');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const nodes = page.locator('.mm-markmap-svg g[data-key^="node:"]');
  await expect(nodes.first()).toBeVisible();
  const before = await nodes.count();

  await page.getByText('Links', { exact: true }).first().click();
  await page.keyboard.press(`${modifier}+c`);
  await page.getByText('Click a node to select it', { exact: true }).first().click();
  await page.keyboard.press(`${modifier}+v`);

  await expect(nodes).toHaveCount(before + 3);
  await expect(page.locator('.mm-editor-selected')).toContainText('Links');
});

test('[R-21] copies a title root with every child block and pastes it back', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/dev/?map=title-body');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const nodes = page.locator('.mm-markmap-svg g[data-key^="node:"]');
  await expect(nodes.first()).toBeVisible();
  const before = await nodes.count();

  await page.keyboard.press(`${modifier}+c`);
  const text = await page.evaluate(() => navigator.clipboard.readText());

  expect(text).toContain('# Root title');
  expect(text).toContain('## Branch');
  expect(text).toContain('- Leaf');
  expect(text).toContain('## Second');
  expect(text).not.toContain('---');

  await page.keyboard.press(`${modifier}+v`);
  await expect(nodes).toHaveCount(before + 5);
  await expect(page.locator('.mm-editor-selected')).toContainText('Root title');
});

test('[R-21] pastes external plain text as a child label', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/dev/');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

  await page.getByText('Links', { exact: true }).first().click();
  await page.evaluate(() => navigator.clipboard.writeText('  External\n\n note  '));
  await page.keyboard.press(`${modifier}+v`);

  await expect(page.locator('.mm-markmap-svg')).toContainText('External note');
  await expect(page.locator('.mm-editor-selected')).toContainText('External note');
});

test('[R-26] edits a note and keeps its list inside the note', async ({ page }) => {
  await page.goto('/dev/?map=notes');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const nodes = page.locator('.mm-markmap-svg g[data-key^="node:"]');
  await expect(nodes.first()).toBeVisible();
  const before = await nodes.count();

  await page.getByText('Deploy', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Edit notes' }).click();
  const field = page.locator('.mm-editor-notes-field');
  await expect(field).toBeVisible();
  await field.fill('Оновлений опис.\n\n- Новий пункт');
  await page.keyboard.press(`${modifier}+Enter`);
  await expect(field).not.toBeVisible();

  const node = nodes.filter({ hasText: 'Deploy' });
  await node.locator('[data-action="notes"]').click();
  await expect(page.locator('.markmap-popover')).toContainText('Новий пункт');
  await expect(nodes).toHaveCount(before);
});

test('[R-26] moves a note with its node under a list item', async ({ page }) => {
  await page.goto('/dev/?map=notes');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const nodes = page.locator('.mm-markmap-svg g[data-key^="node:"]');
  await expect(nodes.first()).toBeVisible();
  const before = await nodes.count();

  await page.getByText('Deploy', { exact: true }).first().click();
  await page.keyboard.press(`${modifier}+x`);
  await page.getByText('Release', { exact: true }).first().click();
  await page.keyboard.press(`${modifier}+v`);

  await expect(nodes).toHaveCount(before);
  await expect(page.locator('.mm-markmap-svg')).not.toContainText('Перевірити бекап');
  const node = nodes.filter({ hasText: 'Deploy' });
  await expect(node.locator('[data-action="notes"]')).toHaveCount(1);
  await node.locator('[data-action="notes"]').click();
  await expect(page.locator('.markmap-popover')).toContainText('Перевірити бекап');
});

test('[R-12] [R-26] renders a note in a read-only map without the notes editor', async ({
  page,
}) => {
  await page.goto('/dev/?map=notes&readonly=1');

  await expect(page.getByRole('button', { name: 'Edit notes' })).toHaveCount(0);
  const node = page.locator('.mm-markmap-svg g[data-key^="node:"]').filter({ hasText: 'Deploy' });
  await node.locator('[data-action="notes"]').click();
  await expect(page.locator('.markmap-popover')).toContainText('Перевірити бекап');
});

test('[R-27] styles notes and toolbar icons for dark and light themes', async ({ page }) => {
  for (const theme of ['dark', 'light']) {
    await page.goto(`/dev/?map=notes&theme=${theme}`);
    await page.getByText('Deploy', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Edit notes' }).click();
    await expect(page.getByRole('dialog', { name: 'Notes' })).toBeVisible();
    await page.mouse.move(0, 0);

    const result = await page.evaluate(() => {
      const panel = document.querySelector('.mm-editor-notes');
      const field = document.querySelector('.mm-editor-notes-field');
      if (!(panel instanceof HTMLElement) || !(field instanceof HTMLTextAreaElement)) {
        throw new Error('Notes editor is missing');
      }
      const themed = (property: string, value: string): string => {
        const probe = document.createElement('div');
        probe.style.setProperty(property, value);
        document.body.append(probe);
        const computed = getComputedStyle(probe).getPropertyValue(property);
        probe.remove();
        return computed;
      };
      const expectedBackground = themed('background-color', 'var(--oc-elevated)');
      const expectedForeground = themed('color', 'var(--oc-fg)');
      const expectedMuted = themed('color', 'var(--oc-muted)');
      const icons = [
        ...document.querySelectorAll(
          '.mm-markmap-toolbar button svg, .mm-layout-menu button svg, .mm-marker-menu svg, .mm-notes-menu button svg, .mm-editor-notes-toolbar button svg',
        ),
      ];
      const topIcons = [
        ...document.querySelectorAll(
          '.mm-markmap-toolbar .markmap-toolbar button svg, .mm-layout-menu button svg, .mm-marker-menu svg, .mm-notes-menu button svg',
        ),
      ];
      const topGeometry = topIcons.map((icon) => {
        const path = icon.querySelector('path');
        const style = path === null ? null : getComputedStyle(path);
        const box = getComputedStyle(icon);
        return {
          width: box.width,
          height: box.height,
          viewBox: icon.getAttribute('viewBox'),
          fill: style?.fill ?? '',
          stroke: style?.stroke ?? '',
          strokeWidth: style?.strokeWidth ?? '',
          strokeLinecap: style?.strokeLinecap ?? '',
          strokeLinejoin: style?.strokeLinejoin ?? '',
          active: icon.closest('button')?.getAttribute('aria-pressed') === 'true',
        };
      });
      const topButtons = [
        ...document.querySelectorAll(
          '.mm-markmap-toolbar .markmap-toolbar button, .mm-layout-menu button, .mm-notes-menu button',
        ),
      ].map((button) => {
        const style = getComputedStyle(button);
        return {
          width: style.width,
          height: style.height,
          borderRadius: style.borderRadius,
          background: style.backgroundColor,
          pressed: button.getAttribute('aria-pressed') === 'true',
        };
      });
      const buttonNames = [
        ...document.querySelectorAll(
          '.mm-markmap-toolbar .markmap-toolbar button, .mm-layout-menu button, .mm-notes-menu button',
        ),
      ].map((button) => button.getAttribute('aria-label') ?? '');
      const marker = document.querySelector('.mm-marker-select');
      const markerStyle = marker === null ? null : getComputedStyle(marker);
      const wrapper = document.querySelector('.mm-markmap-toolbar');
      const wrapperStyle = wrapper === null ? null : getComputedStyle(wrapper);
      const groups = [
        ...document.querySelectorAll('.mm-layout-menu, .mm-marker-menu, .mm-notes-menu'),
      ].map((group) => {
        const style = getComputedStyle(group);
        return {
          paddingLeft: style.paddingLeft,
          borderLeftWidth: style.borderLeftWidth,
        };
      });
      return {
        panelBackground: getComputedStyle(panel).backgroundColor,
        panelForeground: getComputedStyle(panel).color,
        fieldForeground: getComputedStyle(field).color,
        expectedBackground,
        expectedForeground,
        expectedMuted,
        iconCount: icons.length,
        outlineIcons: icons.every((icon) => {
          const path = icon.querySelector('path');
          if (path === null) return false;
          const style = getComputedStyle(path);
          return (
            style.fill === 'none' && style.stroke !== 'none' && style.strokeLinecap === 'round'
          );
        }),
        topGeometry,
        topButtons,
        buttonNames,
        markerName: marker?.getAttribute('aria-label') ?? '',
        markerBox:
          markerStyle === null
            ? null
            : {
                width: markerStyle.width,
                height: markerStyle.height,
                borderRadius: markerStyle.borderRadius,
              },
        toolbarBox:
          wrapperStyle === null
            ? null
            : {
                gap: wrapperStyle.gap,
                padding: wrapperStyle.padding,
                borderRadius: wrapperStyle.borderRadius,
                boxShadow: wrapperStyle.boxShadow,
              },
        groups,
      };
    });

    expect(result.panelBackground).toBe(result.expectedBackground);
    expect(result.panelForeground).toBe(result.expectedForeground);
    expect(result.fieldForeground).toBe(result.expectedForeground);
    expect(result.iconCount).toBeGreaterThanOrEqual(16);
    expect(result.outlineIcons).toBe(true);
    expect(result.topGeometry).toHaveLength(10);
    expect(result.buttonNames).toEqual([
      'Zoom in',
      'Zoom out',
      'Fit to view',
      'Reset view',
      'Expand all',
      'Tree',
      'Two-sided',
      'Org chart',
      'Edit notes',
    ]);
    expect(new Set(result.buttonNames).size).toBe(result.buttonNames.length);
    expect(result.markerName).toBe('Add marker');
    expect(result.topGeometry.filter((icon) => icon.active)).toHaveLength(1);
    for (const icon of result.topGeometry) {
      expect(icon).toEqual({
        width: '16px',
        height: '16px',
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: icon.active ? result.expectedForeground : result.expectedMuted,
        strokeWidth: '1.5px',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        active: icon.active,
      });
    }
    for (const button of result.topButtons) {
      expect(button).toEqual({
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        background: 'rgba(0, 0, 0, 0)',
        pressed: button.pressed,
      });
    }
    expect(result.topButtons.filter((button) => button.pressed)).toHaveLength(1);
    expect(result.markerBox).toEqual({
      width: '28px',
      height: '28px',
      borderRadius: '6px',
    });
    expect(result.toolbarBox).toEqual({
      gap: '3px',
      padding: '3px',
      borderRadius: '8px',
      boxShadow: 'rgba(0, 0, 0, 0.12) 0px 3px 10px 0px',
    });
    expect(result.groups).toHaveLength(3);
    for (const group of result.groups) {
      expect(group).toEqual({
        paddingLeft: '6px',
        borderLeftWidth: '1px',
      });
    }
    for (const name of result.buttonNames) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('combobox', { name: 'Add marker' })).toBeVisible();

    await page.getByRole('button', { name: 'Tree', exact: true }).hover();
    const hovered = await page.evaluate(() => {
      const path = document.querySelector('.mm-layout-menu button[data-layout="tree"] path');
      return path === null ? '' : getComputedStyle(path).stroke;
    });
    expect(hovered).toBe(result.expectedForeground);
  }
});

test('[R-12] renders a read-only file without an editor field', async ({ page }) => {
  await page.goto('/dev/?readonly=1');

  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tree' })).toBeVisible();
  await page.getByText('Links', { exact: true }).first().click();
  await page.keyboard.press('Space');
  await expect(page.locator('textarea.mm-editor-field')).toHaveCount(0);
});

test('[R-34] renders a read-only graph file without a note dot', async ({ page }) => {
  await page.goto('/dev/?map=graph&readonly=1');

  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await expect(page.getByText('A', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('B', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-action="notes"]')).toHaveCount(0);
  await expect(page.locator('textarea.mm-editor-field')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit notes' })).toHaveCount(0);
});

test('[R-30] drags a branch to a new parent', async ({ page }) => {
  await page.goto('/dev/?map=move');
  await page.getByRole('button', { name: 'Tree' }).click();
  const before = await markdownOf(page);
  await startDrag(page, 'Search');
  const target = await center(page, 'Interaction design');
  await page.mouse.move(target.x, target.y, { steps: 8 });

  await expect(page.locator('.mm-editor-drag-ghost')).toHaveCount(1);
  await expect(page.locator('.mm-editor-drop')).toHaveClass(/mm-editor-drop-frame/u);
  await page.mouse.up();

  const after = await markdownOf(page);
  expect(after).not.toBe(before);
  const design = after.split('## Interaction design\n')[1]?.split('\n## ')[0] ?? '';
  expect(design).toContain('- Navigation');
  expect(design).toContain('- Empty states');
  expect(design).toContain('- Search');
  await expect(page.locator('.mm-editor-selected')).toContainText('Search');
});

test('[R-30] drags a branch to a new order', async ({ page }) => {
  await page.goto('/dev/?map=move');
  await page.getByRole('button', { name: 'Tree' }).click();
  await startDrag(page, 'Editor');
  const target = await nodeBoxOf(page, 'Search');
  await page.mouse.move(target.x + target.width / 2, target.y + target.height - 2, { steps: 8 });

  await expect(page.locator('.mm-editor-drop')).toHaveClass(/mm-editor-drop-line/u);
  await page.mouse.up();

  const after = await markdownOf(page);
  expect(after.indexOf('- Search')).toBeLessThan(after.indexOf('- Editor'));
});

test('[R-30] cancels a drag with Escape', async ({ page }) => {
  await page.goto('/dev/?map=move');
  await page.getByRole('button', { name: 'Tree' }).click();
  const before = await markdownOf(page);
  await startDrag(page, 'Search');
  const target = await center(page, 'Interaction design');
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.keyboard.press('Escape');
  await page.mouse.up();

  expect(await markdownOf(page)).toBe(before);
  await expect(page.locator('.mm-editor-drag-ghost')).toHaveCount(0);
});

test('[R-30] undoes a drag as one change', async ({ page }) => {
  await page.goto('/dev/?map=move');
  await page.getByRole('button', { name: 'Tree' }).click();
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const before = await markdownOf(page);
  await startDrag(page, 'Search');
  const target = await center(page, 'Interaction design');
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();
  expect(await markdownOf(page)).not.toBe(before);

  await page.keyboard.press(`${modifier}+z`);
  expect(await markdownOf(page)).toBe(before);
});

test('[R-31] moves a branch with the keyboard', async ({ page }) => {
  await page.goto('/dev/?map=move');
  await page.getByRole('button', { name: 'Tree' }).click();
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.getByText('Search', { exact: true }).first().click();

  await page.keyboard.press(`${modifier}+Shift+ArrowUp`);
  const after = await markdownOf(page);
  expect(after.indexOf('- Search')).toBeLessThan(after.indexOf('- Editor'));
});

test('[R-30] has no drag on a read-only map', async ({ page }) => {
  await page.goto('/dev/?map=move&readonly=1');
  await page.getByRole('button', { name: 'Tree' }).click();
  const before = await markdownOf(page);
  await startDrag(page, 'Search');
  const target = await center(page, 'Interaction design');
  await page.mouse.move(target.x, target.y, { steps: 8 });

  await expect(page.locator('.mm-editor-drag-ghost')).toHaveCount(0);
  await page.mouse.up();
  expect(await markdownOf(page)).toBe(before);
});

test('[R-35] selects siblings without changing Markdown or dirty state', async ({ page }) => {
  await page.goto('/dev/?map=move');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const before = await markdownOf(page);
  const changes = await page.evaluate(() => window.devFileChangeSummary());

  await clickNode(page, 'Engineering');
  await clickNode(page, 'Quality', [modifier]);

  await expect(selectedNodes(page)).toHaveCount(2);
  await expect(selectedNodes(page)).toContainText(['Engineering', 'Quality']);
  expect(await markdownOf(page)).toBe(before);
  expect(await page.evaluate(() => window.devFileChangeSummary())).toEqual(changes);
});

test('[R-35] toggles a sibling with Cmd/Ctrl-click', async ({ page }) => {
  await page.goto('/dev/?map=move');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

  await clickNode(page, 'Engineering');
  await clickNode(page, 'Quality', [modifier]);
  await expect(selectedNodes(page)).toHaveCount(2);
  await clickNode(page, 'Quality', [modifier]);

  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(selectedNodes(page)).toContainText('Engineering');
  await page.keyboard.press('Delete');

  const after = await markdownOf(page);
  expect(after).not.toContain('## Engineering');
  expect(after).toContain('## Quality');
});

test('[R-35] selects a sibling range with Shift-click', async ({ page }) => {
  await page.goto('/dev/?map=move');

  await clickNode(page, 'Interaction design');
  await clickNode(page, 'Quality', ['Shift']);

  await expect(selectedNodes(page)).toHaveCount(3);
  await expect(selectedNodes(page)).toContainText(['Interaction design', 'Engineering', 'Quality']);
  await page.keyboard.press('Delete');

  const after = await markdownOf(page);
  expect(after).not.toContain('## Interaction design');
  expect(after).not.toContain('## Engineering');
  expect(after).not.toContain('## Quality');
  expect(after).not.toContain('Navigation');
  expect(after).toContain('## Product strategy');
});

test('[R-35] selects a reverse sibling range with Shift-click', async ({ page }) => {
  await page.goto('/dev/?map=move');

  await clickNode(page, 'Quality');
  await clickNode(page, 'Interaction design', ['Shift']);

  await expect(selectedNodes(page)).toHaveCount(3);
  await expect(selectedNodes(page)).toContainText(['Interaction design', 'Engineering', 'Quality']);
});

test('[R-35] selects one node with a plain click on another sibling', async ({ page }) => {
  await page.goto('/dev/?map=move');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

  await clickNode(page, 'Engineering');
  await clickNode(page, 'Quality', [modifier]);
  await expect(selectedNodes(page)).toHaveCount(2);
  await clickNode(page, 'Quality');

  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(selectedNodes(page)).toContainText('Quality');
  await page.keyboard.press('Delete');

  const after = await markdownOf(page);
  expect(after).not.toContain('## Quality');
  expect(after).toContain('## Engineering');
});

test('[R-35] starts a new selection on a node with another parent', async ({ page }) => {
  await page.goto('/dev/?map=move');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

  await clickNode(page, 'Editor');
  await clickNode(page, 'Search', [modifier]);
  await expect(selectedNodes(page)).toHaveCount(2);
  await clickNode(page, 'Navigation');
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(selectedNodes(page)).toContainText('Navigation');
  await page.keyboard.press(`${modifier}+x`);

  const after = await markdownOf(page);
  expect(after).not.toContain('Navigation');
  expect(after).toContain('- Editor');
  expect(after).toContain('- Search');
});

test('[R-35] moves a non-contiguous sibling selection as one block by pointer', async ({
  page,
}) => {
  await page.goto('/dev/?map=move');
  await page.getByRole('button', { name: 'Tree' }).click();
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const before = await markdownOf(page);
  const changes = await page.evaluate(() => window.devFileChangeSummary());

  await clickNode(page, 'Product strategy');
  await clickNode(page, 'Engineering', [modifier]);
  await expect(selectedNodes(page)).toHaveCount(2);

  const target = await nodeBoxOf(page, 'Quality');
  await startDrag(page, 'Product strategy');
  await page.mouse.move(target.x + target.width / 2, target.y + target.height - 2, { steps: 8 });
  await expect(page.locator('.mm-editor-drop')).toHaveClass(/mm-editor-drop-line/u);
  await page.mouse.up();

  const after = await markdownOf(page);
  const headings = [...after.matchAll(/^## (.+)$/gmu)].map((match) => match[1] ?? '');
  expect(headings).toEqual(['Interaction design', 'Quality', 'Product strategy', 'Engineering']);
  expect(after).toContain('- Editor\n  - Autosave snapshots\n  - Exact Markdown');
  expect(after).toContain('- Search\n  - Keyboard navigation\n  - Branch filtering');
  expect(after).toContain('- Parser\n  - Source ranges');
  expect(after).toContain('- Layout\n  - Two-sided map\n  - Org chart');
  expect(await page.evaluate(() => window.devFileChangeSummary().count)).toBe(changes.count + 1);

  await page.keyboard.press(`${modifier}+z`);
  expect(await markdownOf(page)).toBe(before);
});

test('[R-35] moves selected siblings up with Cmd/Ctrl+Shift+Up', async ({ page }) => {
  await page.goto('/dev/?map=move');
  await page.getByRole('button', { name: 'Tree' }).click();
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const before = await markdownOf(page);
  const changes = await page.evaluate(() => window.devFileChangeSummary());

  await clickNode(page, 'Engineering');
  await clickNode(page, 'Quality', [modifier]);
  await expect(selectedNodes(page)).toHaveCount(2);
  await page.keyboard.press(`${modifier}+Shift+ArrowUp`);

  const after = await markdownOf(page);
  expect(after.indexOf('## Product strategy')).toBeLessThan(after.indexOf('## Engineering'));
  expect(after.indexOf('## Engineering')).toBeLessThan(after.indexOf('## Quality'));
  expect(after.indexOf('## Quality')).toBeLessThan(after.indexOf('## Interaction design'));
  expect(after).toContain('- Parser');
  expect(after).toContain('- Acceptance tests');
  const summary = await page.evaluate(() => window.devFileChangeSummary());
  expect(summary.count).toBe(changes.count + 1);
  expect(summary.dirty).toBe(true);

  await page.keyboard.press(`${modifier}+z`);
  expect(await markdownOf(page)).toBe(before);
});

test('[R-35] moves selected siblings down with Cmd/Ctrl+Shift+Down', async ({ page }) => {
  await page.goto('/dev/?map=move');
  await page.getByRole('button', { name: 'Tree' }).click();
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const before = await markdownOf(page);
  const changes = await page.evaluate(() => window.devFileChangeSummary());

  await clickNode(page, 'Product strategy');
  await clickNode(page, 'Interaction design', [modifier]);
  await expect(selectedNodes(page)).toHaveCount(2);
  await page.keyboard.press(`${modifier}+Shift+ArrowDown`);

  const after = await markdownOf(page);
  const headings = [...after.matchAll(/^## (.+)$/gmu)].map((match) => match[1] ?? '');
  expect(headings).toEqual(['Engineering', 'Product strategy', 'Interaction design', 'Quality']);
  expect(after).toContain('- Editor');
  expect(after).toContain('- Navigation');
  expect(after).toContain('- Empty states');
  const summary = await page.evaluate(() => window.devFileChangeSummary());
  expect(summary.count).toBe(changes.count + 1);
  expect(summary.dirty).toBe(true);

  await page.keyboard.press(`${modifier}+z`);
  expect(await markdownOf(page)).toBe(before);
});

test('[R-35] keeps moved siblings selected with the first moved node as primary', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/dev/?map=move');
  await page.getByRole('button', { name: 'Tree' }).click();
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

  await clickNode(page, 'Quality');
  await clickNode(page, 'Engineering', [modifier]);
  await clickNode(page, 'Interaction design', [modifier]);
  await expect(selectedNodes(page)).toHaveCount(3);
  await page.keyboard.press(`${modifier}+Shift+ArrowUp`);

  const after = await markdownOf(page);
  const headings = [...after.matchAll(/^## (.+)$/gmu)].map((match) => match[1] ?? '');
  expect(headings).toEqual(['Interaction design', 'Engineering', 'Quality', 'Product strategy']);
  await expect(selectedNodes(page)).toHaveCount(3);
  await expect(selectedNodes(page)).toContainText(['Interaction design', 'Engineering', 'Quality']);

  const copied = await copySelectedBlock(page);
  expect(copied).toContain('## Interaction design');
  expect(copied).not.toContain('## Quality');
});

test('[R-35] restores the original and moved group selection on undo and redo', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/dev/?map=move');
  await page.getByRole('button', { name: 'Tree' }).click();
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const before = await markdownOf(page);

  await clickNode(page, 'Quality');
  await clickNode(page, 'Engineering', [modifier]);
  await clickNode(page, 'Interaction design', [modifier]);
  await expect(selectedNodes(page)).toHaveCount(3);
  await page.keyboard.press(`${modifier}+Shift+ArrowUp`);
  const moved = await markdownOf(page);

  await page.keyboard.press(`${modifier}+z`);
  expect(await markdownOf(page)).toBe(before);
  await expect(selectedNodes(page)).toHaveCount(3);
  await expect(selectedNodes(page)).toContainText(['Interaction design', 'Engineering', 'Quality']);
  const original = await copySelectedBlock(page);
  expect(original).toContain('## Quality');
  expect(original).not.toContain('## Interaction design');

  await page.keyboard.press(`${modifier}+Shift+z`);
  expect(await markdownOf(page)).toBe(moved);
  await expect(selectedNodes(page)).toHaveCount(3);
  await expect(selectedNodes(page)).toContainText(['Interaction design', 'Engineering', 'Quality']);
  const redone = await copySelectedBlock(page);
  expect(redone).toContain('## Interaction design');
  expect(redone).not.toContain('## Quality');
});

test('[R-35] deletes selected siblings and their subtrees as one change', async ({ page }) => {
  await page.goto('/dev/?map=move');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const before = await markdownOf(page);
  const changes = await page.evaluate(() => window.devFileChangeSummary());

  await clickNode(page, 'Engineering');
  await clickNode(page, 'Quality', [modifier]);
  await expect(selectedNodes(page)).toHaveCount(2);
  await page.keyboard.press('Backspace');

  const after = await markdownOf(page);
  expect(after).not.toContain('## Engineering');
  expect(after).not.toContain('## Quality');
  expect(after).not.toContain('Source ranges');
  expect(after).not.toContain('Pointer moves');
  expect(after).toContain('## Product strategy');
  expect(after).toContain('## Interaction design');
  const summary = await page.evaluate(() => window.devFileChangeSummary());
  expect(summary.count).toBe(changes.count + 1);
  expect(summary.dirty).toBe(true);

  await page.keyboard.press(`${modifier}+z`);
  expect(await markdownOf(page)).toBe(before);
});

test('[R-35] restores the deleted group selection on undo', async ({ page }) => {
  await page.goto('/dev/?map=move');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const before = await markdownOf(page);

  await clickNode(page, 'Engineering');
  await clickNode(page, 'Quality', [modifier]);
  await expect(selectedNodes(page)).toHaveCount(2);
  await page.keyboard.press('Delete');
  expect(await markdownOf(page)).not.toContain('## Engineering');

  await page.keyboard.press(`${modifier}+z`);
  expect(await markdownOf(page)).toBe(before);
  await expect(selectedNodes(page)).toHaveCount(2);
  await expect(selectedNodes(page)).toContainText(['Engineering', 'Quality']);
});

test('[R-35] cuts only the primary anchor subtree when siblings are selected', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/dev/?map=move');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const nodes = page.locator('.mm-markmap-svg g[data-key^="node:"]');
  await expect(nodes.first()).toBeVisible();
  const beforeCount = await nodes.count();

  await clickNode(page, 'Engineering');
  await clickNode(page, 'Quality', [modifier]);
  await expect(selectedNodes(page)).toHaveCount(2);
  await page.keyboard.press(`${modifier}+x`);

  const cut = await page.evaluate(() => navigator.clipboard.readText());
  expect(cut).toContain('## Engineering');
  expect(cut).toContain('- Parser\n  - Source ranges');
  expect(cut).toContain('- Layout\n  - Two-sided map\n  - Org chart');
  expect(cut).not.toContain('Quality');
  expect(cut).not.toContain('Acceptance tests');

  const after = await markdownOf(page);
  expect(after).not.toContain('## Engineering');
  expect(after).not.toContain('- Parser');
  expect(after).toContain('## Quality');
  expect(after).toContain('- Acceptance tests\n  - Pointer moves');
  await expect(nodes).toHaveCount(beforeCount - 7);

  await clickNode(page, 'Product strategy');
  await page.keyboard.press(`${modifier}+v`);
  const pasted = await markdownOf(page);
  expect(pasted).toContain('### Engineering');
  expect(pasted).toContain('- Parser\n  - Source ranges');
  expect(pasted).toContain('## Quality');
  await expect(nodes).toHaveCount(beforeCount);
});

test('[R-35] exposes no group selection on a read-only map', async ({ page }) => {
  await page.goto('/dev/?map=move&readonly=1');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const before = await markdownOf(page);

  await clickNode(page, 'Engineering');
  await clickNode(page, 'Quality', [modifier]);
  await clickNode(page, 'Interaction design', ['Shift']);

  await expect(selectedNodes(page)).toHaveCount(0);
  await expect(page.locator('textarea.mm-editor-field')).toHaveCount(0);
  await page.keyboard.press('Delete');
  await page.keyboard.press(`${modifier}+Shift+ArrowUp`);
  expect(await markdownOf(page)).toBe(before);
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
  await expect(field).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(field).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mm-markmap-svg')).toContainText('First note');
});

test('[R-28] edits a single H2 root in place and adds a list child', async ({ page }) => {
  await page.goto('/dev/?map=single-h2');
  await expect(page.locator('.mm-editor-selected')).toContainText('Plan');

  await page.keyboard.press('Space');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toHaveValue('Plan');
  await page.keyboard.type(' B');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(field).toBeVisible();
  await page.keyboard.type('Child');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');

  expect(await snapshotOf(page)).toBe('## Plan B\n\n- Child\n### Step\n');
});

test('[R-28] edits a body heading root when frontmatter has a title', async ({ page }) => {
  await page.goto('/dev/?map=title-single');
  await expect(page.locator('.mm-editor-selected')).toContainText('Plan');
  await expect(page.locator('.mm-markmap-svg')).not.toContainText('Root title');

  await page.keyboard.press('Space');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toHaveValue('Plan');
  await page.keyboard.type(' B');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');

  expect(await snapshotOf(page)).toBe('---\ntitle: Root title\n---\n\n## Plan B\n\n### Step\n');
});

test('[R-29] creates a root above a titled list-only file', async ({ page }) => {
  await page.goto('/dev/?map=title-list');
  await page.keyboard.press('Space');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();
  await page.keyboard.type('Plan');
  await page.keyboard.press('Enter');

  await expect(page.locator('.mm-editor-selected')).toContainText('Plan');
  expect(await snapshotOf(page)).toBe('---\ntitle: Root title\n---\n\n# Plan\n\n- Alpha\n- Beta\n');
});

test('[R-28] [R-11] nests heading branches by level', async ({ page }) => {
  await page.goto('/dev/?map=products');
  const selected = page.locator('.mm-editor-selected');
  const field = page.locator('textarea.mm-editor-field');
  await page.getByText('Products', { exact: true }).first().click();

  await page.keyboard.press('Tab');
  await expect(field).toBeVisible();
  await page.keyboard.type('one');
  await page.keyboard.press('Enter');
  await expect(selected).toContainText('one');

  await page.keyboard.press('Tab');
  await expect(field).toBeVisible();
  await page.keyboard.type('two');
  await page.keyboard.press('Enter');
  await expect(selected).toContainText('two');

  await page.keyboard.press('Enter');
  await expect(field).toBeVisible();
  await page.keyboard.type('two-one');
  await page.keyboard.press('Enter');
  await expect(selected).toContainText('two-one');

  await page.keyboard.press('Tab');
  await expect(field).toBeVisible();
  await page.keyboard.type('three');
  await page.keyboard.press('Enter');
  await expect(selected).toContainText('three');

  await page.keyboard.press('ArrowLeft');
  await expect(selected).toContainText('two-one');
  await page.keyboard.press('ArrowUp');
  await expect(selected).toContainText('two');

  expect(await snapshotOf(page)).toBe(
    '# Products\n\n- A\n- B\n## one\n- two\n- two-one\n  - three\n',
  );
});

test('[R-29] refuses root creation beside a top-level H1', async ({ page }) => {
  await page.goto('/dev/?map=two-h1');
  await page.keyboard.press('Space');

  await expect(page.locator('textarea.mm-editor-field')).toBeHidden();
  await expect(page.locator('.mm-notice')).toContainText('group the document under one H1');
  expect(await snapshotOf(page)).toBe('# Alpha\n\n# Beta\n');
});

test('[R-29] [R-13] refuses root creation when a title root has heading children', async ({
  page,
}) => {
  await page.goto('/dev/?map=title-body');
  await page.getByText('Root title', { exact: true }).first().dblclick();

  await expect(page.locator('textarea.mm-editor-field')).toBeHidden();
  await expect(page.locator('.mm-notice')).toContainText('Merge the body under one H1');
  expect(await snapshotOf(page)).toBe(
    '---\ntitle: Root title\n---\n\n## Branch\n\n- Leaf\n\n## Second\n\n- Two\n',
  );
});

test('[R-20] reports a dirty label draft while typing without a snapshot', async ({ page }) => {
  await page.goto('/dev/?map=single-h2');
  await page.keyboard.press('Space');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toHaveValue('Plan');

  await page.keyboard.type(' B');

  const before = await page.evaluate(() => window.devFileChangeSummary());
  expect(before.count).toBeGreaterThan(0);
  expect(before.dirty).toBe(true);
  await expect(field).toBeFocused();

  expect(await snapshotOf(page)).toBe('## Plan B\n\n### Step\n');
  expect(await page.evaluate(() => window.devFileChangeSummary())).toEqual(before);
});

test('[R-20] reports the baseline when a fold hides the edited node', async ({ page }) => {
  await page.goto('/dev/?map=nested');
  await page.getByText('Leaf', { exact: true }).first().click();
  await page.keyboard.press('Space');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toHaveValue('Leaf');
  await page.keyboard.type(' x');

  const draft = await page.evaluate(() => window.devAutosave());
  expect(draft?.content).toBe('# Root\n\n## Branch\n\n### Leaf x\n');
  const saved = await page.evaluate(() => window.devFileChangeSummary());
  expect(saved.dirty).toBe(false);

  await page.getByLabel('Fold to level').selectOption('1');

  const hidden = await page.evaluate(() => window.devFileChangeSummary());
  expect(hidden.dirty).toBe(true);
  expect(await snapshotOf(page)).toBe('# Root\n\n## Branch\n\n### Leaf\n');
  await expect(field).toBeHidden();
});

test('[R-29] [R-20] autosaves root creation above a list-only file', async ({ page }) => {
  await page.goto('/dev/?map=list-only');
  await page.keyboard.press('Space');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();
  await page.keyboard.type('Plan');

  const draft = await page.evaluate(() => window.devAutosave());
  expect(draft?.content).toBe('# Plan\n\n- Alpha\n- Beta\n');
  await expect(field).toBeVisible();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Plan');
  await expect(page.locator('.mm-editor-surface')).toHaveClass(/mm-editor-mode-edit/u);
  const caret = await page.evaluate(() => {
    const input = document.querySelector<HTMLTextAreaElement>('textarea.mm-editor-field');
    if (!input) throw new Error('Missing editor field');
    return { start: input.selectionStart, end: input.selectionEnd };
  });
  expect(caret).toEqual({ start: 4, end: 4 });
  expect(await page.evaluate(() => window.devFileChangeSummary().dirty)).toBe(false);
  expect(await snapshotOf(page)).toBe('# Plan\n\n- Alpha\n- Beta\n');

  await page.keyboard.type(' Two');
  await expect(field).toHaveValue('Plan Two');
  expect(await page.evaluate(() => window.devFileChangeSummary().dirty)).toBe(true);

  await page.keyboard.press('Escape');

  await expect(field).toBeHidden();
  expect(await page.evaluate(() => window.devFileChangeSummary().dirty)).toBe(true);
  expect(await snapshotOf(page)).toBe('- Alpha\n- Beta\n');
});

test('[R-29] [R-15] undoes and redoes root creation in one entry', async ({ page }) => {
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.goto('/dev/?map=list-only');
  await page.keyboard.press('Space');
  const field = page.locator('textarea.mm-editor-field');
  await expect(field).toBeVisible();
  await page.keyboard.type('Plan');
  await page.evaluate(() => window.dispatchEvent(new Event('dev-file-snapshot')));
  await page.keyboard.press('Enter');
  expect(await snapshotOf(page)).toBe('# Plan\n\n- Alpha\n- Beta\n');

  await page.keyboard.press(`${modifier}+z`);
  expect(await snapshotOf(page)).toBe('- Alpha\n- Beta\n');

  await page.keyboard.press(`${modifier}+Shift+z`);
  expect(await snapshotOf(page)).toBe('# Plan\n\n- Alpha\n- Beta\n');
});
