import type { MarkmapLayout } from './layouts';

type Bounds = { x: number; y: number; width: number; height: number };
type Rect = Bounds;
type Transform = { apply: (point: [number, number]) => [number, number] };

type FullScaleView = {
  element: Element;
  transform: Transform;
  result?: { bounds: Bounds } | undefined;
  focusNode: (id: string, options?: { scale?: number; animate?: boolean }) => boolean;
  screenRect: (id: string) => Rect | undefined;
  panBy: (dx: number, dy: number) => void;
};

export type FullScaleOptions = {
  layout: MarkmapLayout;
  root: boolean;
};

type FullScalePlacement = {
  placed: boolean;
  cancel: () => void;
};

const PADDING = 24;
const TOP_PADDING = 48;

const isSized = (element: Element): boolean => {
  const { width, height } = element.getBoundingClientRect();
  return width > 0 && height > 0;
};

const place = (view: FullScaleView, id: string, options: FullScaleOptions): boolean => {
  if (!view.focusNode(id, { scale: 1, animate: false })) return false;
  if (!options.root) return true;
  const bounds = view.result?.bounds;
  if (bounds === undefined) return true;
  const box = view.element.getBoundingClientRect();
  const fits = bounds.width <= box.width - PADDING * 2 && bounds.height <= box.height - PADDING * 2;
  if (fits) {
    const [x, y] = view.transform.apply([
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    ]);
    view.panBy(box.width / 2 - x, box.height / 2 - y);
    return true;
  }
  if (options.layout === 'two-sided') return true;
  const node = view.screenRect(id);
  if (node === undefined) return true;
  if (options.layout === 'tree') {
    view.panBy(
      box.x + PADDING + node.width / 2 - (node.x + node.width / 2),
      box.y + box.height / 2 - (node.y + node.height / 2),
    );
    return true;
  }
  view.panBy(
    box.x + box.width / 2 - (node.x + node.width / 2),
    box.y + TOP_PADDING + node.height / 2 - (node.y + node.height / 2),
  );
  return true;
};

export const placeAtFullScale = (
  view: FullScaleView,
  id: string,
  options: FullScaleOptions,
): FullScalePlacement => {
  if (isSized(view.element)) {
    return { placed: place(view, id, options), cancel: () => undefined };
  }
  if (typeof ResizeObserver === 'undefined') {
    return { placed: false, cancel: () => undefined };
  }
  const observer = new ResizeObserver(() => {
    if (!isSized(view.element)) return;
    observer.disconnect();
    place(view, id, options);
  });
  observer.observe(view.element);
  return {
    placed: true,
    cancel: () => {
      observer.disconnect();
    },
  };
};
