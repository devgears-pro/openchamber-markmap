import { select } from 'd3-selection';
import { combineGestures, panZoomGestures, pointerGestures, type Gestures } from '@markmap/view';

const wheelFactor = (event: WheelEvent): number => {
  if (event.deltaMode === 1) return 16;
  if (event.deltaMode === 2) return 100;
  return 1;
};

export const mapGestures: Gestures = (mm) => {
  const stop = combineGestures(panZoomGestures, pointerGestures)(mm);
  const element = mm.element;

  const handleWheel = (event: Event): void => {
    if (!(event instanceof WheelEvent)) return;
    if (event.metaKey || event.ctrlKey) return;
    if (mm.options.pan === false) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const factor = wheelFactor(event);
    const next = mm.transform.translate(-event.deltaX * factor, -event.deltaY * factor);
    mm.zoomBehavior.transform(select(element), next);
  };

  element.addEventListener('wheel', handleWheel, { capture: true, passive: false });

  return () => {
    element.removeEventListener('wheel', handleWheel, true);
    stop();
  };
};
