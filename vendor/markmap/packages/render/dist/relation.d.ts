import type { Anchor, GraphEdge, Point, Primitive, Side, Theme } from '@markmap/core';
import type { DrawNode } from './render';
export interface RelationCurve {
    p0: Point;
    p1: Point;
    p2: Point;
    p3: Point;
    d: string;
    arrowD: string;
    midX: number;
    midY: number;
    angle: number;
}
export declare function sideVector(side: Side): Point;
export declare function computeRelationCurve(p0: Anchor, p3: Anchor, srcSide: Side, tgtSide: Side): RelationCurve;
export interface RenderRelationParams {
    edges: readonly GraphEdge[];
    identities?: ReadonlyMap<string, string>;
    nodesById: ReadonlyMap<string, DrawNode>;
    rootId?: string;
    folded?: ReadonlySet<string>;
    theme: Theme;
}
export declare function renderRelationEdges({ edges, identities, nodesById, rootId, folded, theme, }: RenderRelationParams): Primitive[];
