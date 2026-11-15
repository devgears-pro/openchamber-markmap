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

    const result = await page.evaluate(() => {
      const panel = document.querySelector('.mm-editor-notes');
      const field = document.querySelector('.mm-editor-notes-field');
      if (!(panel instanceof HTMLElement) || !(field instanceof HTMLTextAreaElement)) {
        throw new Error('Notes editor is missing');
      }
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'var(--oc-elevated)';
      probe.style.color = 'var(--oc-fg)';
      document.body.append(probe);
      const expectedBackground = getComputedStyle(probe).backgroundColor;
      const expectedForeground = getComputedStyle(probe).color;
      probe.remove();
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
        };
      });
      const buttonNames = [
        ...document.querySelectorAll(
          '.mm-markmap-toolbar .markmap-toolbar button, .mm-layout-menu button, .mm-notes-menu button',
        ),
      ].map((button) => button.getAttribute('aria-label') ?? '');
      const marker = document.querySelector('.mm-marker-select');
      return {
        panelBackground: getComputedStyle(panel).backgroundColor,
        panelForeground: getComputedStyle(panel).color,
        fieldForeground: getComputedStyle(field).color,
        expectedBackground,
        expectedForeground,
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
        buttonNames,
        markerName: marker?.getAttribute('aria-label') ?? '',
      };
    });

    expect(result.panelBackground).toBe(result.expectedBackground);
    expect(result.panelForeground).toBe(result.expectedForeground);
    expect(result.fieldForeground).toBe(result.expectedForeground);
    expect(result.iconCount).toBeGreaterThanOrEqual(15);
    expect(result.outlineIcons).toBe(true);
    expect(result.topGeometry).toHaveLength(9);
    expect(result.buttonNames).toEqual([
      'Zoom in',
      'Zoom out',
      'Fit to view',
      'Expand all',
      'Tree',
      'Two-sided',
      'Org chart',
      'Edit notes',
    ]);
    expect(result.markerName).toBe('Add marker');
    for (const icon of result.topGeometry) {
      expect(icon).toEqual({
        width: '20px',
        height: '20px',
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: result.expectedForeground,
        strokeWidth: '1.5px',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      });
    }
    for (const name of result.buttonNames) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('combobox', { name: 'Add marker' })).toBeVisible();
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
