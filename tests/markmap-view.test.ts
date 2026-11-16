import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest';

import type { MarkmapNode } from '@markmap/core';
import type { MarkmapEditorOptions } from '@markmap/edit-dom';
import type * as MarkmapModel from '@markmap/model';
import type { ToolbarOptions } from '@markmap/toolbar';
import type { ViewOptions } from '@markmap/view';

import { layoutFor } from '../src/markmap/layouts';
import type { MarkmapSourceChange } from '../src/markmap/view';

const mocks = vi.hoisted(() => {
  const editorSelected: { value: string | null } = { value: 'root' };
  const editorOptions: MarkmapEditorOptions[] = [];
  return {
    parseDocument: vi.fn(),
    labelText: vi.fn(),
    create: vi.fn<(target: SVGSVGElement, root?: MarkmapNode, options?: ViewOptions) => unknown>(),
    resolveViewOptions: vi.fn(),
    createToolbar: vi.fn<(target: unknown, options?: ToolbarOptions) => unknown>(),
    builtinButtons: {
      'zoom-in': { label: 'Zoom in', icon: 'old-in', disabled: vi.fn(), onClick: vi.fn() },
      'zoom-out': { label: 'Zoom out', icon: 'old-out', disabled: vi.fn(), onClick: vi.fn() },
      fit: { label: 'Fit to view', icon: 'old-fit', disabled: vi.fn(), onClick: vi.fn() },
      'expand-all': {
        label: 'Expand all',
        icon: 'old-expand',
        disabled: vi.fn(),
        onClick: vi.fn(),
      },
    },
    createEditView: vi.fn(),
    editorOptions,
    editorSetLabel: vi.fn(),
    editorSelected,
    editorEditing: { value: false },
    editorEditingNotes: { value: false },
    editorEditNotes: vi.fn<(nodeId?: string | null) => boolean>(() => true),
    editorSource: { value: '# Root' },
    editorSelectedBlock: vi.fn<() => string | null>(() => '# Root'),
    editorNodes: new Map<string, unknown>([['root', {}]]),
    editorDestroy: vi.fn(),
    editorFocus: vi.fn(),
    editorCommit: vi.fn(),
    editorSnapshotForSave: vi.fn<() => string>(),
    editorInsertBlock: vi.fn<(text: string) => boolean>(() => true),
    editorInsertLabel: vi.fn<(text: string) => boolean>(() => true),
    editorDeleteSelected: vi.fn<() => boolean>(() => true),
  };
});

vi.mock('@markmap/model', () => ({
  parseDocument: mocks.parseDocument,
  labelText: mocks.labelText,
}));
vi.mock('@markmap/view', () => ({
  Markmap: { create: mocks.create },
  resolveViewOptions: mocks.resolveViewOptions,
}));
vi.mock('@markmap/toolbar', () => ({
  builtinButtons: mocks.builtinButtons,
  createToolbar: mocks.createToolbar,
}));
vi.mock('@markmap/edit-dom', () => ({
  createEditView: mocks.createEditView,
  MarkmapEditor: class {
    constructor(options: MarkmapEditorOptions) {
      mocks.editorOptions.push(options);
    }

    get selected(): string | null {
      return mocks.editorSelected.value;
    }

    get document(): { readonly nodes: Map<string, unknown> } {
      return { nodes: mocks.editorNodes };
    }

    get isEditing(): boolean {
      return mocks.editorEditing.value;
    }

    get isEditingNotes(): boolean {
      return mocks.editorEditingNotes.value;
    }

    get source(): string {
      return mocks.editorSource.value;
    }

    selectedBlock(): string | null {
      return mocks.editorSelectedBlock();
    }

    insertBlock(text: string): boolean {
      return mocks.editorInsertBlock(text);
    }

    insertLabel(text: string): boolean {
      return mocks.editorInsertLabel(text);
    }

    deleteSelected(): boolean {
      return mocks.editorDeleteSelected();
    }

    setLabel(nodeId: string, text: string): void {
      mocks.editorSetLabel(nodeId, text);
    }

    editNotes(nodeId?: string | null): boolean {
      return mocks.editorEditNotes(nodeId);
    }

    focus(): void {
      mocks.editorFocus();
    }

    commit(): void {
      mocks.editorCommit();
    }

    commitForSnapshot(): string {
      return mocks.editorSnapshotForSave();
    }

    destroy(): void {
      mocks.editorDestroy();
    }
  },
}));

const { createMarkmapView } = await import('../src/markmap/view');
const { parseDocument: parseRealDocument } =
  await vi.importActual<typeof MarkmapModel>('@markmap/model');

type FakeMarkmap = {
  element: SVGSVGElement;
  options: Record<string, unknown>;
  zoomBehavior: { wheelDelta: ReturnType<typeof vi.fn> };
  setOptions: ReturnType<typeof vi.fn>;
  fit: ReturnType<typeof vi.fn>;
  focusNode: ReturnType<typeof vi.fn>;
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

const fakeMarkmap = (svg: SVGSVGElement): FakeMarkmap => {
  const markmap: FakeMarkmap = {
    element: svg,
    options: {},
    zoomBehavior: { wheelDelta: vi.fn() },
    setOptions: vi.fn((next: Record<string, unknown>) => {
      markmap.options = next;
    }),
    fit: vi.fn(),
    focusNode: vi.fn(() => true),
    destroy: vi.fn(),
  };
  return markmap;
};

type Setup = {
  markmap: FakeMarkmap;
  toolbar: {
    element: HTMLDivElement;
    destroy: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  surface: HTMLDivElement;
  svg: SVGSVGElement;
  onSource: Mock<(change: MarkmapSourceChange) => void>;
  onError: Mock<(message: string) => void>;
  onOpenUrl: Mock<(url: string) => void>;
  resolved: {
    options: ViewOptions;
    warnings: string[];
  };
};

const setup = (): Setup => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600);
  const markmap = fakeMarkmap(svg);
  const toolbar = {
    element: document.createElement('div'),
    destroy: vi.fn(),
    update: vi.fn(),
  };
  const surface = document.createElement('div');
  const onSource = vi.fn<(change: MarkmapSourceChange) => void>();
  const onError = vi.fn<(message: string) => void>();
  const onOpenUrl = vi.fn<(url: string) => void>();
  const resolved: Setup['resolved'] = {
    options: { colorScheme: 'light', layout: layoutFor('two-sided') },
    warnings: [],
  };
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
  return { markmap, toolbar, surface, svg, onSource, onError, onOpenUrl, resolved };
};

type Mount = Setup & {
  options: Parameters<typeof createMarkmapView>[0];
  result: ReturnType<typeof createMarkmapView>;
};

const mount = (
  overrides: Partial<Parameters<typeof createMarkmapView>[0]> = {},
  configure?: (setup: Setup) => void,
): Mount => {
  const base = setup();
  configure?.(base);
  const options: Parameters<typeof createMarkmapView>[0] = {
    surface: base.surface,
    svg: base.svg,
    markdown: '# Root',
    colorScheme: 'dark',
    editable: true,
    onSource: base.onSource,
    onError: base.onError,
    onOpenUrl: base.onOpenUrl,
    ...overrides,
  };
  const result = createMarkmapView(options);
  return { ...base, options, result };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.editorOptions.length = 0;
  mocks.editorSelected.value = 'root';
  mocks.editorEditing.value = false;
  mocks.editorEditingNotes.value = false;
  mocks.editorEditNotes.mockClear();
  mocks.editorSource.value = '# Root';
  mocks.editorSelectedBlock.mockReturnValue('# Root');
  mocks.editorNodes.clear();
  mocks.editorNodes.set('root', {});
  mocks.labelText.mockReturnValue('Root');
  document.head.replaceChildren();
  document.body.replaceChildren();
});

describe('Markmap adapter', () => {
  test('[R-02] creates a view and an editable node editor', () => {
    const { markmap, toolbar, surface, onSource, onError, resolved } = mount();

    expect(mocks.parseDocument).toHaveBeenCalledWith('# Root');
    const options = mocks.create.mock.calls[0]?.[2];
    expect(options?.colorScheme).toBe('dark');
    expect(options?.gestures).toBeTypeOf('function');
    expect(markmap.focusNode).toHaveBeenCalledWith('root', { scale: 1, animate: false });
    expect(markmap.zoomBehavior.wheelDelta).toHaveBeenCalledWith(expect.any(Function));
    const toolbarCall = mocks.createToolbar.mock.calls[0];
    expect(toolbarCall?.[0]).toBe(markmap);
    const toolbarOptions = toolbarCall?.[1];
    const items = toolbarOptions?.items ?? [];
    expect(items.map((item) => (typeof item === 'string' ? item : item.label))).toEqual([
      'Zoom in',
      'Zoom out',
      'Fit to view',
      'Reset view',
      'Expand all',
      'fold-level',
    ]);
    expect(mocks.createEditView).toHaveBeenCalledWith(markmap);
    expect(mocks.editorOptions).toHaveLength(1);
    expect(mocks.editorOptions[0]?.source).toBe('# Root');
    expect(mocks.editorOptions[0]?.container).toBe(surface);
    expect(mocks.editorOptions[0]?.view).toEqual({});
    expect(mocks.editorFocus).toHaveBeenCalledOnce();
    expect(mocks.resolveViewOptions).toHaveBeenCalledWith(
      {
        duration: 0,
        fitPadding: 24,
        fitMaxScale: 1,
        layout: layoutFor('two-sided'),
      },
      undefined,
    );
    expect(resolved.options).toBeDefined();
    expect(toolbar.destroy).not.toHaveBeenCalled();
    expect(onSource).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  test('[R-30] resets the view to 100% on the selected node', () => {
    const { result, markmap } = mount();
    if (!result.ok) throw new Error(result.message);
    mocks.editorSelected.value = 'child';
    markmap.focusNode.mockClear();

    result.view.resetView();

    expect(markmap.focusNode).toHaveBeenCalledWith('child', { scale: 1, animate: false });
  });

  test('[R-30] falls back to the root when the selection is gone', () => {
    const { result, markmap } = mount();
    if (!result.ok) throw new Error(result.message);
    mocks.editorSelected.value = 'gone';
    markmap.focusNode.mockReturnValueOnce(false);
    markmap.focusNode.mockClear();

    result.view.resetView();

    expect(markmap.focusNode.mock.calls).toEqual([
      ['gone', { scale: 1, animate: false }],
      ['root', { scale: 1, animate: false }],
    ]);
  });

  test('[R-30] resets a read-only map to the root', () => {
    const { result, markmap } = mount({ editable: false });
    if (!result.ok) throw new Error(result.message);
    markmap.focusNode.mockClear();

    result.view.resetView();

    expect(markmap.focusNode).toHaveBeenCalledWith('root', { scale: 1, animate: false });
  });

  test('[R-02] opens a file without a layout as two-sided', () => {
    const { result } = mount();
    if (!result.ok) throw new Error(result.message);

    expect(result.view.layout).toBe('two-sided');
    expect(mocks.create.mock.calls[0]?.[2]?.layout).toBe(layoutFor('two-sided'));
  });

  test('[R-02] honors explicit layouts', () => {
    const tree = mount({}, (base) => {
      base.resolved.options.layout = layoutFor('tree');
    });
    if (!tree.result.ok) throw new Error(tree.result.message);

    const chart = mount({}, (base) => {
      base.resolved.options.layout = layoutFor('org-chart');
    });
    if (!chart.result.ok) throw new Error(chart.result.message);

    expect(tree.result.view.layout).toBe('tree');
    expect(chart.result.view.layout).toBe('org-chart');
  });

  test('[R-02] falls back to two-sided and reports an unknown layout', () => {
    const { result, onError } = mount({}, (base) => {
      base.resolved.warnings.push(
        'Unknown layout `fishbone`; available: `tree`, `two-sided`, `org-chart`',
      );
    });
    if (!result.ok) throw new Error(result.message);

    expect(result.view.layout).toBe('two-sided');
    expect(onError).toHaveBeenCalledWith(
      'Unknown layout `fishbone`; available: `tree`, `two-sided`, `org-chart`',
    );
  });

  test('[R-22] switches the layout and fits the map', () => {
    const { result, markmap } = mount();
    if (!result.ok) throw new Error(result.message);

    result.view.setLayout('tree');

    expect(mocks.editorCommit).toHaveBeenCalledOnce();
    expect(markmap.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ layout: layoutFor('tree') }),
    );
    expect(markmap.fit).toHaveBeenCalledOnce();
    expect(result.view.layout).toBe('tree');
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  test('[R-22] switches a read-only map without committing an editor', () => {
    const { result, markmap } = mount({ editable: false });
    if (!result.ok) throw new Error(result.message);

    result.view.setLayout('org-chart');

    expect(mocks.editorCommit).not.toHaveBeenCalled();
    expect(markmap.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ layout: layoutFor('org-chart') }),
    );
    expect(markmap.fit).toHaveBeenCalledOnce();
    expect(result.view.layout).toBe('org-chart');
  });

  test('[R-17] opens an http link through the host callback', () => {
    const { svg, onOpenUrl } = mount();
    const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'a');
    anchor.setAttribute('href', 'https://example.com/docs');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    anchor.append(text);
    svg.append(anchor);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    text.dispatchEvent(event);

    expect(onOpenUrl).toHaveBeenCalledWith('https://example.com/docs');
    expect(event.defaultPrevented).toBe(true);
  });

  test('[R-17] ignores non-http links and non-element targets', () => {
    const { svg, onOpenUrl } = mount();
    const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'a');
    anchor.setAttribute('href', 'mailto:dev@example.com');
    const textNode = document.createTextNode('mail');
    anchor.append(textNode);
    const emptyAnchor = document.createElementNS('http://www.w3.org/2000/svg', 'a');
    emptyAnchor.textContent = 'plain';
    svg.append(anchor, emptyAnchor);

    textNode.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    emptyAnchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(onOpenUrl).not.toHaveBeenCalled();
  });

  test('[R-18] adds a marker to the selected node', () => {
    const { result } = mount();
    if (!result.ok) throw new Error(result.message);

    result.view.addMarker('✅');

    expect(mocks.editorSetLabel).toHaveBeenCalledWith('root', '✅ Root');
    expect(mocks.editorFocus).toHaveBeenCalled();
  });

  test('[R-18] skips a marker that is already present', () => {
    mocks.labelText.mockReturnValue('✅ Root');
    const { result } = mount();
    if (!result.ok) throw new Error(result.message);

    result.view.addMarker('✅');

    expect(mocks.editorSetLabel).not.toHaveBeenCalled();
  });

  test('[R-18] skips markers with no selected node or no editor', () => {
    const { result } = mount();
    if (!result.ok) throw new Error(result.message);
    mocks.editorSelected.value = null;
    result.view.addMarker('✅');
    mocks.editorSelected.value = 'missing';
    result.view.addMarker('✅');

    const readOnly = mount({ editable: false });
    if (!readOnly.result.ok) throw new Error(readOnly.result.message);
    readOnly.result.view.addMarker('✅');

    expect(mocks.editorSetLabel).not.toHaveBeenCalled();
  });

  test('[R-11] [R-13] forwards source changes and editor errors', () => {
    const { onSource, onError } = mount();
    const editor = mocks.editorOptions[0];
    if (editor === undefined) throw new Error('No editor');

    editor.onChange?.({
      source: '# Next',
      selection: 4,
      document: parseRealDocument('# Next').document,
    });
    editor.onError?.(new Error('bad label'));

    expect(onSource).toHaveBeenCalledWith({ source: '# Next', selection: 4 });
    expect(onError).toHaveBeenCalledWith('bad label');
  });

  test('[R-12] skips the editor for a read-only file', () => {
    const { result, markmap } = mount({ editable: false });

    if (!result.ok) throw new Error(result.message);
    expect(result.ok).toBe(true);
    expect(mocks.editorOptions).toHaveLength(0);
    expect(result.view.snapshotForSave()).toBeNull();
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(markmap.destroy).not.toHaveBeenCalled();
  });

  test('[R-26] opens the notes editor for the selected node', () => {
    const { result } = mount();
    if (!result.ok) throw new Error(result.message);

    result.view.editNotes();

    expect(mocks.editorEditNotes).toHaveBeenCalledOnce();
  });

  test('[R-12] [R-26] skips the notes editor for a read-only file', () => {
    const { result } = mount({ editable: false });
    if (!result.ok) throw new Error(result.message);

    result.view.editNotes();

    expect(mocks.editorEditNotes).not.toHaveBeenCalled();
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

  test('[R-20] snapshots an in-progress label without committing the editor', () => {
    const { result } = mount();
    if (!result.ok) throw new Error(result.message);
    mocks.editorSnapshotForSave.mockReturnValue('# Saved label');

    expect(result.view.snapshotForSave()).toBe('# Saved label');

    expect(mocks.editorSnapshotForSave).toHaveBeenCalledOnce();
    expect(mocks.editorCommit).not.toHaveBeenCalled();
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
      onOpenUrl: vi.fn(),
    });

    expect(result).toEqual({ ok: false, message: 'invalid yaml' });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(svg.childElementCount).toBe(0);
  });

  test('[R-06] reports a non-Error rejection as text', () => {
    const failure: unknown = 'plain text';
    mocks.parseDocument.mockImplementation(() => {
      throw failure;
    });

    const result = createMarkmapView({
      surface: document.createElement('div'),
      svg: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
      markdown: '',
      colorScheme: 'dark',
      editable: true,
      onSource: vi.fn(),
      onError: vi.fn(),
      onOpenUrl: vi.fn(),
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
      onOpenUrl: vi.fn(),
    });

    expect(result).toEqual({ ok: false, message: 'editor failed' });
    expect(toolbar.destroy).toHaveBeenCalledOnce();
    expect(markmap.destroy).toHaveBeenCalledOnce();
    expect(svg.childElementCount).toBe(0);
  });

  test('[R-21] copies and pastes from the mounted map', () => {
    const { surface, result } = mount();
    if (!result.ok) throw new Error(result.message);
    document.body.append(surface);
    surface.tabIndex = 0;
    surface.focus();
    const clipboard = new DataTransfer();

    surface.dispatchEvent(
      new ClipboardEvent('copy', { clipboardData: clipboard, bubbles: true, cancelable: true }),
    );

    expect(clipboard.getData('text/plain')).toBe('# Root');

    surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', metaKey: true, bubbles: true }));
    const sink = surface.querySelector<HTMLTextAreaElement>('textarea.mm-clipboard-sink');
    if (sink === null) throw new Error('No clipboard sink');
    sink.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }),
    );

    expect(mocks.editorInsertBlock).toHaveBeenCalledWith('# Root');
  });

  test('[R-21] removes the clipboard sink with the view', () => {
    const { surface, result } = mount();
    if (!result.ok) throw new Error(result.message);

    expect(surface.querySelector('.mm-clipboard-sink')).not.toBeNull();
    result.view.destroy();

    expect(surface.querySelector('.mm-clipboard-sink')).toBeNull();
  });

  test('[R-21] mounts no clipboard sink for a read-only map', () => {
    const { surface } = mount({ editable: false });

    expect(surface.querySelector('.mm-clipboard-sink')).toBeNull();
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
      onOpenUrl: vi.fn(),
    });

    expect(result).toEqual({ ok: false, message: 'bad options' });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
