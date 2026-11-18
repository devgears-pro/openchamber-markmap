import { type Document, type GraphData, type GraphEdge, type GraphGroup, type RandomSource, type Range } from '@markmap/model';
import { type Splice } from './splice';
export interface CopyBlockOptions {
    title?: string;
    random: RandomSource;
}
export interface GraphRemoval {
    graph: GraphData;
    drop: {
        nodeId: string;
        range: Range;
    }[];
    changed: boolean;
}
export declare function copyBlock(doc: Document, nodeId: string, options: CopyBlockOptions): string | null;
export declare function subtreeIds(doc: Document, nodeId: string): Set<string>;
export declare function readPastedGraph(doc: Document, raw: string, ending: string, random: RandomSource): {
    body: string;
    edges: GraphEdge[];
    groups: GraphGroup[];
};
export declare function removeGraphNodes(doc: Document, removed: ReadonlySet<string>): GraphRemoval;
export declare function graphBlockSplices(source: string, doc: Document, removal: GraphRemoval, cut: Range): Splice[];
export declare function markerRemovalSplices(source: string, removal: GraphRemoval): Splice[];
export declare function mergeGraphSplice(source: string, doc: Document, edges: GraphEdge[], groups: GraphGroup[], ending: string): Splice;
export declare function appendGraphSplice(source: string, graph: GraphData, ending: string): Splice | null;
