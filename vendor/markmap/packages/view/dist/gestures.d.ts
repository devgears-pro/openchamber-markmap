import type { Markmap } from './markmap';
/**
 * Connects user input to a map, using only its public API. Returns a function that
 * disconnects it again. The map itself listens to no input.
 */
export type Gestures = (mm: Markmap) => () => void;
/** Several sets of gestures as one. */
export declare function combineGestures(...list: Gestures[]): Gestures;
/** Zoom with the wheel or pinch and pan by dragging, as the `zoom` and `pan` options allow. */
export declare const panZoomGestures: Gestures;
/**
 * Click a fold anchor to toggle it, or with Ctrl or Cmd to toggle everything below it too.
 * Click a note dot to show its notes. Links open themselves on backends that draw them.
 */
export declare const pointerGestures: Gestures;
/** What a map uses unless the `gestures` option says otherwise. */
export declare const defaultGestures: Gestures;
