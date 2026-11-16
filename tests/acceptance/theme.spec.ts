import { expect, test, type Locator, type Page } from '@playwright/test';

const must = <T>(value: T | null): T => {
  if (value === null) throw new Error('Missing value');
  return value;
};

type LabelStyle = {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fill: string;
};

const labelLocator = (page: Page, label: string, selector = '.mm-markmap-svg text'): Locator =>
  page.locator(selector).filter({ hasText: label }).first();

const styleOf = (
  page: Page,
  label: string,
  selector = '.mm-markmap-svg text',
): Promise<LabelStyle | null> =>
  page.evaluate(
    ({ label: wanted, selector: query }) => {
      const text = [...document.querySelectorAll(query)].find(
        (element) => element.textContent.trim() === wanted,
      );
      if (!text) return null;
      const target = text.querySelector('tspan') ?? text;
      const style = getComputedStyle(target);
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fill: style.fill,
      };
    },
    { label, selector },
  );

const rgbMax = (color: string): number =>
  Math.max(...(color.match(/\d+/g) ?? []).map((value) => Number(value)));

const directRectFills = (page: Page, label: string): Promise<string[]> =>
  page.evaluate((wanted) => {
    const text = [...document.querySelectorAll('.mm-markmap-svg text')].find(
      (element) => element.textContent.trim() === wanted,
    );
    const group = text?.closest('g[data-key^="node:"]');
    if (!group) return [];
    return [...group.children]
      .filter((element) => element.tagName === 'rect')
      .map((element) => getComputedStyle(element).fill);
  }, label);

const directPathStyles = (
  page: Page,
  label: string,
): Promise<{ stroke: string; strokeWidth: string }[]> =>
  page.evaluate((wanted) => {
    const text = [...document.querySelectorAll('.mm-markmap-svg text')].find(
      (element) => element.textContent.trim() === wanted,
    );
    const group = text?.closest('g[data-key^="node:"]');
    if (!group) return [];
    return [...group.children]
      .filter((element) => element.tagName === 'path')
      .map((element) => {
        const style = getComputedStyle(element);
        return { stroke: style.stroke, strokeWidth: style.strokeWidth };
      });
  }, label);

test('[R-32] draws the soft hierarchy in light and dark', async ({ page }) => {
  for (const url of ['/dev/?map=showcase&theme=light', '/dev/?map=showcase']) {
    await page.goto(url);

    const root = must(await styleOf(page, 'Atlas release'));
    const topic = must(await styleOf(page, 'Product'));
    const leaf = must(await styleOf(page, 'Map editor'));
    expect(root).toMatchObject({ fontSize: '20px', fontWeight: '600', fill: 'rgb(255, 255, 255)' });
    expect(topic).toMatchObject({ fontSize: '16px', fontWeight: '500' });
    expect(leaf).toMatchObject({ fontSize: '14px', fontWeight: '400' });

    const rootFills = await directRectFills(page, 'Atlas release');
    expect(rootFills.length).toBeGreaterThan(0);
    expect(rgbMax(rootFills[0] ?? '')).toBeLessThan(120);

    const productFills = await directRectFills(page, 'Product');
    const designFills = await directRectFills(page, 'Design');
    expect(productFills[0]).not.toBe(designFills[0]);

    const leafPaths = await directPathStyles(page, 'Map editor');
    expect(leafPaths.length).toBeGreaterThan(0);
    expect(leafPaths[0]?.stroke).not.toBe('none');

    const edges = await page
      .locator('.mm-markmap-svg g[data-key^="edge:"] > path')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element);
          return { fill: style.fill, stroke: style.stroke };
        }),
      );
    expect(edges.some((edge) => edge.fill !== 'none')).toBe(true);
    expect(edges.some((edge) => edge.stroke !== 'none')).toBe(true);
  }
});

test('[R-32] keeps an explicit frontmatter theme', async ({ page }) => {
  await page.goto('/dev/?theme=light');

  const root = must(await styleOf(page, 'Markmap'));
  expect(root).toMatchObject({ fontSize: '16px', fontWeight: '400', fill: 'rgb(51, 51, 51)' });
  const widths = await page.evaluate(() => {
    const text = [...document.querySelectorAll('.mm-markmap-svg text')].find(
      (element) => element.textContent.trim() === 'Markmap',
    );
    const group = text?.closest('g[data-key^="node:"]');
    if (!group) return [];
    return [...group.children]
      .filter((element) => element.tagName === 'rect')
      .map((element) => element.getBoundingClientRect().width);
  });
  expect(widths.every((width) => width < 20)).toBe(true);
});

test('[R-32] matches the edit field to root, topic and detail labels', async ({ page }) => {
  await page.goto('/dev/?map=showcase&theme=light');

  const cases = [
    { label: 'Atlas release', paddingLeft: 18, paddingTop: 14, align: 'center' },
    { label: 'Product', paddingLeft: 14, paddingTop: 9, align: 'center' },
    { label: 'Map editor', paddingLeft: 4, paddingTop: 2, align: 'left' },
  ];

  for (const item of cases) {
    await labelLocator(page, item.label).click();
    await page.keyboard.press(' ');
    const field = page.locator('textarea.mm-editor-field');
    await expect(field).toBeVisible();

    const styles = await page.evaluate(() => {
      const input = document.querySelector<HTMLTextAreaElement>('textarea.mm-editor-field');
      const selected = document.querySelector('.mm-editor-selected');
      const label = selected?.querySelector('text');
      if (!input || !label) throw new Error('Missing editor geometry');
      const style = getComputedStyle(input);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Missing canvas context');
      context.font = style.font;
      const textWidth = context.measureText(input.value).width;
      const inputRect = input.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      const contentWidth =
        input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const offset = style.textAlign === 'center' ? (contentWidth - textWidth) / 2 : 0;
      const labelStyle = getComputedStyle(label.querySelector('tspan') ?? label);
      return {
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        paddingLeft: parseFloat(style.paddingLeft),
        paddingTop: parseFloat(style.paddingTop),
        textAlign: style.textAlign,
        textStart: inputRect.x + parseFloat(style.paddingLeft) + offset,
        labelStart: labelRect.x,
        contentWidth,
        labelWidth: labelRect.width,
        labelFill: labelStyle.fill,
      };
    });

    expect(styles.fontSize).toBe(
      item.label === 'Atlas release' ? '20px' : item.label === 'Product' ? '16px' : '14px',
    );
    expect(styles.fontWeight).toBe(
      item.label === 'Atlas release' ? '600' : item.label === 'Product' ? '500' : '400',
    );
    expect(styles.paddingLeft).toBe(item.paddingLeft);
    expect(styles.paddingTop).toBe(item.paddingTop);
    expect(styles.textAlign).toBe(item.align);
    expect(styles.color).toBe(styles.labelFill);
    expect(styles.fontFamily).toContain('-apple-system');
    expect(Math.abs(styles.textStart - styles.labelStart)).toBeLessThanOrEqual(2);
    expect(Math.abs(styles.contentWidth - styles.labelWidth)).toBeLessThanOrEqual(2);

    await page.keyboard.press('Escape');
  }
});

test('[R-32] uses the soft theme in the chat block', async ({ page }) => {
  for (const url of ['/dev/block.html?theme=light', '/dev/block.html']) {
    await page.goto(url);
    const selector = '.mm-chat-svg text';
    const root = await styleOf(page, 'Write on the map', selector);
    const topic = await styleOf(page, 'Editing', selector);
    const leaf = await styleOf(page, 'Click a node', selector);
    expect(root).toMatchObject({ fontSize: '20px', fontWeight: '600', fill: 'rgb(255, 255, 255)' });
    expect(topic).toMatchObject({ fontSize: '16px', fontWeight: '500' });
    expect(leaf).toMatchObject({ fontSize: '14px', fontWeight: '400' });
    await expect(page.locator('.mm-chat-svg g[data-key^="node:"]').first()).toBeVisible();
  }
});
