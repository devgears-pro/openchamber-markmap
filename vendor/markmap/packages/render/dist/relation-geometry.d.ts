import type { Anchor, Rect, Side } from '@markmap/core';
export interface RelationRouteEndpoint {
    rect: Rect;
    anchors: readonly Anchor[];
}
export interface RelationRouteGeometry {
    d: string;
    p0: Anchor;
    p3: Anchor;
    midX: number;
    midY: number;
    angle: number;
    bounds: Rect;
    length: number;
}
export declare function relationAnchorCandidates(rect: Rect, anchorForSide: (side: Side) => Anchor): Anchor[];
export declare function routeRelationGeometry(source: RelationRouteEndpoint, target: RelationRouteEndpoint, obstacles: readonly Rect[]): RelationRouteGeometry;
