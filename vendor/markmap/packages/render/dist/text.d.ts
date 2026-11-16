import type { ContentPlugin, Inline, InlineContext, Primitive, Size, TextRun, TextAlign, TextStyle } from '@markmap/core';
export interface TextLayout extends Size {
    /** Backgrounds, text, strike lines, atoms and link areas, in text coordinates. */
    primitives: Primitive[];
    runs: TextRun[];
    lines: number;
}
export interface TextLayoutOptions {
    style: TextStyle;
    /** Wrap lines longer than this, in px. `0` or less disables wrapping. */
    wrapWidth?: number;
    plugins: readonly ContentPlugin[];
    ctx: InlineContext;
    /** Alignment of lines within the widest one. Defaults to `start`. */
    align?: TextAlign;
}
/** Apply plugin transforms to a node's content, in plugin order. */
export declare function transformContent(plugins: readonly ContentPlugin[], ctx: InlineContext): Inline[];
/** Lay out inline content into runs, decorations and atoms, wrapping at `wrapWidth`. */
export declare function layoutText(content: readonly Inline[], options: TextLayoutOptions): TextLayout;
