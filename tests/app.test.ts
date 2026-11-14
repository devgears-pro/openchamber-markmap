import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { mountApp, type MarkmapHost, type MountOptions } from '../src/app';
import type { MarkmapColorScheme, MarkmapFactory, MarkmapView } from '../src/markmap/view';
import {
  EMPTY_GUEST_CONNECTION,
  type FileEditorDocument,
  type FileEditorSnapshot,
  type HostReadyContext,
  type HostThemeMode,
  type HostThemeTokens,
} from '@openchamber/sdk';

const SOURCE = `---
markmap:
  colorScheme: light
---

# Root

## Branch

- Leaf
`;

type ReadyListener = Parameters<MarkmapHost['onReady']>[0];
type OpenListener = Parameters<MarkmapHost['onFileOpen']>[0];
type SnapshotHandler = Parameters<MarkmapHost['onFileSnapshot']>[0];

const createHost = () => {
  let ready: ReadyListener | null = null;
  let open: OpenListener | null = null;
  let snapshot: SnapshotHandler | null = null;
  let unsupported = 0;

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
    reportFileUnsupported: () => {
      unsupported += 1;
    },
  };

  return {
    host,
    unsupported: () => unsupported,
    emitReady: (context: HostReadyContext) => ready?.(context),
    emitFile: (file: FileEditorDocument) => open?.(file),
    snapshot: async (): Promise<FileEditorSnapshot> => {
      if (snapshot === null) throw new Error('No snapshot handler');
      return snapshot('save');
    },
  };
};

type FakeMarkmap = {
  markdown: string;
  scheme: MarkmapColorScheme;
  view: MarkmapView;
  updates: { markdown: string; scheme: MarkmapColorScheme }[];
  destroyed: boolean;
};

type FakeMarkmapFactory = {
  factory: MarkmapFactory;
  created: FakeMarkmap[];
  fail: string | null;
  updateError: unknown;
};

const createMarkmapFactory = (): FakeMarkmapFactory => {
  const state: FakeMarkmapFactory = {
    created: [],
    fail: null,
    updateError: null,
    factory: (_svg, markdown, scheme) => {
      if (state.fail !== null) return { ok: false, message: state.fail };
      const toolbar = document.createElement('div');
      const entry: FakeMarkmap = {
        markdown,
        scheme,
        updates: [],
        destroyed: false,
        view: {
          toolbar,
          update: (nextMarkdown, nextScheme) => {
            if (state.updateError !== null) throw state.updateError;
            entry.markdown = nextMarkdown;
            entry.scheme = nextScheme;
            entry.updates.push({ markdown: nextMarkdown, scheme: nextScheme });
          },
          destroy: () => {
            entry.destroyed = true;
          },
        },
      };
      state.created.push(entry);
      return { ok: true, view: entry.view };
    },
  };
  return state;
};

const readyContext = (mode: HostThemeMode): HostReadyContext => ({
  theme: { mode, tokens: {} as HostThemeTokens },
  locale: 'en',
  directory: null,
  session: null,
  surface: 'file',
  connection: EMPTY_GUEST_CONNECTION,
  settings: {},
  item: null,
});

const textFile = (content: string): FileEditorDocument => ({
  path: 'notes.markmap.md',
  name: 'notes.markmap.md',
  readOnly: false,
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

  const mount = (options: Partial<MountOptions> = {}) => {
    const host = createHost();
    const markmaps = createMarkmapFactory();
    const app = mountApp(host.host, root, {
      createMarkmap: markmaps.factory,
      ...options,
    });
    disposers.push(app.dispose);
    return { host, app, markmaps };
  };

  test('[R-02] renders the opened file as a Markmap', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));

    expect(markmaps.created).toHaveLength(1);
    expect(markmaps.created[0]?.markdown).toBe(SOURCE);
    expect(root.querySelector('.mm-markmap-svg')).not.toBeNull();
    expect(root.querySelector('.mm-markmap-toolbar')?.childElementCount).toBe(1);
    expect(root.querySelector('.mm-error')).toBeNull();
  });

  test('[R-03] [R-10] shows the Markdown source in the sidebar', () => {
    const { host } = mount();
    host.emitFile(textFile(SOURCE));

    expect(root.querySelector('.mm-source')?.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('.mm-source')?.textContent).toBe(SOURCE);
    expect(root.querySelector('.mm-source')?.getAttribute('aria-label')).toBe('Markdown source');
    expect(root.querySelector('.mm-markmap-svg')?.getAttribute('role')).toBe('img');
    expect(root.querySelector('.mm-markmap-svg')?.getAttribute('aria-label')).toBe(
      'Markmap mind map',
    );
  });

  test('[R-05] [R-09] snapshots the original text unchanged', async () => {
    const { host } = mount();
    host.emitFile(textFile(SOURCE));

    const snapshot = await host.snapshot();
    expect(contentOf(snapshot)).toBe(SOURCE);
    expect((await host.snapshot()).version).toBe(snapshot.version);
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
    expect(markmaps.created).toHaveLength(0);
    expect(root.querySelector('.mm-source')?.hasAttribute('hidden')).toBe(true);
    const snapshot = await host.snapshot();
    expect('bytes' in snapshot ? snapshot.bytes : null).toBe(bytes);
  });

  test('[R-06] reports a Markmap parsing failure and asks for the source view', () => {
    const { host, markmaps } = mount();
    markmaps.fail = 'Broken markdown';
    host.emitFile(textFile(SOURCE));

    expect(host.unsupported()).toBe(1);
    expect(markmaps.created).toHaveLength(0);
    expect(root.querySelector('.mm-error')?.textContent).toContain('Broken markdown');
  });

  test('[R-04] applies the host colour scheme on ready', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    expect(markmaps.created[0]?.scheme).toBe('dark');

    host.emitReady(readyContext('light'));
    expect(markmaps.created[0]?.updates.at(-1)?.scheme).toBe('light');

    host.emitReady(readyContext('dark'));
    expect(markmaps.created[0]?.updates.at(-1)?.scheme).toBe('dark');
  });

  test('[R-04] keeps the view when the scheme does not change', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    host.emitReady(readyContext('dark'));

    expect(markmaps.created[0]?.updates).toHaveLength(0);
  });

  test('[R-04] uses the ready scheme for the first render', () => {
    const { host, markmaps } = mount();
    host.emitReady(readyContext('dark'));
    host.emitFile(textFile(SOURCE));

    expect(markmaps.created[0]?.scheme).toBe('dark');
  });

  test('[R-06] reports a Markmap update failure', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    markmaps.updateError = 'Update failed';
    host.emitReady(readyContext('light'));

    expect(host.unsupported()).toBe(1);
    expect(markmaps.created[0]?.destroyed).toBe(true);
    expect(root.querySelector('.mm-error')?.textContent).toContain('Update failed');
  });

  test('[R-06] reports an Error update failure', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    markmaps.updateError = new Error('Update crashed');
    host.emitReady(readyContext('light'));

    expect(root.querySelector('.mm-error')?.textContent).toContain('Update crashed');
  });

  test('[R-07] destroys the previous view when another file opens', () => {
    const { host, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    host.emitFile(textFile('# Other\n'));

    expect(markmaps.created).toHaveLength(2);
    expect(markmaps.created[0]?.destroyed).toBe(true);
    expect(markmaps.created[1]?.destroyed).toBe(false);
  });

  test('[R-07] destroys the view and clears the frame on dispose', () => {
    const { host, app, markmaps } = mount();
    host.emitFile(textFile(SOURCE));
    app.dispose();

    expect(markmaps.created[0]?.destroyed).toBe(true);
    expect(root.childElementCount).toBe(0);
  });

  test('[R-02] keeps the frame empty before a file arrives', () => {
    const { host, markmaps } = mount();
    host.emitReady(readyContext('light'));

    expect(markmaps.created).toHaveLength(0);
    expect(root.querySelector('.mm-error')).toBeNull();
    expect(root.querySelector('.mm-markmap-svg')).not.toBeNull();
  });
});
