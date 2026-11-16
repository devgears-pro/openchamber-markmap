import { type Layout, type LayoutOptions, type LayoutResult, type MarkmapNode } from '@markmap/core';
/**
 * How many of the root's first children go on the right; the rest go on the left. Splits
 * the list where the two sides' leaf counts are closest, keeping document order on both
 * sides and favoring the right on a tie.
 */
export declare function splitBranches(children: readonly MarkmapNode[]): number;
/**
 * A mind map: the root in the middle, its first branches growing to the right and the
 * rest to the left, balanced by size. Both sides keep document order top to bottom.
 */
export declare function layoutTwoSided(root: MarkmapNode, options: LayoutOptions): LayoutResult;
/** Root in the middle, branches on both sides. */
export declare const twoSidedLayout: Layout;
