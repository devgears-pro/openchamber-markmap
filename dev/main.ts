import { mountApp, type MarkmapHost } from '../src/app';
import { createMarkmapView } from '../src/markmap/view';
import { devContext } from './theme';
import sample from './sample.md?raw';
import showcase from './showcase.md?raw';

const root = document.querySelector<HTMLElement>('#root');
if (root === null) throw new Error('Missing #root');

const params = new URLSearchParams(window.location.search);
const mode = params.get('theme') === 'light' ? 'light' : 'dark';
const showcaseMode = params.get('map') === 'showcase';
const emptyMode = params.get('map') === 'empty';
const content = emptyMode ? '' : showcaseMode ? showcase : sample;
const name = emptyMode
  ? 'empty.markmap.md'
  : showcaseMode
    ? 'showcase.markmap.md'
    : 'sample.markmap.md';

const host: MarkmapHost = {
  onReady: (listener) => {
    queueMicrotask(() => listener(devContext(mode)));
    return () => undefined;
  },
  onFileOpen: (listener) => {
    queueMicrotask(() =>
      listener({
        path: `dev/${name}`,
        name,
        readOnly: params.get('readonly') === '1',
        encoding: 'text',
        content,
      }),
    );
    return () => undefined;
  },
  onFileSnapshot: () => () => undefined,
  onFileSaved: () => () => undefined,
  reportFileChange: () => undefined,
  reportFileUnsupported: () => {
    console.warn('dev sample cannot be rendered');
  },
};

mountApp(host, root, { createMarkmap: createMarkmapView });
