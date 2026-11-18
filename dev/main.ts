import type { FileEditorChange } from '@openchamber/sdk';

import { mountApp, type MarkmapHost } from '../src/app';
import { createMarkmapView } from '../src/markmap/view';
import { benchmarkMarkdown } from './benchmark';
import { devContext } from './theme';
import palette from './palette.md?raw';
import paletteColor from './palette-color.md?raw';
import sample from './sample.md?raw';
import graph from './graph.md?raw';
import relationshipRouting from './relationship-routing.md?raw';
import move from './move.md?raw';
import notes from './notes.md?raw';
import showcase from './showcase.md?raw';
import title from './title.md?raw';
import titleBody from './title-body.md?raw';
import titleSingle from './title-single.md?raw';
import titleList from './title-list.md?raw';
import products from './products.md?raw';
import deep from './deep.md?raw';
import singleH2 from './single-h2.md?raw';
import twoH2 from './two-h2.md?raw';
import twoH1 from './two-h1.txt?raw';
import listOnly from './list-only.md?raw';
import frontmatterOnly from './frontmatter-only.md?raw';
import nested from './nested.md?raw';

type DevSnapshot = { content: string; version: string };

declare global {
  interface Window {
    devFileSnapshot: () => Promise<string | null>;
    devFileChangeSummary: () => { count: number; dirty: boolean };
    devAutosave: () => Promise<DevSnapshot | null>;
    devAcknowledgeOlder: () => void;
    __devSnapshot?: string;
  }
}

const root = document.querySelector<HTMLElement>('#root');
if (root === null) throw new Error('Missing #root');

const params = new URLSearchParams(window.location.search);
const mode = params.get('theme') === 'light' ? 'light' : 'dark';
const maps: Record<string, { content: string; name: string }> = {
  empty: { content: '', name: 'empty.markmap.md' },
  showcase: { content: showcase, name: 'showcase.markmap.md' },
  graph: { content: graph, name: 'graph.markmap.md' },
  'relationship-routing': {
    content: relationshipRouting,
    name: 'relationship-routing.markmap.md',
  },
  notes: { content: notes, name: 'notes.markmap.md' },
  move: { content: move, name: 'move.markmap.md' },
  title: { content: title, name: 'title.markmap.md' },
  'title-body': { content: titleBody, name: 'title-body.markmap.md' },
  'title-single': { content: titleSingle, name: 'title-single.markmap.md' },
  'title-list': { content: titleList, name: 'title-list.markmap.md' },
  products: { content: products, name: 'products.markmap.md' },
  deep: { content: deep, name: 'deep.markmap.md' },
  'single-h2': { content: singleH2, name: 'single-h2.markmap.md' },
  'two-h2': { content: twoH2, name: 'two-h2.markmap.md' },
  'two-h1': { content: twoH1, name: 'two-h1.markmap.md' },
  'list-only': { content: listOnly, name: 'list-only.markmap.md' },
  'frontmatter-only': { content: frontmatterOnly, name: 'frontmatter-only.markmap.md' },
  nested: { content: nested, name: 'nested.markmap.md' },
  palette: { content: palette, name: 'palette.markmap.md' },
  'palette-color': { content: paletteColor, name: 'palette-color.markmap.md' },
  'benchmark-small': {
    content: benchmarkMarkdown(3, 3, 4),
    name: 'benchmark-small.markmap.md',
  },
  'benchmark-1000': {
    content: benchmarkMarkdown(9, 10, 10),
    name: 'benchmark-1000.markmap.md',
  },
};
const selected = maps[params.get('map') ?? ''] ?? {
  content: sample,
  name: 'sample.markmap.md',
};
const content = selected.content;
const name = selected.name;

let snapshotListener: Parameters<MarkmapHost['onFileSnapshot']>[0] | null = null;
let savedListener: Parameters<MarkmapHost['onFileSaved']>[0] | null = null;
let acknowledgedVersion: string | null = null;
const fileChanges: FileEditorChange[] = [];
const requestSnapshot = async (): Promise<DevSnapshot | null> => {
  if (snapshotListener === null) return null;
  const snapshot = await snapshotListener('save');
  return 'content' in snapshot ? { content: snapshot.content, version: snapshot.version } : null;
};
window.devFileChangeSummary = () => ({
  count: fileChanges.length,
  dirty: fileChanges.at(-1)?.dirty ?? false,
});
window.devAutosave = async () => {
  if (!(fileChanges.at(-1)?.dirty ?? false)) return null;
  const snapshot = await requestSnapshot();
  if (snapshot === null) return null;
  acknowledgedVersion = snapshot.version;
  savedListener?.(snapshot.version);
  return snapshot;
};
window.devAcknowledgeOlder = () => {
  if (acknowledgedVersion !== null) savedListener?.(acknowledgedVersion);
};
const trackSnapshot = async (): Promise<DevSnapshot | null> => {
  const snapshot = await requestSnapshot();
  window.__devSnapshot = snapshot?.content ?? '';
  return snapshot;
};
window.devFileSnapshot = async () => (await trackSnapshot())?.content ?? null;
window.addEventListener('dev-file-snapshot', () => {
  void trackSnapshot();
});

const host: MarkmapHost = {
  onReady: (listener) => {
    queueMicrotask(() => {
      listener(devContext(mode));
    });
    return () => undefined;
  },
  onFileOpen: (listener) => {
    queueMicrotask(() => {
      listener({
        path: `dev/${name}`,
        name,
        readOnly: params.get('readonly') === '1',
        encoding: 'text',
        content,
      });
    });
    return () => undefined;
  },
  onFileSnapshot: (listener) => {
    snapshotListener = listener;
    return () => {
      snapshotListener = null;
    };
  },
  onFileSaved: (listener) => {
    savedListener = listener;
    return () => {
      savedListener = null;
    };
  },
  reportFileChange: (change) => {
    fileChanges.push(change);
  },
  reportFileUnsupported: () => {
    console.warn('dev sample cannot be rendered');
  },
  openUrl: (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    return Promise.resolve();
  },
  toast: (request) => {
    console.warn(`[toast:${request.kind}] ${request.message}`);
    return Promise.resolve();
  },
};

mountApp(host, root, { createMarkmap: createMarkmapView });
