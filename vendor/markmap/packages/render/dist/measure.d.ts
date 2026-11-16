import type { FontStyle, Measurer } from '@markmap/core';
export declare function fontToCss(font: FontStyle): string;
/**
 * Approximates widths from Helvetica metrics, without a font or canvas. Good enough
 * for Node rendering and tests; use {@link createCanvasMeasurer} in the browser.
 */
export declare const approximateMeasurer: Measurer;
type Context2D = Pick<CanvasRenderingContext2D, 'font' | 'measureText'>;
/** Measures with a canvas 2D context, caching results per font and text. */
export declare function createCanvasMeasurer(ctx?: Context2D): Measurer;
export {};
