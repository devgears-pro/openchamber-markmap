import type { MarkmapNode } from '@markmap/core';
import type { Document, DocumentMeta, EditNode } from './types';
export interface ParseDocumentResult {
    document: Document;
    tree: MarkmapNode;
    frontmatter: Record<string, unknown>;
}
export declare function parseDocument(source: string): ParseDocumentResult;
export declare function buildDocument(source: string): Document;
export declare function contentNodeCount(doc: Document): number;
export declare function buildFromTree(source: string, root: MarkmapNode, meta: DocumentMeta): Document;
export declare function nodeAtOffset(doc: Document, offset: number): EditNode | undefined;
export declare function labelText(doc: Document, node: EditNode): string;
export declare function indentColumns(node: EditNode): number;
