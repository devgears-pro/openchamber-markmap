import { type Layout, type LayoutOptions, type LayoutResult, type MarkmapNode } from '@markmap/core';
/** Return the subtree that is visible when the `folded` nodes are collapsed. */
export declare function visibleNodes(root: MarkmapNode, folded?: ReadonlySet<string>): MarkmapNode[];
/** Tidy tree layout, root on the left, growing to the right. */
export declare function layoutTree(root: MarkmapNode, options: LayoutOptions): LayoutResult;
/** The classic markmap layout: a tidy tree growing to the right. */
export declare const treeLayout: Layout;
