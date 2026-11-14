import { mountApp, type MarkmapHost } from '../src/app';
import { createMarkmapView } from '../src/markmap/view';
import sample from './sample.md?raw';

const root = document.querySelector<HTMLElement>('#root');
if (root === null) throw new Error('Missing #root');

const host: MarkmapHost = {
  onReady: () => () => undefined,
  onFileOpen: (listener) => {
    queueMicrotask(() =>
      listener({
        path: 'dev/sample.md',
        name: 'sample.markmap.md',
        readOnly: false,
        encoding: 'text',
        content: sample,
      }),
    );
    return () => undefined;
  },
  onFileSnapshot: () => () => undefined,
  reportFileUnsupported: () => {
    console.warn('dev sample cannot be rendered');
  },
};

mountApp(host, root, { createMarkmap: createMarkmapView });
