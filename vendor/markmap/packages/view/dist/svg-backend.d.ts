import type { Primitive } from '@markmap/core';
import type { ViewBackend, ViewTransform } from './backend';
export interface SvgDomBackendOptions {
    /** See `ViewBackend.themeSelector`. */
    themeSelector?: string;
}
/**
 * Draws primitives into an SVG element. Top-level groups with a `key` keep their
 * element between draws, so only changed transforms and contents touch the DOM.
 */
export declare class SvgDomBackend implements ViewBackend {
    readonly element: SVGSVGElement;
    readonly nativeLinks = true;
    readonly themeSelector?: string;
    /** Group that holds the drawing and carries the zoom transform. */
    readonly root: SVGGElement;
    private style;
    private items;
    constructor(svg: SVGSVGElement, { themeSelector }?: SvgDomBackendOptions);
    setCSS(css: string): void;
    setTransform({ k, x, y }: ViewTransform): void;
    /** Element drawn for a keyed group, if any. */
    get(key: string): SVGGElement | undefined;
    draw(primitives: Primitive[]): void;
    destroy(): void;
}
