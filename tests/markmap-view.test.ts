import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { MarkmapNode } from '@markmap/core';
import type { MarkmapEditorOptions } from '@markmap/edit-dom';

const mocks = vi.hoisted(() => ({
  parseDocument: vi.fn(),
  create: vi.fn(),
  resolveViewOptions: vi.fn(),
  createToolbar: vi.fn(),
  createEditView: vi.fn(),
  editorOptions: [] as MarkmapEditorOptions[],
  editorDestroy: vi.fn(),
  editorFocus: vi.fn(),
  editorCommit: vi.fn(),
}));

vi.mock('@markmap/model', () => ({ parseDocument: mocks.parseDocument }));
vi.mock('@markmap/view', () => ({
  Markmap: { create: mocks.create },
  resolveViewOptions: mocks.resolveViewOptions,
}));
vi.mock('@markmap/toolbar', () => ({ createToolbar: mocks.createToolbar }));
vi.mock('@markmap/edit-dom', () => ({
  createEditView: mocks.createEditView,
  MarkmapEditor: class {
    constructor(options: MarkmapEditorOptions) {
      mocks.editorOptions.push(options);
    }

    focus(): void {
      mocks.editorFocus();
    }

    commit(): void {
      mocks.editorCommit();
    }

    destroy(): void {
      mocks.editorDestroy();
    }
  },
}));

const { createMarkmapView } = await import('../src/markmap/view');

type FakeMarkmap = {
  options: Record<string, unknown>;
  zoomBehavior: { wheelDelta: ReturnType<typeof vi.fn> };
  setOptions: ReturnType<typeof vi.fn>;
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

const fakeMarkmap = (): FakeMarkmap => {
  const markmap: FakeMarkmap = {
    options: {},
    zoomBehavior: { wheelDelta: vi.fn() },
    setOptions: vi.fn((next: Record<string, unknown>) => {
      markmap.options = next;
    }),
    destroy: vi.fn(),
  };
  return markmap;
};

const setup = () => {
  const markmap = fakeMarkmap();
  const toolbar = {
    element: document.createElement('div'),
    destroy: vi.fn(),
    update: vi.fn(),
  };
  const surface = document.createElement('div');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const onSource = vi.fn();
  const onError = vi.fn();
  const resolved = { options: { colorScheme: 'light' }, json: {}, warnings: [] };
  mocks.parseDocument.mockImplementation((source: string) => ({
    tree:
      source.trim() === ''
        ? root
        : { ...root, source: { block: { start: 0, end: source.length } } },
    frontmatter: {},
    document: {},
  }));
  mocks.resolveViewOptions.mockReturnValue(resolved);
  mocks.create.mockReturnValue(markmap);
  mocks.createToolbar.mockReturnValue(toolbar);
  mocks.createEditView.mockReturnValue({});
  return { markmap, toolbar, surface, svg, onSource, onError, resolved };
};

const mount = (overrides: Partial<Parameters<typeof createMarkmapView>[0]> = {}) => {
  const base = setup();
  const options = {
    surface: base.surface,
    svg: base.svg,
    markdown: '# Root',
    colorScheme: 'dark' as const,
    editable: true,
    onSource: base.onSource,
    onError: base.onError,
    ...overrides,
  };
  const result = createMarkmapView(options);
  return { ...base, options, result };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.editorOptions.length = 0;
  document.head.replaceChildren();
});

describe('Markmap adapter', () => {
  test('[R-02] creates a view and an editable node editor', () => {
    const { markmap, toolbar, surface, onSource, onError, resolved } = mount();

    expect(mocks.parseDocument).toHaveBeenCalledWith('# Root');
    const options = mocks.create.mock.calls[0]?.[2] as {
      colorScheme: string;
      gestures: unknown;
    };
    expect(options.colorScheme).toBe('dark');
    expect(options.gestures).toBeTypeOf('function');
    expect(markmap.zoomBehavior.wheelDelta).toHaveBeenCalledWith(expect.any(Function));
    expect(mocks.createToolbar).toHaveBeenCalledWith(markmap);
    expect(mocks.createEditView).toHaveBeenCalledWith(markmap);
    expect(mocks.editorOptions).toHaveLength(1);
    expect(mocks.editorOptions[0]?.source).toBe('# Root');
    expect(mocks.editorOptions[0]?.container).toBe(surface);
    expect(mocks.editorOptions[0]?.view).toEqual({});
    expect(mocks.editorFocus).toHaveBeenCalledOnce();
    expect(mocks.resolveViewOptions).toHaveBeenCalledWith(
      { duration: 0, fitPadding: 24, fitMaxScale: 1 },
      undefined,
    );
    expect(resolved.options).toBeDefined();
    expect(toolbar.destroy).not.toHaveBeenCalled();
    expect(onSource).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  test('[R-11] [R-13] forwards source changes and editor errors', () => {
    const { onSource, onError } = mount();
    const editor = mocks.editorOptions[0];
    if (editor === undefined) throw new Error('No editor');

    editor.onChange?.({ source: '# Next', selection: 4, document: {} as never });
    editor.onError?.(new Error('bad label'));

    expect(onSource).toHaveBeenCalledWith({ source: '# Next', selection: 4 });
    expect(onError).toHaveBeenCalledWith('bad label');
  });

  test('[R-12] skips the editor for a read-only file', () => {
    const { result, markmap } = mount({ editable: false });

    expect(result.ok).toBe(true);
    expect(mocks.editorOptions).toHaveLength(0);
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(markmap.destroy).not.toHaveBeenCalled();
  });

  test('[R-04] updates the color scheme without recreating the view', () => {
    const { result, markmap } = mount();
    if (!result.ok) throw new Error(result.message);
    const before = mocks.create.mock.calls.length;

    result.view.setColorScheme('light');

    expect(markmap.setOptions).toHaveBeenCalledWith({ colorScheme: 'light' });
    expect(mocks.create).toHaveBeenCalledTimes(before);
    expect(mocks.editorOptions).toHaveLength(1);
  });

  test('[R-05] commits an in-progress label before a snapshot', () => {
    const { result } = mount();
    if (!result.ok) throw new Error(result.message);

    result.view.commit();

    expect(mocks.editorCommit).toHaveBeenCalledOnce();
  });

  test('[R-07] destroys the editor, toolbar, view and SVG children', () => {
    const { result, markmap, toolbar, svg } = mount();
    if (!result.ok) throw new Error(result.message);
    svg.append(document.createElementNS('http://www.w3.org/2000/svg', 'g'));

    result.view.destroy();

    expect(mocks.editorDestroy).toHaveBeenCalledOnce();
    expect(toolbar.destroy).toHaveBeenCalledOnce();
    expect(markmap.destroy).toHaveBeenCalledOnce();
    expect(svg.childElementCount).toBe(0);
  });

  test('[R-06] reports a parse error without touching the DOM', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mocks.parseDocument.mockImplementation(() => {
      throw new Error('invalid yaml');
    });

    const result = createMarkmapView({
      surface: document.createElement('div'),
      svg,
      markdown: '---',
      colorScheme: 'dark',
      editable: true,
      onSource: vi.fn(),
      onError: vi.fn(),
    });

    expect(result).toEqual({ ok: false, message: 'invalid yaml' });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(svg.childElementCount).toBe(0);
  });

  test('[R-06] reports a non-Error rejection as text', () => {
    mocks.parseDocument.mockImplementation(() => {
      throw 'plain text';
    });

    const result = createMarkmapView({
      surface: document.createElement('div'),
      svg: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
      markdown: '',
      colorScheme: 'dark',
      editable: true,
      onSource: vi.fn(),
      onError: vi.fn(),
    });

    expect(result).toEqual({ ok: false, message: 'plain text' });
  });

  test('[R-07] cleans up when the editor fails to construct', () => {
    const { markmap, toolbar, svg } = setup();
    mocks.parseDocument.mockReturnValue({ tree: root, frontmatter: {}, document: {} });
    mocks.create.mockReturnValue(markmap);
    mocks.createToolbar.mockReturnValue(toolbar);
    mocks.createEditView.mockImplementation(() => {
      throw new Error('editor failed');
    });

    const result = createMarkmapView({
      surface: document.createElement('div'),
      svg,
      markdown: '# Root',
      colorScheme: 'dark',
      editable: true,
      onSource: vi.fn(),
      onError: vi.fn(),
    });

    expect(result).toEqual({ ok: false, message: 'editor failed' });
    expect(toolbar.destroy).toHaveBeenCalledOnce();
    expect(markmap.destroy).toHaveBeenCalledOnce();
    expect(svg.childElementCount).toBe(0);
  });

  test('[R-06] reports a failure while resolving options', () => {
    mocks.parseDocument.mockReturnValue({ tree: root, frontmatter: {}, document: {} });
    mocks.resolveViewOptions.mockImplementation(() => {
      throw new Error('bad options');
    });

    const result = createMarkmapView({
      surface: document.createElement('div'),
      svg: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
      markdown: '# Root',
      colorScheme: 'dark',
      editable: true,
      onSource: vi.fn(),
      onError: vi.fn(),
    });

    expect(result).toEqual({ ok: false, message: 'bad options' });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
