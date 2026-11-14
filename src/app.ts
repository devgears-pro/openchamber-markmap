import { createFileSaveTracker, type FileEditorSnapshot, type HostClient } from '@openchamber/sdk';
import { applyHostReady } from '@openchamber/sdk/ui';

import type {
  MarkmapColorScheme,
  MarkmapFactory,
  MarkmapSourceChange,
  MarkmapView,
} from './markmap/view';
import { ensureStyles } from './ui/styles';

export type MarkmapHost = Pick<
  HostClient,
  | 'onReady'
  | 'onFileOpen'
  | 'onFileSnapshot'
  | 'onFileSaved'
  | 'reportFileChange'
  | 'reportFileUnsupported'
>;

export type MountOptions = {
  createMarkmap: MarkmapFactory;
};

type State = {
  hasFile: boolean;
  readOnly: boolean;
  text: string;
  bytes: Uint8Array<ArrayBuffer> | null;
  failure: string | null;
  view: MarkmapView | null;
  renderedScheme: MarkmapColorScheme;
  colorScheme: MarkmapColorScheme;
  tracker: ReturnType<typeof createFileSaveTracker>;
};

const textVersion = (text: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
};

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

  const state: State = {
    hasFile: false,
    readOnly: false,
    text: '',
    bytes: null,
    failure: null,
    view: null,
    renderedScheme: 'dark',
    colorScheme: 'dark',
    tracker: createFileSaveTracker(null),
  };

  const stage = element('div', 'mm-stage');
  const surface = element('div', 'mm-editor-surface');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('mm-markmap-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Markmap mind map');
  const toolbar = element('div', 'mm-markmap-toolbar');
  const notice = element('div', 'mm-notice');
  notice.hidden = true;
  surface.append(svg);
  stage.append(surface, toolbar, notice);
  root.append(stage);

  const destroyView = (): void => {
    state.view?.destroy();
    state.view = null;
    state.renderedScheme = 'dark';
    toolbar.replaceChildren();
    svg.replaceChildren();
    notice.hidden = true;
  };

  const showError = (message: string): void => {
    stage.querySelector('.mm-error')?.remove();
    const error = element('div', 'mm-error');
    const paragraph = element('p');
    paragraph.textContent = `${message} Use the source view to open this file.`;
    error.append(paragraph);
    stage.append(error);
  };

  const report = (): void => {
    host.reportFileChange(state.tracker.observe(textVersion(state.text)));
  };

  const handleSource = (change: MarkmapSourceChange): void => {
    state.text = change.source;
    notice.hidden = true;
    report();
  };

  const handleError = (message: string): void => {
    notice.textContent = message;
    notice.hidden = false;
  };

  const render = (): void => {
    stage.querySelector('.mm-error')?.remove();

    if (state.failure !== null) {
      destroyView();
      showError(state.failure);
      return;
    }
    if (!state.hasFile) return;

    if (state.view === null) {
      const result = options.createMarkmap({
        surface,
        svg,
        markdown: state.text,
        colorScheme: state.colorScheme,
        editable: !state.readOnly,
        onSource: handleSource,
        onError: handleError,
      });
      if (!result.ok) {
        state.failure = result.message;
        showError(result.message);
        host.reportFileUnsupported();
        return;
      }
      state.view = result.view;
      state.renderedScheme = state.colorScheme;
      toolbar.replaceChildren(result.view.toolbar);
      return;
    }

    if (state.colorScheme !== state.renderedScheme) {
      state.view.setColorScheme(state.colorScheme);
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
      destroyView();
      const text = file.encoding === 'text';
      state.hasFile = true;
      state.readOnly = file.readOnly;
      state.text = text ? file.content : '';
      state.bytes = text ? null : file.bytes;
      state.failure = text ? null : 'This editor only opens text files.';
      state.tracker = createFileSaveTracker(textVersion(state.text));
      render();
      if (!text) host.reportFileUnsupported();
    }),
    host.onFileSnapshot(() => snapshot()),
    host.onFileSaved((version) => {
      host.reportFileChange({ dirty: state.tracker.markSaved(version), edited: false });
    }),
  ];

  render();

  return {
    dispose: () => {
      for (const off of unsubscribe) off();
      destroyView();
      root.replaceChildren();
    },
  };
};
