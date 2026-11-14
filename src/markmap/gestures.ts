import { select } from 'd3-selection';
import { combineGestures, panZoomGestures, pointerGestures, type Gestures } from '@markmap/view';

const LINE_HEIGHT = 40;
const PAGE_HEIGHT = 800;
const ZOOM_SENSITIVITY = 0.01;
const ZOOM_DELTA_LIMIT = 20;

const deltaUnit = (mode: number): number => {
  if (mode === 1) return LINE_HEIGHT;
  if (mode === 2) return PAGE_HEIGHT;
  return 1;
};

export const panDelta = (event: WheelEvent): { x: number; y: number } => {
  const swap = event.deltaX === 0 && event.shiftKey;
  const x = swap ? event.deltaY : event.deltaX;
  const y = swap ? 0 : event.deltaY;
  const unit = deltaUnit(event.deltaMode);
  return { x: x * unit, y: y * unit };
};

export const wheelZoomDelta = (event: WheelEvent): number => {
  const delta = -event.deltaY * deltaUnit(event.deltaMode);
  const clamped = Math.max(-ZOOM_DELTA_LIMIT, Math.min(ZOOM_DELTA_LIMIT, delta));
  return clamped * ZOOM_SENSITIVITY;
};

export const mapGestures: Gestures = (mm) => {
  const stop = combineGestures(panZoomGestures, pointerGestures)(mm);
  const element = mm.element;
  const pending = { x: 0, y: 0 };
  let frame: number | null = null;

  const flush = (): void => {
    frame = null;
    const dx = pending.x;
    const dy = pending.y;
    pending.x = 0;
    pending.y = 0;
    if (dx === 0 && dy === 0) return;
    const scale = mm.transform.k;
    const next = mm.transform.translate(-dx / scale, -dy / scale);
    mm.zoomBehavior.transform(select(element), next);
  };

  const handleWheel = (event: Event): void => {
    if (!(event instanceof WheelEvent)) return;
    if (event.metaKey || event.ctrlKey) return;
    if (mm.options.pan === false) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const delta = panDelta(event);
    pending.x += delta.x;
    pending.y += delta.y;
    frame ??= requestAnimationFrame(flush);
  };

  element.addEventListener('wheel', handleWheel, { capture: true, passive: false });

  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    pending.x = 0;
    pending.y = 0;
    element.removeEventListener('wheel', handleWheel, true);
    stop();
  };
};
