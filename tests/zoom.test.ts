import { afterEach, describe, expect, test, vi, type Mock } from 'vitest';

import { placeAtFullScale } from '../src/markmap/zoom';

type Focusable = {
  element: Element;
  focusNode: Mock<(id: string, options?: { scale?: number; animate?: boolean }) => boolean>;
};

const focusable = (): Focusable => {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600);
  return { element, focusNode: vi.fn(() => true) };
};

class TestResizeObserver implements ResizeObserver {
  static instances: TestResizeObserver[] = [];
  readonly observe = vi.fn<(target: Element, options?: ResizeObserverOptions) => void>();
  readonly unobserve = vi.fn<(target: Element) => void>();
  readonly disconnect = vi.fn<() => void>();
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    TestResizeObserver.instances.push(this);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  TestResizeObserver.instances.length = 0;
});

describe('full-scale placement', () => {
  test('[R-02] puts a sized map at 100% on its root', () => {
    const view = focusable();

    const cancel = placeAtFullScale(view, 'root');

    expect(view.focusNode).toHaveBeenCalledWith('root', { scale: 1, animate: false });
    cancel();
  });

  test('[R-32] waits for the first layout', () => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    const view = focusable();
    vi.spyOn(view.element, 'getBoundingClientRect')
      .mockReturnValueOnce(new DOMRect(0, 0, 0, 0))
      .mockReturnValue(new DOMRect(0, 0, 800, 600));

    const cancel = placeAtFullScale(view, 'root');
    const observer = TestResizeObserver.instances[0];
    if (observer === undefined) throw new Error('No observer');

    expect(view.focusNode).not.toHaveBeenCalled();
    expect(observer.observe).toHaveBeenCalledWith(view.element);

    observer.callback([], observer);

    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(view.focusNode).toHaveBeenCalledWith('root', { scale: 1, animate: false });
    cancel();
  });

  test('[R-32] waits while the frame still has no size', () => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    const view = focusable();
    vi.spyOn(view.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 0, 0));

    const cancel = placeAtFullScale(view, 'root');
    const observer = TestResizeObserver.instances[0];
    if (observer === undefined) throw new Error('No observer');

    observer.callback([], observer);

    expect(observer.disconnect).not.toHaveBeenCalled();
    expect(view.focusNode).not.toHaveBeenCalled();
    cancel();
  });

  test('[R-32] cancels a pending placement', () => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    const view = focusable();
    vi.spyOn(view.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 0, 0));

    const cancel = placeAtFullScale(view, 'root');
    const observer = TestResizeObserver.instances[0];
    if (observer === undefined) throw new Error('No observer');

    cancel();

    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  test('[R-32] does not wait without a ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const view = focusable();
    vi.spyOn(view.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 0, 0));

    const cancel = placeAtFullScale(view, 'root');
    cancel();

    expect(view.focusNode).not.toHaveBeenCalled();
  });
});
