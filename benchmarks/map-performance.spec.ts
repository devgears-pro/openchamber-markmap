import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __benchStart: number | null;
    __benchEvent: string | null;
    __benchListener: ((event: Event) => void) | null;
  }
}

type MapSize = 'small' | '1000';
type Scenario = 'open/render' | 'select' | 'edit/type' | 'commit' | 'pan' | 'zoom';

type Measurement = {
  size: MapSize;
  scenario: Scenario;
  p50: number;
  p95: number;
  samples: number;
};

type FinishCheck =
  | { kind: 'selection'; label: string }
  | { kind: 'typing'; label: string }
  | { kind: 'commit'; label: string }
  | { kind: 'pan'; before: string }
  | { kind: 'zoom'; before: number };

const RUNS = 20;
const TYPED_CHARACTER = 'x';
const MAPS = [
  { size: 'small', map: 'benchmark-small', nodes: 49, focus: 'Topic 3' },
  { size: '1000', map: 'benchmark-1000', nodes: 1000, focus: 'Topic 3' },
] as const;

const percentile = (values: number[], fraction: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  const value = sorted[Math.max(0, index)];
  if (value === undefined) throw new Error('No samples');
  return value;
};

const measurement = (size: MapSize, scenario: Scenario, values: number[]): Measurement => ({
  size,
  scenario,
  p50: Math.round(percentile(values, 0.5)),
  p95: Math.round(percentile(values, 0.95)),
  samples: values.length,
});

const collect = async (runs: number, run: () => Promise<number>): Promise<number[]> => {
  const values: number[] = [];
  for (let index = 0; index < runs; index += 1) values.push(await run());
  return values;
};

const waitForFrames = (page: Page, frames = 2): Promise<void> =>
  page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        const step = (left: number): void => {
          if (left === 0) {
            resolve();
            return;
          }
          requestAnimationFrame(() => {
            step(left - 1);
          });
        };
        step(count);
      }),
    frames,
  );

const waitForMap = async (page: Page, nodes: number): Promise<void> => {
  await expect(page.locator('.mm-markmap-svg')).toBeVisible();
  await page.waitForFunction(
    (expected) =>
      document.querySelectorAll('.mm-markmap-svg g[data-key^="node:"]').length === expected,
    nodes,
    { polling: 'raf' },
  );
  await waitForFrames(page);
};

const openMap = async (page: Page, map: string, nodes: number): Promise<void> => {
  await page.goto(`/dev/?map=${map}&theme=light`);
  await waitForMap(page, nodes);
};

const measureOpenRender = async (page: Page, map: string, nodes: number): Promise<number> => {
  const start = performance.now();
  await page.goto(`/dev/?map=${map}&theme=light`);
  await waitForMap(page, nodes);
  return performance.now() - start;
};

const armTimer = (page: Page, eventName: string): Promise<void> =>
  page.evaluate((type) => {
    const listener = (event: Event): void => {
      if (event.isTrusted) window.__benchStart ??= performance.now();
    };
    window.__benchStart = null;
    window.__benchEvent = type;
    window.__benchListener = listener;
    window.addEventListener(type, listener, { capture: true, once: true });
  }, eventName);

const finishTimer = (page: Page, check: FinishCheck): Promise<{ ms: number; ok: boolean }> =>
  page.evaluate(async (expected) => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
    const start = window.__benchStart;
    if (start === null) throw new Error('Missing benchmark start');
    const elapsed = performance.now() - start;
    const groupOf = (): SVGGElement | null => {
      const svg = document.querySelector('.mm-markmap-svg');
      if (!(svg instanceof SVGSVGElement)) return null;
      const group = svg.querySelector(':scope > g');
      return group instanceof SVGGElement ? group : null;
    };
    const scaleOfTransform = (transform: string): number => {
      const match = /scale\(([^)]+)\)/u.exec(transform);
      return match?.[1] === undefined ? 1 : Number(match[1]);
    };
    let ok = false;
    if (expected.kind === 'selection') {
      const selected = document.querySelector('.mm-editor-selected');
      const frame = document.querySelector('.mm-editor-selection');
      ok =
        selected?.textContent === expected.label &&
        frame instanceof HTMLElement &&
        getComputedStyle(frame).display !== 'none';
    } else if (expected.kind === 'typing') {
      const field = document.querySelector('textarea.mm-editor-field');
      const selected = document.querySelector('.mm-editor-selected');
      const frame = document.querySelector('.mm-editor-selection');
      ok =
        field instanceof HTMLTextAreaElement &&
        field.style.display !== 'none' &&
        field.value === expected.label &&
        selected?.textContent === expected.label &&
        frame instanceof HTMLElement &&
        getComputedStyle(frame).display !== 'none';
    } else if (expected.kind === 'commit') {
      const field = document.querySelector('textarea.mm-editor-field');
      const selected = document.querySelector('.mm-editor-selected');
      const snapshot = await window.devFileSnapshot();
      ok =
        field instanceof HTMLTextAreaElement &&
        field.style.display === 'none' &&
        selected?.textContent === expected.label &&
        snapshot?.includes(expected.label) === true;
    } else if (expected.kind === 'pan') {
      const group = groupOf();
      ok = group !== null && (group.getAttribute('transform') ?? '') !== expected.before;
    } else {
      const group = groupOf();
      ok =
        group !== null && scaleOfTransform(group.getAttribute('transform') ?? '') > expected.before;
    }
    const listener = window.__benchListener;
    const eventName = window.__benchEvent;
    if (listener !== null && eventName !== null) {
      window.removeEventListener(eventName, listener, true);
    }
    window.__benchStart = null;
    window.__benchEvent = null;
    window.__benchListener = null;
    return { ms: elapsed, ok };
  }, check);

const transformOf = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const svg = document.querySelector('.mm-markmap-svg');
    if (!(svg instanceof SVGSVGElement)) throw new Error('Missing map');
    const group = svg.querySelector(':scope > g');
    if (!(group instanceof SVGGElement)) throw new Error('Missing map group');
    return group.getAttribute('transform') ?? '';
  });

const scaleOf = (transform: string): number => {
  const match = /scale\(([^)]+)\)/u.exec(transform);
  return match?.[1] === undefined ? 1 : Number(match[1]);
};

const mapCenter = (page: Page): Promise<{ x: number; y: number }> =>
  page.evaluate(() => {
    const svg = document.querySelector('.mm-markmap-svg');
    if (!(svg instanceof SVGSVGElement)) throw new Error('Missing map');
    const rect = svg.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });

const nodeCenter = async (page: Page, label: string): Promise<{ x: number; y: number }> => {
  const box = await page.getByText(label, { exact: true }).first().boundingBox();
  if (box === null) throw new Error(`Missing node ${label}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const measureSelection = async (
  page: Page,
  label: string,
): Promise<{ ms: number; ok: boolean }> => {
  const point = await nodeCenter(page, label);
  await armTimer(page, 'click');
  await page.mouse.click(point.x, point.y);
  return finishTimer(page, { kind: 'selection', label });
};

const draftLabel = (label: string): string => `${label}${TYPED_CHARACTER}`;

const prepareEditing = async (page: Page, label: string): Promise<void> => {
  const point = await nodeCenter(page, label);
  await page.mouse.dblclick(point.x, point.y);
  await expect(page.locator('textarea.mm-editor-field')).toBeVisible();
};

const prepareDraft = async (page: Page, label: string): Promise<void> => {
  await prepareEditing(page, label);
  await page.keyboard.type(TYPED_CHARACTER);
  await waitForFrames(page);
  await expect(page.locator('textarea.mm-editor-field')).toHaveValue(draftLabel(label));
  await expect(page.locator('.mm-editor-selected')).toHaveText(draftLabel(label));
};

const measureType = async (page: Page, label: string): Promise<{ ms: number; ok: boolean }> => {
  await prepareEditing(page, label);
  await armTimer(page, 'keydown');
  await page.keyboard.type(TYPED_CHARACTER);
  return finishTimer(page, { kind: 'typing', label: draftLabel(label) });
};

const measureCommit = async (page: Page, label: string): Promise<{ ms: number; ok: boolean }> => {
  await prepareDraft(page, label);
  await armTimer(page, 'keydown');
  await page.keyboard.press('Enter');
  return finishTimer(page, { kind: 'commit', label: draftLabel(label) });
};

const measurePan = async (page: Page): Promise<{ ms: number; ok: boolean }> => {
  const before = await transformOf(page);
  const point = await mapCenter(page);
  await page.mouse.move(point.x, point.y);
  await armTimer(page, 'wheel');
  await page.mouse.wheel(5, 30);
  return finishTimer(page, { kind: 'pan', before });
};

const measureZoom = async (page: Page): Promise<{ ms: number; ok: boolean }> => {
  const before = scaleOf(await transformOf(page));
  const point = await mapCenter(page);
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.mouse.move(point.x, point.y);
  await page.keyboard.down(modifier);
  try {
    await armTimer(page, 'wheel');
    await page.mouse.wheel(0, -10);
  } finally {
    await page.keyboard.up(modifier);
  }
  return finishTimer(page, { kind: 'zoom', before });
};

test('reports p50 and p95 for map interactions', async ({ page }) => {
  test.setTimeout(600_000);
  const requests: string[] = [];
  page.on('request', (request) => {
    requests.push(request.url());
  });
  const measurements: Measurement[] = [];

  for (const item of MAPS) {
    await measureOpenRender(page, item.map, item.nodes);
    measurements.push(
      measurement(
        item.size,
        'open/render',
        await collect(RUNS, () => measureOpenRender(page, item.map, item.nodes)),
      ),
    );

    await openMap(page, item.map, item.nodes);
    await measureSelection(page, item.focus);
    measurements.push(
      measurement(
        item.size,
        'select',
        await collect(RUNS, async () => {
          await openMap(page, item.map, item.nodes);
          const result = await measureSelection(page, item.focus);
          expect(result.ok).toBe(true);
          return result.ms;
        }),
      ),
    );

    await openMap(page, item.map, item.nodes);
    await measureType(page, item.focus);
    measurements.push(
      measurement(
        item.size,
        'edit/type',
        await collect(RUNS, async () => {
          await openMap(page, item.map, item.nodes);
          const result = await measureType(page, item.focus);
          expect(result.ok).toBe(true);
          return result.ms;
        }),
      ),
    );

    await openMap(page, item.map, item.nodes);
    await measureCommit(page, item.focus);
    measurements.push(
      measurement(
        item.size,
        'commit',
        await collect(RUNS, async () => {
          await openMap(page, item.map, item.nodes);
          const result = await measureCommit(page, item.focus);
          expect(result.ok).toBe(true);
          return result.ms;
        }),
      ),
    );

    await openMap(page, item.map, item.nodes);
    await measurePan(page);
    measurements.push(
      measurement(
        item.size,
        'pan',
        await collect(RUNS, async () => {
          await openMap(page, item.map, item.nodes);
          const result = await measurePan(page);
          expect(result.ok).toBe(true);
          return result.ms;
        }),
      ),
    );

    await openMap(page, item.map, item.nodes);
    await measureZoom(page);
    measurements.push(
      measurement(
        item.size,
        'zoom',
        await collect(RUNS, async () => {
          await openMap(page, item.map, item.nodes);
          const result = await measureZoom(page);
          expect(result.ok).toBe(true);
          return result.ms;
        }),
      ),
    );
  }

  const rows = measurements.map(
    (item) => `| ${item.size} | ${item.scenario} | ${item.p50} | ${item.p95} | ${item.samples} |`,
  );
  process.stdout.write(
    `\nMarkmap performance benchmark (milliseconds)\n\n| Map | Scenario | p50 | p95 | Samples |\n| --- | --- | ---: | ---: | ---: |\n${rows.join('\n')}\n\nNo timing threshold is asserted.\n\n`,
  );

  expect(measurements).toHaveLength(MAPS.length * 6);
  for (const item of measurements) {
    expect(Number.isFinite(item.p50)).toBe(true);
    expect(Number.isFinite(item.p95)).toBe(true);
    expect(item.p95).toBeGreaterThanOrEqual(item.p50);
  }
  const external = requests.filter(
    (url) =>
      !url.startsWith('http://127.0.0.1:5194') &&
      !url.startsWith('ws://127.0.0.1:5194') &&
      !url.startsWith('data:') &&
      !url.startsWith('about:'),
  );
  expect(external).toEqual([]);
});
