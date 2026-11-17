import type { MarkmapNode, SourceRange } from '@markmap/core';
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
    /** Whether a non-empty frontmatter title exists. A promoted body heading still wins for the root label. */
    hasTitle: boolean;
    /** First offset after frontmatter, or the source length when the body is empty. */
    bodyStart: number;
    /** Top-level raw HTML blocks with their source ranges. */
    htmlBlocks: HtmlBlock[];
}
export interface HtmlBlock {
    range: SourceRange;
    value: string;
}
export declare function parse(markdown: string, options?: ParseOptions): ParseResult;
