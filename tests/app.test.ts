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
import {
  type FileEditorChange,
  type FileEditorDocument,
  type FileEditorSnapshot,
  type HostReadyContext,
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
  };

  return {
    host,
    changes,
    urls,
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
  setSnapshotContent: (content: string) => void;
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
  let snapshotContent: string | null = null;
  let editing = false;
  let mounted: MarkmapMount | null = null;
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
    resetView: () => undefined,
    commit: () => {
      commitCount += 1;
      editing = false;
    },
    snapshotForSave: () => {
      snapshotCount += 1;
      if (snapshotContent !== null) mounted?.onSource({ source: snapshotContent, selection: 0 });
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
      mounted = mount;
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
    expect(root.querySelector('.mm-markmap-toolbar')?.childElementCount).toBe(4);
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
    expect(root.querySelector('.mm-marker-select')).toBeNull();
    expect(root.querySelector('.mm-notes-menu')).toBeNull();
  });

  test('[R-18] adds the chosen marker from the toolbar', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    const select = root.querySelector<HTMLSelectElement>('.mm-marker-select');
    if (select === null) throw new Error('No marker menu');

    select.value = '✅';
    select.dispatchEvent(new Event('change'));

    expect(markmaps.markers).toEqual(['✅']);
  });

  test('[R-18] hides the marker menu on a read-only file', () => {
    const { host } = mount();
    host.emitFile(textFile(SOURCE, true));

    expect(root.querySelector('.mm-marker-select')).toBeNull();
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

  test('[R-20] snapshots active edit text without ending editing', async () => {
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
    expect(host.changes.at(-1)).toEqual({ dirty: true, edited: true });
    host.saved(snapshot.version);
    expect(host.changes.at(-1)).toEqual({ dirty: false, edited: false });
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
    app.dispose();

    expect(markmaps.destroyed()).toBe(1);
    expect(root.childElementCount).toBe(0);
  });

  test('[R-02] keeps the frame empty before a file arrives', () => {
    const { host, markmaps } = mount();
    host.emitReady(devContext('light'));

    expect(markmaps.mounts).toHaveLength(0);
    expect(root.querySelector('.mm-error')).toBeNull();
    expect(root.querySelector('.mm-editor-surface')).not.toBeNull();
  });
});
