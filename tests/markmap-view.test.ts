import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { MarkmapNode } from '@markmap/core';

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  create: vi.fn(),
  resolveViewOptions: vi.fn(),
  createToolbar: vi.fn(),
}));

vi.mock('@markmap/parse', () => ({ parse: mocks.parse }));
vi.mock('@markmap/view', () => ({
  Markmap: { create: mocks.create },
  resolveViewOptions: mocks.resolveViewOptions,
}));
vi.mock('@markmap/toolbar', () => ({ createToolbar: mocks.createToolbar }));

const { createMarkmapView } = await import('../src/markmap/view');

type FakeMarkmap = {
  fit: ReturnType<typeof vi.fn>;
  setTree: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

const root: MarkmapNode = {
  id: 'root',
  type: 'root',
  content: [],
  notes: [],
  data: {},
  children: [],
};

const fakeMarkmap = (): FakeMarkmap => ({
  fit: vi.fn(),
  setTree: vi.fn(),
  destroy: vi.fn(),
});

const setup = (theme?: string) => {
  const markmap = fakeMarkmap();
  const toolbar = {
    element: document.createElement('div'),
    destroy: vi.fn(),
    update: vi.fn(),
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const frontmatter = theme === undefined ? {} : { markmap: { theme } };
  mocks.parse.mockReturnValue({ root, frontmatter, gfm: true });
  mocks.resolveViewOptions.mockReturnValue({
    options: { colorScheme: 'light' },
    json: {},
    warnings: [],
  });
  mocks.create.mockReturnValue(markmap);
  mocks.createToolbar.mockReturnValue(toolbar);
  return { markmap, toolbar, svg, frontmatter };
};

beforeEach(() => {
  vi.clearAllMocks();
  document.head.replaceChildren();
});

describe('Markmap adapter', () => {
  test('[R-02] creates a view and applies frontmatter options', () => {
    const { markmap, toolbar, svg, frontmatter } = setup('cards');
    const result = createMarkmapView(svg, '# Root', 'dark');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(mocks.parse).toHaveBeenCalledWith('# Root');
    expect(mocks.resolveViewOptions).toHaveBeenCalledWith(
      { duration: 0, fitPadding: 24 },
      frontmatter.markmap,
    );
    expect(mocks.create).toHaveBeenCalledWith(svg, root, { colorScheme: 'dark' });
    expect(mocks.createToolbar).toHaveBeenCalledWith(markmap);
    expect(markmap.fit).not.toHaveBeenCalled();
    expect(result.view.toolbar).toBe(toolbar.element);
  });

  test('[R-04] updates the tree', () => {
    const { markmap, svg } = setup();
    const result = createMarkmapView(svg, '# Root', 'light');
    if (!result.ok) throw new Error(result.message);

    const nextRoot: MarkmapNode = { ...root, id: 'next' };
    mocks.parse.mockReturnValueOnce({ root: nextRoot, frontmatter: {}, gfm: true });
    mocks.resolveViewOptions.mockReturnValueOnce({
      options: { colorScheme: 'dark' },
      json: {},
      warnings: [],
    });
    result.view.update('# Next', 'light');

    expect(mocks.parse).toHaveBeenLastCalledWith('# Next');
    expect(markmap.setTree).toHaveBeenCalledWith(nextRoot, { colorScheme: 'light' });
    expect(markmap.fit).toHaveBeenCalledOnce();
  });

  test('[R-07] destroys every resource', () => {
    const { markmap, toolbar, svg } = setup();
    const result = createMarkmapView(svg, '# Root', 'light');
    if (!result.ok) throw new Error(result.message);
    svg.append(document.createElementNS('http://www.w3.org/2000/svg', 'g'));

    result.view.destroy();

    expect(toolbar.destroy).toHaveBeenCalledOnce();
    expect(markmap.destroy).toHaveBeenCalledOnce();
    expect(svg.childElementCount).toBe(0);
  });

  test('[R-06] reports a parse error without touching the DOM', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mocks.parse.mockImplementation(() => {
      throw new Error('invalid yaml');
    });

    expect(createMarkmapView(svg, '---', 'light')).toEqual({ ok: false, message: 'invalid yaml' });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(svg.childElementCount).toBe(0);
  });

  test('[R-06] reports a non-Error rejection as text', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mocks.parse.mockImplementation(() => {
      throw 'plain text';
    });

    expect(createMarkmapView(svg, '', 'light')).toEqual({ ok: false, message: 'plain text' });
  });

  test('[R-07] destroys a created view when the toolbar fails', () => {
    const { markmap, svg } = setup();
    mocks.createToolbar.mockImplementation(() => {
      throw new Error('toolbar failed');
    });

    expect(createMarkmapView(svg, '# Root', 'light')).toEqual({
      ok: false,
      message: 'toolbar failed',
    });
    expect(markmap.destroy).toHaveBeenCalledOnce();
    expect(svg.childElementCount).toBe(0);
  });

  test('[R-06] reports a failure while resolving options', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mocks.parse.mockReturnValue({ root, frontmatter: {}, gfm: true });
    mocks.resolveViewOptions.mockImplementation(() => {
      throw new Error('bad options');
    });

    expect(createMarkmapView(svg, '# Root', 'light')).toEqual({
      ok: false,
      message: 'bad options',
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
