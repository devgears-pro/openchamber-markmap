import type { Paint, Theme } from '@markmap/core';
/** Finds a token's value by name, without the leading `--`. */
export type TokenLookup = Readonly<Record<string, string>> | ((name: string) => string | undefined);
/**
 * Resolve CSS custom properties in a paint, for drawing outside CSS (canvas, PNG export).
 * Every `var(--name)` and `var(--name, fallback)` is replaced by the token's value, which
 * may refer to other tokens, or else by its fallback. Anything else is kept as is.
 * Returns `undefined` when a variable has neither, or tokens refer to each other in a loop.
 */
export declare function resolvePaint(paint: Paint | undefined, tokens: TokenLookup): string | undefined;
/** A theme's tokens for one color scheme: dark tokens override light ones. */
export declare function themeTokens(theme: Pick<Theme, 'tokens' | 'darkTokens'>, scheme?: 'light' | 'dark'): Record<string, string>;
