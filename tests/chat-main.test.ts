import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connectHost: vi.fn(),
  mountChatBlock: vi.fn(),
  createMarkmapPreview: vi.fn(),
}));

vi.mock('@openchamber/sdk', () => ({ connectHost: mocks.connectHost }));
vi.mock('../src/chat/block', () => ({ mountChatBlock: mocks.mountChatBlock }));
vi.mock('../src/markmap/preview', () => ({ createMarkmapPreview: mocks.createMarkmapPreview }));

const host = { connected: true };

describe('chat bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.replaceChildren();
    mocks.connectHost.mockReturnValue(host);
  });

  test('[R-24] mounts the block on the host root', async () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);

    await import('../src/chat/main');

    expect(mocks.connectHost).toHaveBeenCalledOnce();
    expect(mocks.mountChatBlock).toHaveBeenCalledOnce();
    expect(mocks.mountChatBlock).toHaveBeenCalledWith(host, root, {
      createPreview: mocks.createMarkmapPreview,
    });
  });

  test('[R-24] fails when the host renders no root', async () => {
    await expect(import('../src/chat/main')).rejects.toThrow('Markmap: missing #root');
    expect(mocks.mountChatBlock).not.toHaveBeenCalled();
  });
});
