import type { Markmap } from '@markmap/view';

type FocusableView = Pick<Markmap, 'element' | 'focusNode'>;

const isSized = (element: Element): boolean => {
  const { width, height } = element.getBoundingClientRect();
  return width > 0 && height > 0;
};

export const focusAtFullScale = (view: FocusableView, id: string): boolean =>
  view.focusNode(id, { scale: 1, animate: false });

export const placeAtFullScale = (view: FocusableView, id: string): (() => void) => {
  if (isSized(view.element)) {
    focusAtFullScale(view, id);
    return () => undefined;
  }
  if (typeof ResizeObserver === 'undefined') return () => undefined;
  const observer = new ResizeObserver(() => {
    if (!isSized(view.element)) return;
    observer.disconnect();
    focusAtFullScale(view, id);
  });
  observer.observe(view.element);
  return () => {
    observer.disconnect();
  };
};
