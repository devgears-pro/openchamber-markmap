import { afterEach, describe, expect, test, vi, type Mock } from 'vitest';

import type { MarkmapLayout } from '../src/markmap/layouts';
import { placeAtFullScale, type FullScaleOptions } from '../src/markmap/zoom';

type Rect = { x: number; y: number; width: number; height: number };
type Bounds = Rect;

type Focusable = {
  element: Element;
  transform: { apply: (point: [number, number]) => [number, number] };
  result?: { bounds: Bounds } | undefined;
  focusNode: Mock<(id: string, options?: { scale?: number; animate?: boolean }) => boolean>;
  screenRect: Mock<(id: string) => Rect | undefined>;
  panBy: Mock<(dx: number, dy: number) => void>;
};

const viewOf = (overrides: Partial<Focusable> = {}): Focusable => {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600);
  return {
    element,
    transform: { apply: ([x, y]) => [x, y] },
    result: { bounds: { x: 0, y: 0, width: 400, height: 200 } },
    focusNode: vi.fn(() => true),
    screenRect: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 40 })),
    panBy: vi.fn(),
    ...overrides,
  };
};

const options = (layout: MarkmapLayout, root = true): FullScaleOptions => ({ layout, root });

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
    const view = viewOf();

    const placement = placeAtFullScale(view, 'root', options('two-sided'));

    expect(placement.placed).toBe(true);
    expect(view.focusNode).toHaveBeenCalledWith('root', { scale: 1, animate: false });
    expect(view.panBy).toHaveBeenCalledWith(200, 200);
    placement.cancel();
  });

  test('[R-33] keeps a large two-sided map on its root', () => {
    const view = viewOf({ result: { bounds: { x: 0, y: 0, width: 1000, height: 800 } } });

    const placement = placeAtFullScale(view, 'root', options('two-sided'));

    expect(placement.placed).toBe(true);
    expect(view.focusNode).toHaveBeenCalledWith('root', { scale: 1, animate: false });
    expect(view.panBy).not.toHaveBeenCalled();
  });

  test('[R-33] anchors a large tree on the left', () => {
    const view = viewOf({
      result: { bounds: { x: 0, y: 0, width: 1000, height: 800 } },
      screenRect: vi.fn(() => ({ x: 400, y: 200, width: 100, height: 40 })),
    });

    const placement = placeAtFullScale(view, 'root', options('tree'));

    expect(placement.placed).toBe(true);
    expect(view.panBy).toHaveBeenCalledWith(-376, 80);
  });

  test('[R-33] anchors a large org chart on top', () => {
    const view = viewOf({
      result: { bounds: { x: 0, y: 0, width: 1000, height: 800 } },
      screenRect: vi.fn(() => ({ x: 400, y: 200, width: 100, height: 40 })),
    });

    const placement = placeAtFullScale(view, 'root', options('org-chart'));

    expect(placement.placed).toBe(true);
    expect(view.panBy).toHaveBeenCalledWith(-50, -152);
  });

  test('[R-33] centers a selected child without fitting the drawing', () => {
    const view = viewOf();

    const placement = placeAtFullScale(view, 'child', options('two-sided', false));

    expect(placement.placed).toBe(true);
    expect(view.focusNode).toHaveBeenCalledWith('child', { scale: 1, animate: false });
    expect(view.panBy).not.toHaveBeenCalled();
  });

  test('[R-33] keeps the root when the drawing bounds are missing', () => {
    const view = viewOf({ result: undefined });

    const placement = placeAtFullScale(view, 'root', options('two-sided'));

    expect(placement.placed).toBe(true);
    expect(view.focusNode).toHaveBeenCalledWith('root', { scale: 1, animate: false });
    expect(view.panBy).not.toHaveBeenCalled();
  });

  test('[R-33] keeps the root when its screen rect is missing', () => {
    const view = viewOf({
      result: { bounds: { x: 0, y: 0, width: 1000, height: 800 } },
      screenRect: vi.fn(() => undefined),
    });

    const placement = placeAtFullScale(view, 'root', options('tree'));

    expect(placement.placed).toBe(true);
    expect(view.panBy).not.toHaveBeenCalled();
  });

  test('[R-33] reports a missing node', () => {
    const view = viewOf({ focusNode: vi.fn(() => false) });

    const placement = placeAtFullScale(view, 'gone', options('two-sided'));

    expect(placement.placed).toBe(false);
    expect(view.panBy).not.toHaveBeenCalled();
  });

  test('[R-02] waits for the first layout', () => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    const view = viewOf();
    vi.spyOn(view.element, 'getBoundingClientRect')
      .mockReturnValueOnce(new DOMRect(0, 0, 0, 0))
      .mockReturnValue(new DOMRect(0, 0, 800, 600));

    const placement = placeAtFullScale(view, 'root', options('two-sided'));
    const observer = TestResizeObserver.instances[0];
    if (observer === undefined) throw new Error('No observer');

    expect(placement.placed).toBe(true);
    expect(view.focusNode).not.toHaveBeenCalled();
    expect(observer.observe).toHaveBeenCalledWith(view.element);

    observer.callback([], observer);

    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(view.focusNode).toHaveBeenCalledWith('root', { scale: 1, animate: false });
    expect(view.panBy).toHaveBeenCalledWith(200, 200);
    placement.cancel();
  });

  test('[R-33] waits while the frame still has no size', () => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    const view = viewOf();
    vi.spyOn(view.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 0, 0));

    const placement = placeAtFullScale(view, 'root', options('two-sided'));
    const observer = TestResizeObserver.instances[0];
    if (observer === undefined) throw new Error('No observer');

    observer.callback([], observer);

    expect(observer.disconnect).not.toHaveBeenCalled();
    expect(view.focusNode).not.toHaveBeenCalled();
    placement.cancel();
  });

  test('[R-33] cancels a pending placement', () => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    const view = viewOf();
    vi.spyOn(view.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 0, 0));

    const placement = placeAtFullScale(view, 'root', options('two-sided'));
    const observer = TestResizeObserver.instances[0];
    if (observer === undefined) throw new Error('No observer');

    placement.cancel();

    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  test('[R-02] does not wait without a ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const view = viewOf();
    vi.spyOn(view.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 0, 0));

    const placement = placeAtFullScale(view, 'root', options('two-sided'));
    placement.cancel();

    expect(placement.placed).toBe(false);
    expect(view.focusNode).not.toHaveBeenCalled();
  });
});
