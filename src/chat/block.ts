import type { GuestBlockCall, HostClient } from '@openchamber/sdk';
import { applyHostReady } from '@openchamber/sdk/ui';

import type { MarkmapColorScheme } from '../markmap/options';
import type { MarkmapPreview, MarkmapPreviewFactory } from '../markmap/preview';
import { ensureChatStyles } from './styles';

export type ChatBlockHost = Pick<HostClient, 'onReady' | 'onBlock'>;

type ChatBlockOptions = {
  createPreview: MarkmapPreviewFactory;
};

type ChatBlock = {
  dispose: () => void;
};

type State = {
  call: GuestBlockCall | null;
  colorScheme: MarkmapColorScheme | null;
  preview: MarkmapPreview | null;
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export const mountChatBlock = (
  host: ChatBlockHost,
  root: HTMLElement,
  options: ChatBlockOptions,
): ChatBlock => {
  ensureChatStyles(document);

  const container = document.createElement('div');
  container.className = 'mm-chat-map';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'mm-chat-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Markmap mind map');

  const notice = document.createElement('p');
  notice.className = 'mm-chat-notice';
  notice.setAttribute('role', 'status');
  notice.hidden = true;

  container.append(svg, notice);
  root.replaceChildren(container);

  const state: State = { call: null, colorScheme: null, preview: null };

  const showNotice = (message: string | null): void => {
    if (message === null) {
      notice.textContent = '';
      notice.hidden = true;
      return;
    }
    notice.textContent = message;
    notice.hidden = false;
  };

  const destroyPreview = (): void => {
    state.preview?.destroy();
    state.preview = null;
  };

  const render = (): void => {
    const { call, colorScheme } = state;
    if (call === null || colorScheme === null) return;
    destroyPreview();
    showNotice(null);
    const markdown = call.args['markdown'] ?? '';
    const result = options.createPreview({ svg, markdown, colorScheme, onError: showNotice });
    if (!result.ok) {
      showNotice(result.message);
      return;
    }
    state.preview = result.preview;
  };

  const unsubscribe = [
    host.onReady((context) => {
      applyHostReady(context, document.documentElement);
      const next = context.theme.mode;
      if (state.preview !== null) {
        if (state.colorScheme === next) return;
        state.colorScheme = next;
        state.preview.setColorScheme(next);
        return;
      }
      state.colorScheme = next;
      render();
    }),
    host.onBlock((call) => {
      state.call = call;
      render();
    }),
  ];

  return {
    dispose: () => {
      for (const off of unsubscribe) off();
      destroyPreview();
      root.replaceChildren();
    },
  };
};
