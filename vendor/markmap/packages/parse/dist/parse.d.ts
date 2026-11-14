import type { MarkmapNode } from '@markmap/core';
import { type PluggableList } from 'unified';
export interface ParseOptions {
    /** Extra unified plugins, applied after the built-in ones (gfm, frontmatter, highlight, references). */
    plugins?: PluggableList;
}
export interface ParseResult {
    root: MarkmapNode;
    /** Parsed YAML frontmatter. Markmap options live under `markmap`; validate them with the theme in use. */
    frontmatter: Record<string, unknown>;
    /** Whether GFM was applied. It is skipped when the browser cannot run it, see `parseMdast`. */
    gfm: boolean;
}
export declare function parse(markdown: string, options?: ParseOptions): ParseResult;
