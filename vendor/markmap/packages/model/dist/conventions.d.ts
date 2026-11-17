import type { Document, EditNode, GraphData, HtmlBlockSource, Issue, RandomSource } from './types';
export interface Conventions {
    identities: Map<string, string>;
    graph: GraphData;
    issues: Issue[];
}
export declare function readConventions(source: string, nodes: Map<string, EditNode>, order: string[], rootId: string, bodyStart: number, htmlBlocks: HtmlBlockSource[]): Conventions;
export declare function validateConventions(doc: Document): Issue[];
export declare function newConventionIssues(before: Document, after: Document): Issue[];
export declare function mintIdentity(taken: ReadonlySet<string>, random: RandomSource): string | null;
export declare function serializeGraphBlock(graph: Pick<GraphData, 'edges' | 'groups'>, ending: string): string;
