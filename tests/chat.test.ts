import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest';

import type { GuestBlockCall, HostReadyContext, HostThemeMode } from '@openchamber/sdk';

import { devContext } from '../dev/theme';
import { mountChatBlock, type ChatBlockHost } from '../src/chat/block';
import type {
  MarkmapPreview,
  MarkmapPreviewFactory,
  MarkmapPreviewMount,
} from '../src/markmap/preview';

type Emit = {
  ready: (context: HostReadyContext) => void;
  block: (call: GuestBlockCall) => void;
};

const createHost = (): { host: ChatBlockHost; emit: Emit } => {
  let ready: ((context: HostReadyContext) => void) | null = null;
  let block: ((call: GuestBlockCall) => void) | null = null;
  const host: ChatBlockHost = {
    onReady: (listener) => {
      ready = listener;
      return () => {
        ready = null;
      };
    },
    onBlock: (listener) => {
      block = listener;
      return () => {
        block = null;
      };
    },
  };
  return {
    host,
    emit: {
      ready: (context) => ready?.(context),
      block: (call) => block?.(call),
    },
  };
};

const contextFor = (mode: HostThemeMode): HostReadyContext => ({
  ...devContext(mode),
  surface: 'block',
});

const callFor = (markdown?: string): GuestBlockCall => ({
  name: 'Mindmap',
  args: markdown === undefined ? {} : { markdown },
  answered: null,
});

const noticeOf = (container: HTMLElement): HTMLParagraphElement => {
  const notice = container.querySelector('.mm-chat-notice');
  if (!(notice instanceof HTMLParagraphElement)) throw new Error('Missing notice');
  return notice;
};

const setup = (): {
  container: HTMLDivElement;
  mounts: MarkmapPreviewMount[];
  previews: MarkmapPreview[];
  createPreview: Mock<MarkmapPreviewFactory>;
  emit: Emit;
  dispose: () => void;
} => {
  const container = document.createElement('div');
  const mounts: MarkmapPreviewMount[] = [];
  const previews: MarkmapPreview[] = [];
  const createPreview = vi.fn<MarkmapPreviewFactory>((mount) => {
    const preview: MarkmapPreview = { setColorScheme: vi.fn(), destroy: vi.fn() };
    mounts.push(mount);
    previews.push(preview);
    return { ok: true, preview };
  });
  const { host, emit } = createHost();
  const mounted = mountChatBlock(host, container, { createPreview });
  return { container, mounts, previews, createPreview, emit, dispose: mounted.dispose };
};

describe('chat block', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  test('[R-24] draws the call when the host announces it', () => {
    const { container, mounts, createPreview, emit } = setup();
    emit.ready(contextFor('dark'));
    emit.block(callFor('# Root\n- Child'));

    expect(createPreview).toHaveBeenCalledOnce();
    const mount = mounts[0];
    if (mount === undefined) throw new Error('Preview was not created');
    expect(mount.svg).toBe(container.querySelector('svg'));
    expect(mount.svg.getAttribute('role')).toBe('img');
    expect(mount.svg.getAttribute('aria-label')).toBe('Markmap mind map');
    expect(mount.markdown).toBe('# Root\n- Child');
    expect(mount.colorScheme).toBe('dark');
    expect(noticeOf(container).hidden).toBe(true);
  });

  test('[R-24] waits for the host theme before drawing', () => {
    const { createPreview, emit } = setup();
    emit.block(callFor('# Root'));
    expect(createPreview).not.toHaveBeenCalled();

    emit.ready(contextFor('light'));
    expect(createPreview).toHaveBeenCalledOnce();
  });

  test('[R-24] redraws the open map when the host theme changes', () => {
    const { previews, createPreview, emit } = setup();
    emit.ready(contextFor('dark'));
    emit.block(callFor('# Root'));
    emit.ready(contextFor('light'));

    expect(createPreview).toHaveBeenCalledOnce();
    const preview = previews[0];
    if (preview === undefined) throw new Error('Preview was not created');
    expect(preview.setColorScheme).toHaveBeenCalledOnce();
    expect(preview.setColorScheme).toHaveBeenCalledWith('light');

    emit.ready(contextFor('light'));
    expect(preview.setColorScheme).toHaveBeenCalledOnce();
  });

  test('[R-24] replaces the drawn map when another call arrives', () => {
    const { previews, createPreview, emit } = setup();
    emit.ready(contextFor('dark'));
    emit.block(callFor('# First'));
    emit.block(callFor('# Second'));

    expect(createPreview).toHaveBeenCalledTimes(2);
    const first = previews[0];
    if (first === undefined) throw new Error('Preview was not created');
    expect(first.destroy).toHaveBeenCalledOnce();
  });

  test('[R-24] draws an empty map without a source', () => {
    const { mounts, emit } = setup();
    emit.ready(contextFor('dark'));
    emit.block(callFor());

    expect(mounts[0]?.markdown).toBe('');
  });

  test('[R-24] shows a notice when the map fails', () => {
    const { container, createPreview, emit } = setup();
    createPreview.mockReturnValueOnce({ ok: false, message: 'Markmap failed' });
    emit.ready(contextFor('dark'));
    emit.block(callFor('# Root'));

    const notice = noticeOf(container);
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toBe('Markmap failed');
  });

  test('[R-24] shows a warning while the map stays', () => {
    const { container, previews, mounts, emit } = setup();
    emit.ready(contextFor('dark'));
    emit.block(callFor('# Root'));
    const mount = mounts[0];
    if (mount === undefined) throw new Error('Preview was not created');
    mount.onError('Unknown Markmap option');

    const notice = noticeOf(container);
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toBe('Unknown Markmap option');
    expect(previews[0]?.destroy).not.toHaveBeenCalled();

    emit.block(callFor('# Next'));
    expect(notice.hidden).toBe(true);
  });

  test('[R-24] disposes the preview, listeners, and DOM', () => {
    const { container, previews, createPreview, emit, dispose } = setup();
    emit.ready(contextFor('dark'));
    emit.block(callFor('# Root'));
    dispose();

    const preview = previews[0];
    if (preview === undefined) throw new Error('Preview was not created');
    expect(preview.destroy).toHaveBeenCalledOnce();
    expect(container.childElementCount).toBe(0);

    emit.ready(contextFor('light'));
    emit.block(callFor('# Again'));
    expect(createPreview).toHaveBeenCalledOnce();
  });

  test('[R-24] keeps one stylesheet across mounts', () => {
    const first = setup();
    first.dispose();
    const second = setup();

    expect(document.querySelectorAll('#markmap-chat-styles')).toHaveLength(1);
    expect(second.container.childElementCount).toBe(1);
  });
});
