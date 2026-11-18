import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { devContext } from '../dev/theme';

import { mountApp, type MarkmapHost, type MountOptions } from '../src/app';
import type { MarkmapLayout } from '../src/markmap/layouts';
import type {
  MarkmapColorScheme,
  MarkmapFactory,
  MarkmapMount,
  MarkmapView,
} from '../src/markmap/view';
import { MarkmapEditor, type EditView } from '@markmap/edit-dom';
import {
  type FileEditorChange,
  type FileEditorDocument,
  type FileEditorSnapshot,
  type HostReadyContext,
  type ToastRequest,
} from '@openchamber/sdk';

const SOURCE = `---
markmap:
  theme: classic
---

# Root

## Branch

- Leaf
`;

type ReadyListener = Parameters<MarkmapHost['onReady']>[0];
type OpenListener = Parameters<MarkmapHost['onFileOpen']>[0];
type SnapshotHandler = Parameters<MarkmapHost['onFileSnapshot']>[0];
type SavedListener = Parameters<MarkmapHost['onFileSaved']>[0];

type HostHarness = {
  host: MarkmapHost;
  changes: FileEditorChange[];
  urls: string[];
  toasts: () => ToastRequest[];
  unsupported: () => number;
  emitReady: (context: HostReadyContext) => void;
  emitFile: (file: FileEditorDocument) => void;
  snapshot: () => Promise<FileEditorSnapshot>;
  saved: (version: string) => void;
};

const createHost = (): HostHarness => {
  let ready: ReadyListener | null = null;
  let open: OpenListener | null = null;
  let snapshot: SnapshotHandler | null = null;
  let saved: SavedListener | null = null;
  let unsupported = 0;
  const changes: FileEditorChange[] = [];
  const urls: string[] = [];
  const toasts: ToastRequest[] = [];

  const host: MarkmapHost = {
    onReady: (listener) => {
      ready = listener;
      return () => {
        ready = null;
      };
    },
    onFileOpen: (listener) => {
      open = listener;
      return () => {
        open = null;
      };
    },
    onFileSnapshot: (handler) => {
      snapshot = handler;
      return () => {
        snapshot = null;
      };
    },
    onFileSaved: (listener) => {
      saved = listener;
      return () => {
        saved = null;
      };
    },
    reportFileChange: (change) => {
      changes.push(change);
    },
    reportFileUnsupported: () => {
      unsupported += 1;
    },
    openUrl: (url) => {
      urls.push(url);
      return url.startsWith('https://reject.')
        ? Promise.reject(new Error('blocked'))
        : Promise.resolve();
    },
    toast: (request) => {
      toasts.push(request);
      return request.message.startsWith('reject:')
        ? Promise.reject(new Error('toast failed'))
        : Promise.resolve();
    },
  };

  return {
    host,
    changes,
    urls,
    toasts: () => toasts,
    unsupported: () => unsupported,
    emitReady: (context: HostReadyContext) => ready?.(context),
    emitFile: (file: FileEditorDocument) => open?.(file),
    snapshot: async (): Promise<FileEditorSnapshot> => {
      if (snapshot === null) throw new Error('No snapshot handler');
      return snapshot('save');
    },
    saved: (version: string) => saved?.(version),
  };
};

type FakeFactory = {
  factory: MarkmapFactory;
  mounts: MarkmapMount[];
  colorSchemes: MarkmapColorScheme[];
  markers: string[];
  layouts: MarkmapLayout[];
  destroyed: () => number;
  commits: () => number;
  snapshots: () => number;
  notesEdits: () => number;
  groupCreates: () => number;
  setSnapshotContent: (content: string | null) => void;
  beginEditing: () => void;
  isEditing: () => boolean;
  fail: string | null;
};

type MountedApp = {
  host: HostHarness;
  app: ReturnType<typeof mountApp>;
  markmaps: FakeFactory;
};

const createMarkmapFactory = (): FakeFactory => {
  const toolbar = document.createElement('div');
  toolbar.className = 'fake-markmap-toolbar';
  const colorSchemes: MarkmapColorScheme[] = [];
  const markers: string[] = [];
  const layouts: MarkmapLayout[] = [];
  let currentLayout: MarkmapLayout = 'two-sided';
  let destroyCount = 0;
  let commitCount = 0;
  let snapshotCount = 0;
  let notesEditCount = 0;
  let groupCreateCount = 0;
  let snapshotContent: string | null = null;
  let editing = false;
  const view: MarkmapView = {
    get layout() {
      return currentLayout;
    },
    toolbar,
    setLayout: (layout) => {
      currentLayout = layout;
      layouts.push(layout);
    },
    setColorScheme: (scheme) => {
      colorSchemes.push(scheme);
    },
    addMarker: (marker) => {
      markers.push(marker);
    },
    editNotes: () => {
      notesEditCount += 1;
    },
    createGroup: () => {
      groupCreateCount += 1;
    },
    resetView: () => undefined,
    commit: () => {
      commitCount += 1;
      editing = false;
    },
    snapshotForSave: () => {
      snapshotCount += 1;
      return snapshotContent;
    },
    destroy: () => {
      destroyCount += 1;
    },
  };
  const state: FakeFactory = {
    mounts: [],
    colorSchemes,
    markers,
    layouts,
    destroyed: () => destroyCount,
    commits: () => commitCount,
    snapshots: () => snapshotCount,
    notesEdits: () => notesEditCount,
    groupCreates: () => groupCreateCount,
    setSnapshotContent: (content) => {
      snapshotContent = content;
    },
    beginEditing: () => {
      editing = true;
    },
    isEditing: () => editing,
    fail: null,
    factory: (mount) => {
      if (state.fail !== null) return { ok: false, message: state.fail };
      state.mounts.push(mount);
      return { ok: true, view };
    },
  };
  return state;
};

const textFile = (content: string, readOnly = false): FileEditorDocument => ({
  path: 'notes.markmap.md',
  name: 'notes.markmap.md',
  readOnly,
  encoding: 'text',
  content,
});

const contentOf = (snapshot: FileEditorSnapshot): string =>
  'content' in snapshot ? snapshot.content : '';

const createEditView = (element: Element): EditView => {
  const foldedIds = new Set<string>();
  return {
    element,
    scale: 1,
    transform: { k: 1, x: 0, y: 0 },
    foldedIds,
    panBy: () => undefined,
    setTree: () => undefined,
    setFolded: (id, folded) => {
      if (folded) foldedIds.add(id);
      else foldedIds.delete(id);
    },
    setFoldedIds: (ids) => {
      foldedIds.clear();
      for (const id of ids) foldedIds.add(id);
    },
    toggle: (id) => {
      if (foldedIds.has(id)) foldedIds.delete(id);
      else foldedIds.add(id);
    },
    focusNode: () => true,
    screenRect: () => ({ x: 0, y: 0, width: 120, height: 24 }),
    direction: () => 'right',
    hitAt: () => undefined,
    layoutPoint: (clientX, clientY) => [clientX, clientY],
    on: () => () => undefined,
  };
};

type RealEditorFactory = {
  factory: MarkmapFactory;
  editor: () => MarkmapEditor | null;
  snapshots: () => number;
};

const createRealEditorFactory = (): RealEditorFactory => {
  const toolbar = document.createElement('div');
  let created: MarkmapEditor | null = null;
  let snapshotCount = 0;
  const factory: MarkmapFactory = (mount) => {
    const editor = new MarkmapEditor({
      source: mount.markdown,
      view: createEditView(mount.surface),
      container: mount.surface,
      placeholder: '\u200B',
      onChange: (change) => {
        mount.onSource({ source: change.source, selection: change.selection });
      },
      onDraftChange: (change) => {
        mount.onDraft({ source: change.source, selection: change.selection });
      },
      onError: (error) => {
        mount.onError(error.message);
      },
    });
    created = editor;
    editor.focus();
    const view: MarkmapView = {
      layout: 'two-sided',
      toolbar,
      setLayout: () => undefined,
      setColorScheme: () => undefined,
      addMarker: () => undefined,
      editNotes: () => {
        editor.editNotes();
      },
      createGroup: () => {
        editor.createGroup();
      },
      resetView: () => undefined,
      commit: () => {
        editor.commit();
      },
      snapshotForSave: () => {
        snapshotCount += 1;
        return editor.snapshot();
      },
      destroy: () => {
        editor.destroy();
      },
    };
    return { ok: true, view };
  };
  return { factory, editor: () => created, snapshots: () => snapshotCount };
};

describe('Markmap file editor', () => {
  let root: HTMLDivElement;
  const disposers: (() => void)[] = [];

  beforeEach(() => {
    document.body.replaceChildren();
    document.head.replaceChildren();
    root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);
  });

  afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
  });

  const mount = (options: Partial<MountOptions> = {}): MountedApp => {
    const host = createHost();
    const markmaps = createMarkmapFactory();
    const app = mountApp(host.host, root, {
      createMarkmap: markmaps.factory,
      ...options,
    });
    disposers.push(app.dispose);
    return { host, app, markmaps };
  };

  test('[R-02] renders a text file as an editable Markmap', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));

    expect(markmaps.mounts).toHaveLength(1);
    expect(markmaps.mounts[0]?.markdown).toBe(SOURCE);
    expect(markmaps.mounts[0]?.editable).toBe(true);
    expect(markmaps.mounts[0]?.svg).toBe(root.querySelector('.mm-markmap-svg'));
    expect(markmaps.mounts[0]?.surface).toBe(root.querySelector('.mm-editor-surface'));
    expect(root.querySelector('.mm-markmap-toolbar')?.childElementCount).toBe(5);
    expect(root.querySelector('.mm-error')).toBeNull();
  });

  test('[R-22] switches the layout from the toolbar without changing the file', async () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const tree = root.querySelector<HTMLButtonElement>('button[data-layout="tree"]');
    const twoSided = root.querySelector<HTMLButtonElement>('button[data-layout="two-sided"]');
    if (tree === null || twoSided === null) throw new Error('No layout buttons');

    expect(twoSided.getAttribute('aria-pressed')).toBe('true');
    tree.click();

    expect(markmaps.layouts).toEqual(['tree']);
    expect(tree.getAttribute('aria-pressed')).toBe('true');
    expect(twoSided.getAttribute('aria-pressed')).toBe('false');
    expect(host.changes).toHaveLength(0);
    expect(contentOf(await host.snapshot())).toBe(SOURCE);
  });

  test('[R-22] keeps the layout buttons on a read-only file', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE, true));
    const chart = root.querySelector<HTMLButtonElement>('button[data-layout="org-chart"]');
    if (chart === null) throw new Error('No layout buttons');

    chart.click();

    expect(markmaps.layouts).toEqual(['org-chart']);
    expect(root.querySelector('.mm-marker-menu')).toBeNull();
    expect(root.querySelector('.mm-notes-menu')).toBeNull();
    expect(root.querySelector('.mm-group-menu')).toBeNull();
  });

  test('[R-36] creates group from the toolbar', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const button = root.querySelector<HTMLButtonElement>('.mm-group-menu button');
    if (button === null) throw new Error('No group button');

    button.click();

    expect(markmaps.groupCreates()).toBe(1);
  });

  test('[R-18] adds the chosen marker from the toolbar', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const button = root.querySelector<HTMLButtonElement>('.mm-marker-toolbar-button');
    if (button === null) throw new Error('No marker menu');

    button.click();

    const popover = document.body.querySelector('.mm-marker-popover');
    if (popover === null) throw new Error('No marker popover');
    const doneButton = popover.querySelector<HTMLButtonElement>('button[data-glyph="✅"]');
    doneButton?.click();

    expect(markmaps.markers).toEqual(['✅']);
  });

  test('[R-18] hides the marker menu on a read-only file', () => {
    const { host } = mount();
    host.emitFile(textFile(SOURCE, true));

    expect(root.querySelector('.mm-marker-menu')).toBeNull();
  });

  test('[R-26] opens the notes editor from the toolbar', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const button = root.querySelector<HTMLButtonElement>('button[aria-label="Edit notes"]');
    if (button === null) throw new Error('No notes button');

    button.click();

    expect(markmaps.notesEdits()).toBe(1);
  });

  test('[R-12] creates a read-only map without the node editor', async () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE, true));

    expect(markmaps.mounts[0]?.editable).toBe(false);
    expect(contentOf(await host.snapshot())).toBe(SOURCE);
  });

  test('[R-17] forwards a node link to the host', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));

    markmaps.mounts[0]?.onOpenUrl('https://example.com/docs');

    expect(host.urls).toEqual(['https://example.com/docs']);
  });

  test('[R-17] ignores a rejected host link', async () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));

    markmaps.mounts[0]?.onOpenUrl('https://reject.example/docs');
    await Promise.resolve();

    expect(host.urls).toEqual(['https://reject.example/docs']);
  });

  test('[R-16] passes an empty file through without changing it', async () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(''));

    expect(markmaps.mounts[0]?.markdown).toBe('');
    expect(contentOf(await host.snapshot())).toBe('');
  });

  test('[R-11] applies a map edit to the snapshot and dirty state', async () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const next = '# Changed\n\n## Branch\n\n- Leaf\n';
    const mountCall = markmaps.mounts[0];
    if (mountCall === undefined) throw new Error('No mount');

    mountCall.onSource({ source: next, selection: 0 });

    expect(host.changes.at(-1)).toEqual({ dirty: true, edited: true });
    const snapshot = await host.snapshot();
    expect(contentOf(snapshot)).toBe(next);
    host.saved(snapshot.version);
    expect(host.changes.at(-1)?.dirty).toBe(false);
  });

  test('[R-05] [R-09] snapshots the original text unchanged', async () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));

    const snapshot = await host.snapshot();
    expect(contentOf(snapshot)).toBe(SOURCE);
    expect(markmaps.commits()).toBe(0);
    expect(markmaps.snapshots()).toBe(1);
    expect((await host.snapshot()).version).toBe(snapshot.version);
  });

  test('[R-20] snapshots an active label draft without a source event', async () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const inProgress = '# Root\n\n## Branch\n\n- Leaf in progress\n';
    markmaps.setSnapshotContent(inProgress);
    markmaps.beginEditing();

    const snapshot = await host.snapshot();

    expect(contentOf(snapshot)).toBe(inProgress);
    expect(markmaps.snapshots()).toBe(1);
    expect(markmaps.commits()).toBe(0);
    expect(markmaps.isEditing()).toBe(true);
    expect(host.changes).toEqual([{ dirty: true, edited: true }]);
  });

  test('[R-20] reports a label draft before the first snapshot', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const draft = '# Root\n\n## Branch\n\n- Leaf draft\n';
    markmaps.beginEditing();
    const mountCall = markmaps.mounts[0];
    if (mountCall === undefined) throw new Error('No mount');

    mountCall.onDraft({ source: draft, selection: 0 });

    expect(host.changes).toEqual([{ dirty: true, edited: true }]);
    expect(markmaps.snapshots()).toBe(0);
    expect(markmaps.isEditing()).toBe(true);
  });

  test('[R-20] ignores an unchanged draft after a label session starts', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const mountCall = markmaps.mounts[0];
    if (mountCall === undefined) throw new Error('No mount');

    mountCall.onDraft({ source: SOURCE, selection: 0 });

    expect(host.changes).toHaveLength(0);
  });

  test('[R-20] ignores a committed source already reported as a draft', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const draft = '# Root\n\n## Branch\n\n- Leaf draft\n';
    const mountCall = markmaps.mounts[0];
    if (mountCall === undefined) throw new Error('No mount');

    mountCall.onDraft({ source: draft, selection: 0 });
    mountCall.onSource({ source: draft, selection: 0 });

    expect(host.changes).toEqual([{ dirty: true, edited: true }]);
  });

  test('[R-20] returns a reported draft from the snapshot without a second event', async () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const draft = '# Root\n\n## Branch\n\n- Leaf draft\n';
    const mountCall = markmaps.mounts[0];
    if (mountCall === undefined) throw new Error('No mount');

    mountCall.onDraft({ source: draft, selection: 0 });
    markmaps.setSnapshotContent(draft);
    const snapshot = await host.snapshot();

    expect(contentOf(snapshot)).toBe(draft);
    expect(host.changes).toEqual([{ dirty: true, edited: true }]);
  });

  test('[R-20] keeps a newer draft dirty after an older save acknowledgment', async () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const older = '# Root\n\n## Branch\n\n- Older\n';
    const newer = '# Root\n\n## Branch\n\n- Newer\n';
    const mountCall = markmaps.mounts[0];
    if (mountCall === undefined) throw new Error('No mount');

    mountCall.onDraft({ source: older, selection: 0 });
    markmaps.setSnapshotContent(older);
    const olderSnapshot = await host.snapshot();
    mountCall.onDraft({ source: newer, selection: 0 });
    markmaps.setSnapshotContent(newer);

    host.saved(olderSnapshot.version);

    expect(host.changes.at(-1)).toEqual({ dirty: true, edited: false });
    const current = await host.snapshot();
    expect(contentOf(current)).toBe(newer);
    expect(current.version).not.toBe(olderSnapshot.version);
  });

  test('[R-20] reports the baseline when a label draft is cancelled', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const mountCall = markmaps.mounts[0];
    if (mountCall === undefined) throw new Error('No mount');

    mountCall.onDraft({ source: '# Root\n\n## Branch\n\n- Draft\n', selection: 0 });
    mountCall.onDraft({ source: SOURCE, selection: 0 });

    expect(host.changes.at(-1)).toEqual({ dirty: false, edited: true });
  });

  test('[R-20] clears dirty when the draft version is saved', async () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    markmaps.setSnapshotContent('# Root\n\n## Branch\n\n- Leaf draft\n');

    const snapshot = await host.snapshot();
    host.saved(snapshot.version);

    expect(host.changes.at(-1)).toEqual({ dirty: false, edited: false });
  });

  test('[R-20] ignores a repeated identical draft snapshot', async () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    markmaps.setSnapshotContent('# Root\n\n## Branch\n\n- Leaf draft\n');

    const snapshot = await host.snapshot();
    const repeated = await host.snapshot();

    expect(repeated).toEqual(snapshot);
    expect(host.changes).toEqual([{ dirty: true, edited: true }]);
  });

  test('[R-20] marks the baseline dirty when a hidden draft is cancelled after a save', async () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const draft = '# Root\n\n## Branch\n\n- Leaf draft\n';
    const mountCall = markmaps.mounts[0];
    if (mountCall === undefined) throw new Error('No mount');

    mountCall.onDraft({ source: draft, selection: 0 });
    markmaps.setSnapshotContent(draft);
    const snapshot = await host.snapshot();
    host.saved(snapshot.version);
    mountCall.onDraft({ source: SOURCE, selection: 0 });
    markmaps.setSnapshotContent(SOURCE);

    expect(host.changes.at(-1)).toEqual({ dirty: true, edited: true });
    const baseline = await host.snapshot();
    expect(contentOf(baseline)).toBe(SOURCE);
    expect(host.changes).toHaveLength(3);
  });

  test('[R-12] snapshots a read-only file without reporting a change', async () => {
    const { host } = mount();
    host.emitFile(textFile(SOURCE, true));

    const snapshot = await host.snapshot();
    const repeated = await host.snapshot();

    expect(contentOf(snapshot)).toBe(SOURCE);
    expect(repeated.version).toBe(snapshot.version);
    expect(host.changes).toHaveLength(0);
  });

  test('[R-12] ignores a label draft on a read-only file', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE, true));
    const mountCall = markmaps.mounts[0];
    if (mountCall === undefined) throw new Error('No mount');

    mountCall.onDraft({ source: '# Changed\n', selection: 0 });

    expect(host.changes).toHaveLength(0);
  });

  test('[R-07] drops a label draft when another file opens', async () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const mountCall = markmaps.mounts[0];
    if (mountCall === undefined) throw new Error('No mount');
    mountCall.onDraft({ source: '# Root\n\n## Branch\n\n- Draft\n', selection: 0 });

    host.emitFile(textFile('# Other\n'));
    markmaps.setSnapshotContent(null);

    expect(markmaps.mounts).toHaveLength(2);
    expect(contentOf(await host.snapshot())).toBe('# Other\n');
    expect(host.changes).toHaveLength(1);
  });

  test('[R-05] round-trips an unchanged file byte for byte', async () => {
    const source = '\uFEFF---\r\ntitle: Root\r\n---\r\n\r\n- Leaf\r\n';
    const { host } = mount();
    host.emitFile(textFile(source));

    const snapshot = await host.snapshot();

    expect(contentOf(snapshot)).toBe(source);
    expect(host.changes).toHaveLength(0);
  });

  test('[R-06] reports a binary file and hands its bytes back', async () => {
    const { host, markmaps } = mount();
    const bytes = new Uint8Array([1, 2, 3]);
    host.emitFile({
      path: 'notes.markmap.md',
      name: 'notes.markmap.md',
      readOnly: false,
      encoding: 'binary',
      bytes,
    });

    expect(host.unsupported()).toBe(1);
    expect(markmaps.mounts).toHaveLength(0);
    expect(root.querySelector('.mm-error')?.textContent).toContain('text files');
    const snapshot = await host.snapshot();
    expect('bytes' in snapshot ? snapshot.bytes : null).toBe(bytes);
    expect(host.changes).toHaveLength(0);
  });

  test('[R-06] derives a binary version from the bytes', async () => {
    const { host } = mount();
    const first = new Uint8Array([1, 2, 3]);
    const second = new Uint8Array([1, 2, 4]);
    const open = (bytes: Uint8Array<ArrayBuffer>): void => {
      host.emitFile({
        path: 'notes.markmap.md',
        name: 'notes.markmap.md',
        readOnly: false,
        encoding: 'binary',
        bytes,
      });
    };

    open(first);
    const firstSnapshot = await host.snapshot();
    open(second);
    const secondSnapshot = await host.snapshot();

    expect(firstSnapshot.version).not.toBe(secondSnapshot.version);

    open(first);
    const repeated = await host.snapshot();

    expect(repeated.version).toBe(firstSnapshot.version);
    expect('bytes' in repeated ? repeated.bytes : null).toBe(first);
  });

  test('[R-06] reports a Markmap creation failure and asks for the source view', () => {
    const { host, markmaps } = mount();
    markmaps.fail = 'Broken markdown';
    host.emitFile(textFile(SOURCE));

    expect(host.unsupported()).toBe(1);
    expect(markmaps.mounts).toHaveLength(0);
    expect(root.querySelector('.mm-error')?.textContent).toContain('Broken markdown');
  });

  test('[R-04] applies the host colour scheme without recreating the view', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    expect(markmaps.mounts[0]?.colorScheme).toBe('dark');

    host.emitReady(devContext('light'));
    expect(markmaps.colorSchemes.at(-1)).toBe('light');

    host.emitReady(devContext('light'));
    expect(markmaps.colorSchemes).toHaveLength(1);

    host.emitReady(devContext('dark'));
    expect(markmaps.colorSchemes.at(-1)).toBe('dark');
    expect(markmaps.mounts).toHaveLength(1);
  });

  test('[R-04] uses the ready scheme for the first render', () => {
    const { host, markmaps } = mount();
    host.emitReady(devContext('light'));
    host.emitFile(textFile(SOURCE));

    expect(markmaps.mounts[0]?.colorScheme).toBe('light');
  });

  test('[R-13] shows and clears an editor error', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const mountCall = markmaps.mounts[0];
    if (mountCall === undefined) throw new Error('No mount');

    mountCall.onError('Heading cannot contain a line break');
    expect(root.querySelector('.mm-notice')?.textContent).toContain('Heading cannot');

    mountCall.onSource({ source: SOURCE, selection: 0 });
    expect(root.querySelector('.mm-notice')?.hasAttribute('hidden')).toBe(true);
  });

  test('[R-07] destroys the previous view when another file opens', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    host.emitFile(textFile('# Other\n'));

    expect(markmaps.mounts).toHaveLength(2);
    expect(markmaps.destroyed()).toBe(1);
  });

  test('[R-07] destroys the view and clears the frame on dispose', () => {
    const { host, app, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const mountCall = markmaps.mounts[0];
    if (mountCall === undefined) throw new Error('No mount');
    mountCall.onDraft({ source: '# Root\n\n## Branch\n\n- Draft\n', selection: 0 });

    app.dispose();
    mountCall.onDraft({ source: '# Stale\n', selection: 0 });

    expect(markmaps.destroyed()).toBe(1);
    expect(root.childElementCount).toBe(0);
    expect(host.changes).toHaveLength(1);
  });

  test('[R-20] runs the draft protocol through the real editor and save tracker', async () => {
    const host = createHost();
    const real = createRealEditorFactory();
    const app = mountApp(host.host, root, { createMarkmap: real.factory });
    disposers.push(app.dispose);
    host.emitFile(textFile('# Root\n\n## Branch\n'));

    const editor = real.editor();
    if (editor === null) throw new Error('No editor');
    const surface = root.querySelector<HTMLElement>('.mm-editor-surface');
    if (surface === null) throw new Error('No surface');
    const fieldOf = (): HTMLTextAreaElement => {
      const field = root.querySelector<HTMLTextAreaElement>('textarea.mm-editor-field');
      if (field === null) throw new Error('No field');
      return field;
    };
    const press = (key: string): void => {
      surface.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    };
    const typeText = (text: string): void => {
      const field = fieldOf();
      field.value = text;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    };

    press(' ');
    expect(fieldOf().value).toBe('Root');
    expect(host.changes).toHaveLength(0);

    typeText('Root draft');
    expect(host.changes).toEqual([{ dirty: true, edited: true }]);
    expect(real.snapshots()).toBe(0);

    const draft = await host.snapshot();
    expect(contentOf(draft)).toBe('# Root draft\n\n## Branch\n');
    expect(real.snapshots()).toBe(1);
    expect(host.changes).toHaveLength(1);

    host.saved(draft.version);
    expect(host.changes.at(-1)).toEqual({ dirty: false, edited: false });

    typeText('Root newer');
    expect(host.changes.at(-1)).toEqual({ dirty: true, edited: true });
    const newer = await host.snapshot();
    expect(contentOf(newer)).toBe('# Root newer\n\n## Branch\n');
    host.saved(draft.version);
    expect(host.changes.at(-1)).toEqual({ dirty: true, edited: false });

    press('Escape');
    expect(fieldOf().style.display).toBe('none');
    expect(host.changes.at(-1)).toEqual({ dirty: true, edited: true });
    const baseline = await host.snapshot();
    expect(contentOf(baseline)).toBe('# Root\n\n## Branch\n');
    expect(editor.source).toBe('# Root\n\n## Branch\n');

    press(' ');
    typeText('Root final');
    expect(host.changes.at(-1)).toEqual({ dirty: true, edited: true });
    press('Enter');

    expect(editor.source).toBe('# Root final\n\n## Branch\n');
    expect(host.changes).toHaveLength(6);
    expect(editor.canUndo).toBe(true);

    expect(editor.undo()).toBe(true);
    expect(editor.source).toBe('# Root\n\n## Branch\n');
    expect(editor.canUndo).toBe(false);
  });

  test('[R-20] does not publish an invalid draft after a valid one', async () => {
    const host = createHost();
    const real = createRealEditorFactory();
    const app = mountApp(host.host, root, { createMarkmap: real.factory });
    disposers.push(app.dispose);
    host.emitFile(textFile('# Root\n\n## Branch\n'));

    const editor = real.editor();
    if (editor === null) throw new Error('No editor');
    const surface = root.querySelector<HTMLElement>('.mm-editor-surface');
    if (surface === null) throw new Error('No surface');
    const field = root.querySelector<HTMLTextAreaElement>('textarea.mm-editor-field');
    if (field === null) throw new Error('No field');

    surface.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    );
    field.value = 'Root valid';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(host.changes).toEqual([{ dirty: true, edited: true }]);
    const valid = await host.snapshot();
    expect(contentOf(valid)).toBe('# Root valid\n\n## Branch\n');
    host.saved(valid.version);
    expect(host.changes.at(-1)).toEqual({ dirty: false, edited: false });

    field.value = 'Root\ninvalid';
    field.dispatchEvent(new Event('input', { bubbles: true }));

    expect(host.changes).toHaveLength(2);
    expect(host.changes.at(-1)).toEqual({ dirty: false, edited: false });
    expect(editor.isEditing).toBe(true);
    const afterInvalid = await host.snapshot();
    expect(contentOf(afterInvalid)).toBe('# Root valid\n\n## Branch\n');
  });

  test('[R-20] tolerates repeated snapshots from a draft callback', async () => {
    const host = createHost();
    const real = createRealEditorFactory();
    let reentrantSnapshots = 0;
    const factory: MarkmapFactory = (mountOptions) => {
      const result = real.factory({
        ...mountOptions,
        onDraft: (change) => {
          mountOptions.onDraft(change);
          reentrantSnapshots += 1;
          void host.snapshot();
          reentrantSnapshots += 1;
          void host.snapshot();
        },
      });
      return result;
    };
    const app = mountApp(host.host, root, { createMarkmap: factory });
    disposers.push(app.dispose);
    host.emitFile(textFile('# Root\n\n## Branch\n'));

    const surface = root.querySelector<HTMLElement>('.mm-editor-surface');
    if (surface === null) throw new Error('No surface');
    const field = root.querySelector<HTMLTextAreaElement>('textarea.mm-editor-field');
    if (field === null) throw new Error('No field');

    surface.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    );
    field.value = 'Root draft';
    field.dispatchEvent(new Event('input', { bubbles: true }));

    expect(reentrantSnapshots).toBe(2);
    expect(host.changes).toEqual([{ dirty: true, edited: true }]);
    const snapshot = await host.snapshot();
    expect(contentOf(snapshot)).toBe('# Root draft\n\n## Branch\n');
    expect(host.changes).toEqual([{ dirty: true, edited: true }]);
  });

  test('[R-02] keeps the frame empty before a file arrives', () => {
    const { host, markmaps } = mount();
    host.emitReady(devContext('light'));

    expect(markmaps.mounts).toHaveLength(0);
    expect(root.querySelector('.mm-error')).toBeNull();
    expect(root.querySelector('.mm-editor-surface')).not.toBeNull();
  });

  test('[R-38] shows host toast when convention issues are reported', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile('# Root\n'));

    expect(markmaps.mounts).toHaveLength(1);
    const lastMount = markmaps.mounts[0];
    if (lastMount === undefined) throw new Error('No mount');

    expect(host.toasts()).toHaveLength(0);

    lastMount.onDiagnostics?.([{ code: 'E_IDENTITY', message: 'Duplicate identity' }]);
    expect(host.toasts()).toEqual([
      { kind: 'error', message: 'Duplicate identity', dismiss: true },
    ]);

    lastMount.onDiagnostics?.([
      { code: 'E_IDENTITY', message: 'Issue 1' },
      { code: 'E_GRAPH', message: 'Issue 2' },
    ]);
    expect(host.toasts().at(-1)).toEqual({
      kind: 'error',
      message: '2 convention issues: Issue 1, Issue 2',
      dismiss: true,
    });
  });

  test('[R-38] ignores empty diagnostics lists', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile('# Root\n'));

    const lastMount = markmaps.mounts[0];
    if (lastMount === undefined) throw new Error('No mount');

    lastMount.onDiagnostics?.([]);
    expect(host.toasts()).toHaveLength(0);
  });

  test('[R-38] ignores a rejected toast promise', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile('# Root\n'));

    const lastMount = markmaps.mounts[0];
    if (lastMount === undefined) throw new Error('No mount');

    lastMount.onDiagnostics?.([{ code: 'E_IDENTITY', message: 'reject: fail' }]);
    expect(host.toasts()).toHaveLength(1);
  });

  test('[R-38] preserves document bytes and keeps notice hidden in fail-safe mode', async () => {
    const invalidSource = '# Root\n\n- Node A <!-- ^a -->\n- Node B <!-- ^a -->\n';
    const { host } = mount();
    host.emitFile(textFile(invalidSource));

    const notice = root.querySelector<HTMLElement>('.mm-notice');
    if (notice === null) throw new Error('No notice');
    expect(notice.hidden).toBe(true);

    const snap = await host.snapshot();
    expect(contentOf(snap)).toBe(invalidSource);
  });
});
