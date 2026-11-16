import { type Primitive, type Theme } from '@markmap/core';
import type { RenderResult } from './render';
export interface SVGStringOptions {
    /** Space around the drawing, in px. */
    padding?: number;
    /** Fill the background with `--mm-bg`. */
    background?: boolean;
    /** Which tokens to use. Defaults to `light`. */
    colorScheme?: ColorScheme;
}
/** `auto` follows the reader's `prefers-color-scheme`. */
export type ColorScheme = 'light' | 'dark' | 'auto';
export declare function escapeXml(value: string): string;
export interface PrimitivesToSVGOptions {
    /** Emit hit areas for view actions. Off for exports. */
    interactive?: boolean;
}
/**
 * Serialize primitives as SVG markup. Primitive lists are treated as immutable: the
 * markup of each list is cached, which makes redrawing animation frames cheap.
 */
export declare function primitivesToSVG(primitives: Primitive[], options?: PrimitivesToSVGOptions): string;
/** Theme tokens as CSS custom property declarations. */
export declare function tokensToCSS(theme: Theme | Record<string, string>): string;
/**
 * Rules that set a theme's tokens on `selector`. Dark tokens override light ones for
 * `dark`, and inside a `prefers-color-scheme: dark` query for `auto`.
 */
export declare function themeCSS(theme: Theme, colorScheme?: ColorScheme, selector?: string): string;
/** A standalone SVG document. Theme tokens are embedded so user CSS can still override them. */
export declare function toSVGString(result: RenderResult, options?: SVGStringOptions): string;
