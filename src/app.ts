import { type FileEditorSnapshot, type HostClient } from '@openchamber/sdk';
import { applyHostReady } from '@openchamber/sdk/ui';

import type { MarkmapColorScheme, MarkmapFactory, MarkmapView } from './markmap/view';
import { ensureStyles } from './ui/styles';

export type MarkmapHost = Pick<
  HostClient,
  'onReady' | 'onFileOpen' | 'onFileSnapshot' | 'reportFileUnsupported'
>;

export type MountOptions = {
  createMarkmap: MarkmapFactory;
};

type State = {
  hasFile: boolean;
  text: string;
  bytes: Uint8Array<ArrayBuffer> | null;
  failure: string | null;
  markmap: MarkmapView | null;
  renderedScheme: MarkmapColorScheme;
  colorScheme: MarkmapColorScheme;
};

const textVersion = (text: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  return node;
};

export const mountApp = (
  host: MarkmapHost,
  root: HTMLElement,
  options: MountOptions,
): { dispose: () => void } => {
  ensureStyles(document);
  root.replaceChildren();

  const createMarkmap = options.createMarkmap;
  const state: State = {
    hasFile: false,
    text: '',
    bytes: null,
    failure: null,
    markmap: null,
    renderedScheme: 'dark',
    colorScheme: 'dark',
  };

  const body = element('div', 'mm-body');
  const stage = element('div', 'mm-stage');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('mm-markmap-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Markmap mind map');
  const toolbar = element('div', 'mm-markmap-toolbar');
  const source = element('pre', 'mm-source');
  source.setAttribute('aria-label', 'Markdown source');
  source.hidden = true;
  stage.append(svg, toolbar);
  body.append(stage, source);
  root.append(body);

  const destroyMarkmap = (): void => {
    state.markmap?.destroy();
    state.markmap = null;
    state.renderedScheme = 'dark';
    toolbar.replaceChildren();
    svg.replaceChildren();
  };

  const showError = (message: string): void => {
    stage.querySelector('.mm-error')?.remove();
    const error = element('div', 'mm-error');
    const paragraph = element('p');
    paragraph.textContent = `${message} Use the source view to open this file.`;
    error.append(paragraph);
    stage.append(error);
  };

  const render = (): void => {
    stage.querySelector('.mm-error')?.remove();
    source.hidden = !state.hasFile || state.bytes !== null;
    source.textContent = state.text;

    if (state.failure !== null) {
      destroyMarkmap();
      showError(state.failure);
      return;
    }
    if (!state.hasFile) return;

    if (state.markmap === null) {
      const result = createMarkmap(svg, state.text, state.colorScheme);
      if (!result.ok) {
        state.failure = result.message;
        showError(result.message);
        host.reportFileUnsupported();
        return;
      }
      state.markmap = result.view;
      state.renderedScheme = state.colorScheme;
      toolbar.replaceChildren(result.view.toolbar);
      return;
    }

    if (state.colorScheme !== state.renderedScheme) {
      try {
        state.markmap.update(state.text, state.colorScheme);
      } catch (error) {
        state.failure = messageOf(error);
        destroyMarkmap();
        showError(state.failure);
        host.reportFileUnsupported();
        return;
      }
      state.renderedScheme = state.colorScheme;
    }
  };

  const snapshot = (): FileEditorSnapshot => {
    if (state.bytes !== null) {
      return { bytes: state.bytes, version: textVersion(String(state.bytes.length)) };
    }
    return { content: state.text, version: textVersion(state.text) };
  };

  const unsubscribe = [
    host.onReady((context) => {
      applyHostReady(context, document.documentElement);
      state.colorScheme = context.theme.mode;
      if (state.hasFile) render();
    }),
    host.onFileOpen((file) => {
      destroyMarkmap();
      const text = file.encoding === 'text';
      state.hasFile = true;
      state.text = text ? file.content : '';
      state.bytes = text ? null : file.bytes;
      state.failure = text ? null : 'This editor only opens text files.';
      render();
      if (!text) host.reportFileUnsupported();
    }),
    host.onFileSnapshot(() => snapshot()),
  ];

  render();

  return {
    dispose: () => {
      for (const off of unsubscribe) off();
      destroyMarkmap();
      root.replaceChildren();
    },
  };
};
