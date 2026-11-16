import { type Layout, type LayoutOptions, type LayoutResult, type MarkmapNode } from '@markmap/core';
/**
 * Top-down tidy tree: the root at the top, children in a row below their parent.
 * `levelGap` is the gap between levels; siblings are `siblingGap × 3`
 * apart, doubled between cousins.
 */
export declare function layoutOrgChart(root: MarkmapNode, options: LayoutOptions): LayoutResult;
/** Org chart: root at the top, growing downwards. */
export declare const orgChartLayout: Layout;
