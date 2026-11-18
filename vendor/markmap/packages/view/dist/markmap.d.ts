import { type GraphData, type MarkmapNode, type Measurer, type Rect } from '@markmap/core';
import { type RenderOptions, type ResolveOptions, type RenderResult, type ColorScheme, type RenderGroup } from '@markmap/render';
import { type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { ViewBackend } from './backend';
import { type Gestures } from './gestures';
import { type HitTarget } from './hit-index';
export interface ViewOptions extends Omit<RenderOptions, 'measurer' | 'folded'> {
    /** Defaults to a canvas measurer. */
    measurer?: Measurer;
    /** Zoom with the wheel or pinch. */
    zoom?: boolean;
    /** Pan by dragging. */
    pan?: boolean;
    /** Space kept around the drawing by `fit()`, in px. */
    fitPadding?: number;
    /** Largest scale `fit()` zooms in to. */
    fitMaxScale?: number;
    /** Smallest scale to zoom out to. `fit()` may go further to show everything. */
    minScale?: number;
    /** Largest scale to zoom in to. */
    maxScale?: number;
    /** Fold nodes at this depth and deeper when first seen. Leave out to expand everything. */
    foldLevel?: number;
    /**
     * Length of fold, update and fit animations, in ms. `0` disables them, and so does
     * the user's `prefers-reduced-motion` setting.
     */
    duration?: number;
    /** Color code blocks in note popovers. Defaults to `true`. */
    highlight?: boolean;
    /** Which theme tokens to use; `auto` follows the reader's system setting. Defaults to `light`. */
    colorScheme?: ColorScheme;
    /** How user input drives the map. Defaults to `defaultGestures`; `false` connects none. */
    gestures?: Gestures | false;
}
/** What each event passes to its listeners. */
export interface MarkmapEvents {
    /** After every render, with the final (not mid-animation) result. */
    render: RenderResult;
    /** Whenever the view moves, by the user or by the API. */
    zoom: ZoomTransform;
    /** When the set of folded nodes changes. */
    fold: ReadonlySet<string>;
}
/**
 * Validate untrusted Markdown options (usually `frontmatter.markmap`) and apply them on
 * top of `base`, including the theme's own options. Ignored values come back as warnings.
 */
export declare function resolveViewOptions(base: ViewOptions, input: unknown, resolve?: ResolveOptions): {
    options: ViewOptions;
    warnings: string[];
};
export declare class Markmap {
    readonly backend: ViewBackend;
    private scopeClass;
    private viewOptions;
    /** The d3 zoom behavior, for gestures to connect to the element. */
    readonly zoomBehavior: ZoomBehavior<Element, unknown>;
    private gestures?;
    private selection;
    private measurer;
    private root?;
    private folded;
    private known;
    private current?;
    private pendingFit?;
    private popover?;
    /** Bumped on every open/close, so a slow lazy import cannot open a stale popover. */
    private popoverRequest;
    /** What is on screen: the final state, or a frame of an animation towards it. */
    private frame?;
    /** Primitives drawn for `frame`. */
    private primitives;
    /** Hit targets of `frame`, built on the first lookup after it is drawn. */
    private hits?;
    private stateTween;
    private zoomTween;
    /** Whether the first fit has happened; it is never animated. */
    private placed;
    /** Scale of the last fit. */
    private fitScale?;
    /** Where the running zoom animation ends. */
    private zoomTarget?;
    /**
     * A node held at a fixed point in the element (its top-left corner) while the tree moves
     * around it, as when folding. Applied on every frame, so it works however the
     * frames move the node, and released when the animation ends or the user moves the view.
     */
    private pin?;
    /**
     * Show a map in an `<svg>` element, or through another backend (such as canvas from
     * `@markmap/canvas`).
     */
    constructor(target: SVGSVGElement | ViewBackend, options?: ViewOptions);
    /** Connect the `gestures` option, replacing the previous ones if it changed. */
    private applyGestures;
    /** Keep the last fit within the limits, or zooming from it would jump. */
    private updateScaleLimits;
    /** The smallest and largest scale the view can zoom to. */
    get scaleLimits(): [number, number];
    /**
     * Class that carries the map's theme tokens: add it to controls beside the map so they
     * can use `--mm-*` too.
     */
    get themeClass(): string;
    /** The tree on show, with folded nodes. */
    get tree(): MarkmapNode | undefined;
    /** The element the map is shown in. */
    get element(): Element;
    get options(): Readonly<ViewOptions>;
    /** Replace all options (defaults fill the gaps) and redraw. */
    setOptions(options: ViewOptions): void;
    private applyOptions;
    static create(target: SVGSVGElement | ViewBackend, root?: MarkmapNode, options?: ViewOptions): Markmap;
    get theme(): import("@markmap/core").Theme;
    /** Ids of folded nodes. */
    get foldedIds(): ReadonlySet<string>;
    /** The final (not mid-animation) result of the last render. */
    get result(): RenderResult | undefined;
    setGraph(graph: GraphData | undefined, identities: ReadonlyMap<string, string> | undefined): void;
    /**
     * Show a new tree, optionally replacing all options at the same time. Fold state is
     * kept for ids that still exist, so live editing does not reset what the user folded.
     * New nodes start folded if `data.fold` or an ancestor's `data.foldAll` is set, or
     * they are below `foldLevel`.
     */
    setTree(root: MarkmapNode, options?: ViewOptions): void;
    /** Re-measure, lay out and draw the current tree, animated unless `animate` is `false`. */
    render({ animate }?: {
        animate?: boolean;
    }): RenderResult | undefined;
    private drawFrame;
    /** Pan so the pinned node's frame position lands on its pinned point. */
    private applyPin;
    /** Animation length in ms, `0` when animations are off. */
    private get duration();
    /** Where a node is drawn right now, possibly mid-animation. */
    private frameNode;
    /** Fold or unfold a node, keeping it in place on screen. */
    setFolded(id: string, folded: boolean): void;
    /**
     * Replace the set of folded nodes, as when restoring a saved state: one redraw, keeping
     * the root still. Ids that no longer exist, and nodes with no children, are ignored.
     */
    setFoldedIds(ids: Iterable<string>, { animate }?: {
        animate?: boolean;
    }): void;
    /**
     * Unfold a node's ancestors and center on it, as for a link to a node. Keeps the current
     * zoom unless `scale` is given. Returns whether the node exists; a view with no size
     * yet unfolds but cannot center.
     */
    focusNode(id: string, options?: {
        scale?: number;
        animate?: boolean;
    }): boolean;
    /** Unfold a node and everything below it. Defaults to the whole tree. */
    expandAll(id?: string): void;
    /**
     * Fold a node and every node below it that has children, so unfolding later reveals
     * one level at a time. Defaults to the whole tree, leaving only the root.
     */
    foldAll(id?: string): void;
    /**
     * Show the tree down to `level`: nodes at that depth and deeper are folded, the rest
     * unfolded. The root is depth 0, so `1` shows only the root's children. Same meaning
     * as the `foldLevel` option; `expandAll()` shows everything.
     */
    foldToLevel(level: number): void;
    private subtree;
    /**
     * Change fold state and redraw once, animated, keeping `pinId` still on screen. If that
     * node is not drawn (inside a folded branch), the root stays still instead.
     */
    private updateFolded;
    private listeners;
    /** Listen to an event. Returns a function that stops listening. */
    on<K extends keyof MarkmapEvents>(type: K, listener: (value: MarkmapEvents[K]) => void): () => void;
    private emit;
    /**
     * Zoom by `factor` around the center of the element, animated. Repeated calls during an
     * animation add up. The scale stays within the zoom behavior's scale extent.
     */
    zoomBy(factor: number): void;
    zoomIn(): void;
    zoomOut(): void;
    /** Move the view to `target`, animated unless animations are off. */
    private zoomTo;
    toggle(id: string): void;
    /**
     * Scale and center the drawing to fill the element. If it has no size yet (hidden,
     * or not laid out), the fit happens as soon as it gets one.
     */
    fit(): void;
    private fitWhenSized;
    /** Current zoom transform. */
    get transform(): ZoomTransform;
    /**
     * What a point in layout coordinates acts on, where things are drawn right now (also
     * mid-animation). Nodes on their way out cannot be clicked.
     */
    hitAt(x: number, y: number): HitTarget | undefined;
    /** Layout coordinates of a point in the viewport, such as a pointer's position. */
    layoutPoint(clientX: number, clientY: number): [number, number];
    /** Id of the node whose notes are open, if any. */
    get openNoteId(): string | undefined;
    /** Show a node's notes in a popover next to it. */
    openNotes(id: string): Promise<void>;
    closeNotes(): void;
    /**
     * Token values as the element resolves them right now, so the popover matches the color
     * scheme in effect and any CSS overrides on the page.
     */
    private currentTokens;
    /** A node's box in viewport coordinates, where it is drawn right now. */
    screenRect(id: string): Rect | undefined;
    setGroups(groups: RenderGroup[]): void;
    get groups(): readonly RenderGroup[];
    groupScreenRect(id: string | number): Rect | undefined;
    private positionPopover;
    private handleOutside;
    private handleKey;
    private handleScroll;
    destroy(): void;
}
/**
 * A zoom transform `t` of the way from `a` to `b`. The scale changes geometrically and
 * the layout point under (`cx`, `cy`) moves in a straight line, so a pure pan moves at a
 * constant speed and zooming does not swing sideways.
 */
export declare function interpolateZoom(a: ZoomTransform, b: ZoomTransform, t: number, cx: number, cy: number): ZoomTransform;
