import { type Point, type Primitive, type Rect } from '@markmap/core';
/** What a point in the drawing can act on. */
export type HitTarget = {
    kind: 'toggle';
    nodeId: string;
}
/** A `hit` primitive: a view action such as opening notes. */
 | {
    kind: 'action';
    nodeId: string;
    action: string;
} | {
    kind: 'link';
    nodeId?: string;
    href: string;
} | {
    kind: 'node';
    nodeId: string;
} | {
    kind: 'group';
    groupId: string;
};
export interface HitIndexOptions {
    /** Fold anchors, in layout coordinates. */
    toggles?: readonly (Point & {
        nodeId: string;
    })[];
    /** How close to a fold anchor a point must be to hit it. */
    toggleRadius?: number;
    /** Node boxes, in layout coordinates and drawing order. */
    nodes?: readonly {
        nodeId: string;
        rect: Rect;
    }[];
    groups?: readonly {
        groupId: string;
        rect: Rect;
    }[];
    /** Leave out targets of nodes this returns `false` for, such as nodes on their way out. */
    include?: (nodeId: string) => boolean;
}
/**
 * Everything clickable in a drawing, in layout coordinates, for any backend. `hit` and
 * `link` primitives are found by walking the primitives (with their group transforms),
 * fold toggles are given as points. Lookups use a static R-tree, so they stay fast for
 * large maps.
 */
export declare class HitIndex {
    private entries;
    private index?;
    private radius;
    constructor(primitives: readonly Primitive[], options?: HitIndexOptions);
    /**
     * The target at a point in layout coordinates. Actions and links win over fold
     * toggles, and the one drawn last (on top) wins among them; among toggles, the nearest.
     * A node's box only counts if none of those is there.
     */
    hit(x: number, y: number): HitTarget | undefined;
}
