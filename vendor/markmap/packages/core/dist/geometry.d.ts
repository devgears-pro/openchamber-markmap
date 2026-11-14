export interface Point {
    x: number;
    y: number;
}
export interface Size {
    width: number;
    height: number;
}
export interface Rect extends Point, Size {
}
/** Affine transform `[a, b, c, d, e, f]`, as in SVG `matrix()` and canvas `setTransform()`. */
export type Matrix = [number, number, number, number, number, number];
export type Side = 'left' | 'right' | 'top' | 'bottom';
/** Where an edge leaves or enters a node, and which side it faces. */
export interface Anchor extends Point {
    side: Side;
}
export declare function translate(x: number, y: number): Matrix;
/** Scale by `k` around the point (`cx`, `cy`). */
export declare function scaleAround(k: number, cx: number, cy: number): Matrix;
/** `a` applied after `b`, as in SVG `transform="matrix(a) matrix(b)"`. */
export declare function multiply(a: Matrix, b: Matrix): Matrix;
export declare function unionRects(rects: Iterable<Rect>): Rect;
export declare function expandRect(rect: Rect, by: number): Rect;
export declare function oppositeSide(side: Side): Side;
