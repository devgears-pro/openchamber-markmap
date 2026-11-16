import { type ContentPlugin, type FrameNode, type Layout, type LayoutResult, type Measurer, type MarkmapNode, type NodeContext, type Primitive, type Rect, type ResolvedLabelStyle, type Size, type Theme } from '@markmap/core';
import { type TextLayout } from './text';
export interface RenderOptions {
    measurer: Measurer;
    theme?: Theme;
    /** Where nodes go. Defaults to {@link treeLayout}. */
    layout?: Layout;
    /** Ids of collapsed nodes. */
    folded?: ReadonlySet<string>;
    /** Wrap labels wider than this, in px. `0` disables wrapping. */
    wrapWidth?: number;
    levelGap?: number;
    siblingGap?: number;
    /** Inline content renderers. Defaults to {@link defaultContentPlugins}. */
    plugins?: readonly ContentPlugin[];
}
export interface RenderResult {
    theme: Theme;
    layout: LayoutResult;
    /** Edges first, then nodes, so nodes draw on top. */
    primitives: Primitive[];
    /** Area covered by the drawing, including strokes and fold circles. */
    bounds: Rect;
    /** Theme context of every visible node, by id. */
    contexts: Map<string, NodeContext>;
    /** The final frame, as a starting point for animations. */
    state: DrawState;
    /**
     * Settles when content that was measured with a placeholder (such as an image of
     * unknown size) is ready. Render again then to get the final layout.
     */
    pending?: Promise<void>;
}
export interface MeasuredNode {
    text: TextLayout;
    box: Size;
    label: ResolvedLabelStyle;
}
/** Ids from the root to every node, both included. */
export declare function nodePaths(root: MarkmapNode): Map<string, readonly string[]>;
/**
 * Measure the label and box of every visible node. Content that is not ready yet (see
 * {@link InlineContext.defer}) is reported to `defer`.
 */
export declare function measureTree(root: MarkmapNode, options: RenderOptions, defer?: (task: Promise<unknown>) => void): Map<string, MeasuredNode>;
/** Measure, lay out and draw a tree as backend-neutral primitives. */
export declare function renderTree(root: MarkmapNode, options: RenderOptions): RenderResult;
/**
 * Render, wait for content that was measured with a placeholder, and render again, until
 * everything is final (at most `rounds` times). Useful outside a live view, e.g. for
 * exporting SVG with images.
 */
export declare function renderTreeAsync(root: MarkmapNode, options: RenderOptions, rounds?: number): Promise<RenderResult>;
/** A node as drawn in one frame: final, or somewhere along an animation. */
export interface DrawNode extends FrameNode {
    /** Parent in the same state; nodes without one get no edge. */
    parentId?: string;
    text: TextLayout;
    label?: ResolvedLabelStyle;
}
/** Everything needed to draw one frame. Parents come before their children. */
export interface DrawState {
    nodes: DrawNode[];
}
/**
 * Draw a state as primitives: edges first, then nodes, each in a keyed group so
 * backends can patch them. Edge anchors come from the theme, so animating node rects
 * moves edges along with them.
 */
export declare function drawState(state: DrawState, theme: Theme): Primitive[];
/**
 * Bounding box of rects, paths and images, including stroke widths. Curve control
 * points are included, so curves give a safe over-estimate. Text is not included:
 * it sits inside node boxes, which callers add from the layout.
 */
export declare function primitiveBounds(primitives: Primitive[]): Rect;
