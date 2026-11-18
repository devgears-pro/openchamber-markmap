import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connectHost: vi.fn(),
  mountApp: vi.fn(),
  createMarkmapView: vi.fn(),
}));

vi.mock('@openchamber/sdk', () => ({ connectHost: mocks.connectHost }));
vi.mock('../src/app', () => ({ mountApp: mocks.mountApp }));
vi.mock('../src/markmap/view', () => ({ createMarkmapView: mocks.createMarkmapView }));

const host = { connected: true };

describe('editor bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.replaceChildren();
    mocks.connectHost.mockReturnValue(host);
  });

  test('[R-07] mounts the app on the host root', async () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);

    await import('../src/main');

    expect(mocks.connectHost).toHaveBeenCalledOnce();
    expect(mocks.mountApp).toHaveBeenCalledOnce();
    expect(mocks.mountApp).toHaveBeenCalledWith(host, root, {
      createMarkmap: mocks.createMarkmapView,
    });
  });

  test('[R-07] fails when the host renders no root', async () => {
    await expect(import('../src/main')).rejects.toThrow('Markmap: missing #root');
    expect(mocks.mountApp).not.toHaveBeenCalled();
  });
});
