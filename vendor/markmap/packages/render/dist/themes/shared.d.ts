import type { Anchor, Point, Side, TextAlign, Theme } from '@markmap/core';
/** Tokens for inline content, shared by the built-in themes. */
export declare const CONTENT_TOKENS: {
    'mm-link': string;
    'mm-code-bg': string;
    'mm-code-text': string;
    'mm-mark-bg': string;
    'mm-checkbox': string;
    'mm-note-dot': string;
    'mm-group-border': string;
    'mm-group-fill': string;
    'mm-syntax-keyword': string;
    'mm-syntax-string': string;
    'mm-syntax-comment': string;
    'mm-syntax-number': string;
    'mm-syntax-title': string;
    'mm-syntax-attr': string;
    'mm-edge-relation': string;
    'mm-edge-relation-label': string;
};
export declare const DARK_CONTENT_TOKENS: {
    'mm-link': string;
    'mm-code-bg': string;
    'mm-code-text': string;
    'mm-mark-bg': string;
    'mm-checkbox': string;
    'mm-note-dot': string;
    'mm-group-border': string;
    'mm-group-fill': string;
    'mm-syntax-keyword': string;
    'mm-syntax-string': string;
    'mm-syntax-comment': string;
    'mm-syntax-number': string;
    'mm-syntax-title': string;
    'mm-syntax-attr': string;
    'mm-edge-relation': string;
    'mm-edge-relation-label': string;
};
export declare const SYSTEM_FONT: Theme['font'];
export declare const CODE_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
/** Wrapped lines hug the edge that faces the parent. */
export declare function alignFor(direction: Side): TextAlign;
/** An S-curve that leaves and arrives along the anchors' axis. */
export declare function sCurve(from: Anchor, to: Point): string;
/** The middle of one side of a box at (0, 0), pushed `gap` px outwards. */
export declare function sidePoint(width: number, height: number, side: Side, gap?: number): Point;
