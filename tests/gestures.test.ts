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

const { mapGestures, panDelta, wheelZoomDelta } = await import('../src/markmap/gestures');

const createMap = (pan = true, scale = 1) => {
  const element = document.createElement('div');
  const next = { k: scale, x: -10, y: -20 };
  mocks.translate.mockReturnValue(next);
  const mm = {
    element,
    options: { pan },
    transform: { k: scale, translate: mocks.translate },
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

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const lastTranslate = (): [number, number] | undefined => {
  const call = mocks.translate.mock.calls.at(-1);
  return call === undefined ? undefined : [call[0] as number, call[1] as number];
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stops.length = 0;
});

describe('Map wheel gestures', () => {
  test('[R-14] pans on a trackpad wheel without a modifier', async () => {
    const { element, mm, next } = createMap();
    const stop = mapGestures(mm);
    const event = wheel({ deltaX: 5, deltaY: 10 });

    element.dispatchEvent(event);
    await nextFrame();

    expect(event.defaultPrevented).toBe(true);
    expect(lastTranslate()).toEqual([-5, -10]);
    expect(mocks.transform).toHaveBeenCalledWith(expect.anything(), next);
    stop();
  });

  test('[R-14] keeps the pan speed independent of zoom', async () => {
    const { element, mm } = createMap(true, 2);
    const stop = mapGestures(mm);

    element.dispatchEvent(wheel({ deltaX: 10, deltaY: 20 }));
    await nextFrame();

    expect(lastTranslate()).toEqual([-5, -10]);
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

  test('[R-14] scales line and page deltas', async () => {
    const { element, mm } = createMap();
    const stop = mapGestures(mm);

    element.dispatchEvent(wheel({ deltaY: 1, deltaMode: 1 }));
    await nextFrame();
    expect(lastTranslate()?.[1]).toBe(-40);

    element.dispatchEvent(wheel({ deltaY: 1, deltaMode: 2 }));
    await nextFrame();
    expect(lastTranslate()?.[1]).toBe(-800);
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

  test('[R-14] coalesces a wheel burst into one frame', async () => {
    const { element, mm } = createMap();
    const stop = mapGestures(mm);

    element.dispatchEvent(wheel({ deltaX: 1, deltaY: 2 }));
    element.dispatchEvent(wheel({ deltaX: 3, deltaY: 4 }));
    await nextFrame();

    expect(mocks.translate).toHaveBeenCalledTimes(1);
    expect(lastTranslate()).toEqual([-4, -6]);
    stop();
  });

  test('[R-14] skips an empty frame and cancels on dispose', async () => {
    const { element, mm } = createMap();
    const stop = mapGestures(mm);

    element.dispatchEvent(wheel({ deltaX: 0, deltaY: 0 }));
    await nextFrame();
    expect(mocks.translate).not.toHaveBeenCalled();

    element.dispatchEvent(wheel({ deltaY: 10 }));
    stop();
    await nextFrame();
    expect(mocks.translate).not.toHaveBeenCalled();
    expect(mocks.stops).toEqual(['pan', 'pointer']);
  });
});

describe('wheel normalization', () => {
  test('[R-14] normalizes pan units and Shift horizontal scrolling', () => {
    const shift = wheel({ deltaY: 7 });
    Object.defineProperty(shift, 'shiftKey', { value: true });

    expect(panDelta(wheel({ deltaX: 2, deltaY: 3 }))).toEqual({ x: 2, y: 3 });
    expect(panDelta(shift)).toEqual({ x: 7, y: 0 });
    expect(panDelta(wheel({ deltaY: 1, deltaMode: 1 }))).toEqual({ x: 0, y: 40 });
    expect(panDelta(wheel({ deltaY: 1, deltaMode: 2 }))).toEqual({ x: 0, y: 800 });
  });

  test('[R-14] clamps and scales zoom deltas', () => {
    expect(wheelZoomDelta(wheel({ deltaY: -1 }))).toBeCloseTo(0.01);
    expect(wheelZoomDelta(wheel({ deltaY: 1, deltaMode: 1 }))).toBeCloseTo(-0.2);
    expect(wheelZoomDelta(wheel({ deltaY: 1, deltaMode: 2 }))).toBeCloseTo(-0.2);
    expect(wheelZoomDelta(wheel({ deltaY: 1000 }))).toBeCloseTo(-0.2);
  });
});
