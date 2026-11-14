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
  tree: MarkmapNode | undefined;
  fit: ReturnType<typeof vi.fn>;
  setTree: ReturnType<typeof vi.fn>;
  hitAt: ReturnType<typeof vi.fn>;
  layoutPoint: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

const root: MarkmapNode = {
  id: 'root',
  type: 'root',
  content: [],
  notes: [],
  data: {},
  position: { start: 5, end: 9 },
  children: [],
};

const fakeMarkmap = (): FakeMarkmap => ({
  tree: root,
  fit: vi.fn(),
  setTree: vi.fn(),
  hitAt: vi.fn(() => ({ kind: 'node', nodeId: 'root' })),
  layoutPoint: vi.fn(() => [10, 20]),
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
  const onNode = vi.fn();
  const frontmatter = theme === undefined ? {} : { markmap: { theme } };
  mocks.parse.mockReturnValue({ root, frontmatter, gfm: true });
  mocks.resolveViewOptions.mockReturnValue({
    options: { colorScheme: 'light' },
    json: {},
    warnings: [],
  });
  mocks.create.mockReturnValue(markmap);
  mocks.createToolbar.mockReturnValue(toolbar);
  return { markmap, toolbar, svg, frontmatter, onNode };
};

beforeEach(() => {
  vi.clearAllMocks();
  document.head.replaceChildren();
});

describe('Markmap adapter', () => {
  test('[R-02] creates a view and applies frontmatter options', () => {
    const { markmap, toolbar, svg, frontmatter, onNode } = setup('cards');
    const result = createMarkmapView(svg, '# Root', 'dark', onNode);

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
    const { markmap, svg, onNode } = setup();
    const result = createMarkmapView(svg, '# Root', 'light', onNode);
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
    const { markmap, toolbar, svg, onNode } = setup();
    const result = createMarkmapView(svg, '# Root', 'light', onNode);
    if (!result.ok) throw new Error(result.message);
    svg.append(document.createElementNS('http://www.w3.org/2000/svg', 'g'));

    result.view.destroy();

    expect(toolbar.destroy).toHaveBeenCalledOnce();
    expect(markmap.destroy).toHaveBeenCalledOnce();
    expect(svg.childElementCount).toBe(0);
  });

  test('[R-12] reports the source range for a clicked node', () => {
    const { markmap, svg, onNode } = setup();
    const result = createMarkmapView(svg, '# Root', 'light', onNode);
    if (!result.ok) throw new Error(result.message);

    svg.dispatchEvent(new MouseEvent('click', { button: 0, clientX: 10, clientY: 20 }));
    expect(onNode).toHaveBeenLastCalledWith({ start: 5, end: 9 });

    const child: MarkmapNode = {
      id: 'child',
      type: 'heading',
      content: [],
      notes: [],
      data: {},
      position: { start: 10, end: 14 },
      children: [],
    };
    markmap.tree = { ...root, children: [child] };
    markmap.hitAt.mockReturnValue({ kind: 'node', nodeId: 'child' });
    svg.dispatchEvent(new MouseEvent('click', { button: 0, clientX: 10, clientY: 20 }));

    expect(onNode).toHaveBeenLastCalledWith({ start: 10, end: 14 });
  });

  test('[R-12] ignores clicks that are not a left click on a positioned node', () => {
    const { markmap, svg, onNode } = setup();
    const result = createMarkmapView(svg, '# Root', 'light', onNode);
    if (!result.ok) throw new Error(result.message);

    svg.dispatchEvent(new MouseEvent('click', { button: 1, clientX: 10, clientY: 20 }));
    expect(onNode).not.toHaveBeenCalled();

    markmap.hitAt.mockReturnValue({ kind: 'link', nodeId: 'root', href: 'https://example.com' });
    svg.dispatchEvent(new MouseEvent('click', { button: 0, clientX: 10, clientY: 20 }));
    expect(onNode).not.toHaveBeenCalled();

    markmap.hitAt.mockReturnValue(null);
    svg.dispatchEvent(new MouseEvent('click', { button: 0, clientX: 10, clientY: 20 }));
    expect(onNode).not.toHaveBeenCalled();

    markmap.hitAt.mockReturnValue({ kind: 'node', nodeId: 'missing' });
    svg.dispatchEvent(new MouseEvent('click', { button: 0, clientX: 10, clientY: 20 }));
    expect(onNode).not.toHaveBeenCalled();

    const child: MarkmapNode = {
      id: 'child',
      type: 'heading',
      content: [],
      notes: [],
      data: {},
      children: [],
    };
    markmap.tree = { ...root, children: [child] };
    markmap.hitAt.mockReturnValue({ kind: 'node', nodeId: 'child' });
    svg.dispatchEvent(new MouseEvent('click', { button: 0, clientX: 10, clientY: 20 }));
    expect(onNode).not.toHaveBeenCalled();

    markmap.tree = undefined;
    svg.dispatchEvent(new MouseEvent('click', { button: 0, clientX: 10, clientY: 20 }));
    expect(onNode).not.toHaveBeenCalled();
  });

  test('[R-06] reports a parse error without touching the DOM', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mocks.parse.mockImplementation(() => {
      throw new Error('invalid yaml');
    });

    expect(createMarkmapView(svg, '---', 'light', vi.fn())).toEqual({
      ok: false,
      message: 'invalid yaml',
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(svg.childElementCount).toBe(0);
  });

  test('[R-06] reports a non-Error rejection as text', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mocks.parse.mockImplementation(() => {
      throw 'plain text';
    });

    expect(createMarkmapView(svg, '', 'light', vi.fn())).toEqual({
      ok: false,
      message: 'plain text',
    });
  });

  test('[R-07] destroys a created view when the toolbar fails', () => {
    const { markmap, svg, onNode } = setup();
    mocks.createToolbar.mockImplementation(() => {
      throw new Error('toolbar failed');
    });

    expect(createMarkmapView(svg, '# Root', 'light', onNode)).toEqual({
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

    expect(createMarkmapView(svg, '# Root', 'light', vi.fn())).toEqual({
      ok: false,
      message: 'bad options',
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
