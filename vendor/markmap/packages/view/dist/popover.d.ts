import type { Rect } from '@markmap/core';
/** A floating panel next to a node, outside the SVG so it does not scale with zoom. */
export declare class Popover {
    readonly el: HTMLDivElement;
    constructor(doc: Document, html: string, tokens: Record<string, string>);
    /** Place below `anchor` (a rect in viewport coordinates), or above when there is no room. */
    position(anchor: Rect): void;
    contains(node: Node | null): boolean;
    destroy(): void;
}
