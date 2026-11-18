import type { GuestBlockCall } from '@openchamber/sdk';

import { mountChatBlock, type ChatBlockHost } from '../src/chat/block';
import { createMarkmapPreview } from '../src/markmap/preview';
import chatMap from './chat-map.md?raw';
import { devContext } from './theme';

const root = document.querySelector<HTMLElement>('#root');
if (root === null) throw new Error('Missing #root');

const params = new URLSearchParams(window.location.search);
const mode = params.get('theme') === 'light' ? 'light' : 'dark';
const call: GuestBlockCall = { name: 'Mindmap', args: { markdown: chatMap }, answered: null };

const host: ChatBlockHost = {
  onReady: (listener) => {
    queueMicrotask(() => {
      listener({ ...devContext(mode), surface: 'block' });
    });
    return () => undefined;
  },
  onBlock: (listener) => {
    queueMicrotask(() => {
      listener(call);
    });
    return () => undefined;
  },
};

mountChatBlock(host, root, { createPreview: createMarkmapPreview });
