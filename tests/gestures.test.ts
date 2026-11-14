import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { Markmap } from '@markmap/view';

const mocks = vi.hoisted(() => ({
  translate: vi.fn(),
  transform: vi.fn(),
  stops: [] as string[],
}));

vi.mock('@markmap/view', () => ({
  combineGestures:
    (...gestures: ((mm: unknown) => () => void)[]) =>
    (mm: unknown) => {
      const stops = gestures.map((gesture) => gesture(mm));
      return () => {
        for (const stop of stops) stop();
      };
    },
  panZoomGestures: () => {
    mocks.stops.push('pan');
    return () => undefined;
  },
  pointerGestures: () => {
    mocks.stops.push('pointer');
    return () => undefined;
  },
}));

const { mapGestures } = await import('../src/markmap/gestures');

const createMap = (pan = true) => {
  const element = document.createElement('div');
  const next = { k: 1, x: -10, y: -20 };
  mocks.translate.mockReturnValue(next);
  const mm = {
    element,
    options: { pan },
    transform: { translate: mocks.translate },
    zoomBehavior: { transform: mocks.transform },
  } as unknown as Markmap;
  return { element, mm, next };
};

const wheel = (init: WheelEventInit = {}): WheelEvent =>
  new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ...init,
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stops.length = 0;
});

describe('Map wheel gestures', () => {
  test('[R-14] pans on a trackpad wheel without a modifier', () => {
    const { element, mm, next } = createMap();
    const stop = mapGestures(mm);
    const event = wheel({ deltaX: 5, deltaY: 10 });

    element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(mocks.translate).toHaveBeenCalledWith(-5, -10);
    expect(mocks.transform).toHaveBeenCalledWith(expect.anything(), next);
    stop();
  });

  test('[R-14] leaves modified wheels to the zoom gestures', () => {
    const { element, mm } = createMap();
    const stop = mapGestures(mm);
    const meta = wheel({ deltaY: 10 });
    Object.defineProperty(meta, 'metaKey', { value: true });
    const ctrl = wheel({ deltaY: 10 });
    Object.defineProperty(ctrl, 'ctrlKey', { value: true });

    element.dispatchEvent(meta);
    element.dispatchEvent(ctrl);

    expect(mocks.translate).not.toHaveBeenCalled();
    expect(meta.defaultPrevented).toBe(false);
    expect(ctrl.defaultPrevented).toBe(false);
    stop();
  });

  test('[R-14] scales line and page deltas', () => {
    const { element, mm } = createMap();
    const stop = mapGestures(mm);

    element.dispatchEvent(wheel({ deltaY: 1, deltaMode: 1 }));
    expect(mocks.translate).toHaveBeenLastCalledWith(-0, -16);

    element.dispatchEvent(wheel({ deltaY: 1, deltaMode: 2 }));
    expect(mocks.translate).toHaveBeenLastCalledWith(-0, -100);
    stop();
  });

  test('[R-14] ignores a disabled pan option and non-wheel events', () => {
    const { element, mm } = createMap(false);
    const stop = mapGestures(mm);

    element.dispatchEvent(wheel({ deltaY: 10 }));
    element.dispatchEvent(new Event('wheel', { bubbles: true }));

    expect(mocks.translate).not.toHaveBeenCalled();
    stop();
  });

  test('[R-14] removes the wheel listener and gesture handlers', () => {
    const { element, mm } = createMap();
    const stop = mapGestures(mm);

    stop();
    element.dispatchEvent(wheel({ deltaY: 10 }));

    expect(mocks.translate).not.toHaveBeenCalled();
    expect(mocks.stops).toEqual(['pan', 'pointer']);
  });
});
