import { type Layout, type MarkmapJSONOptions, type Theme } from '@markmap/core';
import type { RenderOptions } from './render';
/** Layouts Markdown can pick by name with the `layout` option. */
export declare const builtinLayouts: Readonly<Record<string, Layout>>;
/** Themes Markdown can pick by name with the `theme` option. */
export declare const builtinThemes: Readonly<Record<string, Theme>>;
export interface ResolveOptions {
    /** Layouts the `layout` option may name. Defaults to {@link builtinLayouts}. */
    layouts?: Readonly<Record<string, Layout>>;
    /** Themes the `theme` option may name. Defaults to {@link builtinThemes}. */
    themes?: Readonly<Record<string, Theme>>;
}
export interface ResolvedOptions<T> {
    options: T;
    /** The validated theme-independent options, for callers that use more of them. */
    json: MarkmapJSONOptions;
    /** Problems with the input, one per ignored value or unknown key. */
    warnings: string[];
}
/**
 * Apply the theme's own options (for example `color`) and return the keys it did not
 * claim. Themes without options leave everything in `rest`.
 */
export declare function configureTheme(theme: Theme, input: Record<string, unknown>): {
    theme: Theme;
    rest: Record<string, unknown>;
    warnings: string[];
};
/**
 * Validate untrusted Markdown options (usually `frontmatter.markmap`) and apply them on
 * top of `base`: shared keys first, then the theme's own keys. Anything left is reported.
 */
export declare function resolveRenderOptions<T extends Partial<RenderOptions>>(base: T, input: unknown, { layouts, themes }?: ResolveOptions): ResolvedOptions<T & Partial<RenderOptions>>;
