import type { Inline, MarkmapNode } from './types';
/** Return `false` from the visitor to skip a node's children. */
export type TreeVisitor = (node: MarkmapNode, parent: MarkmapNode | undefined, depth: number) => void | false;
/** Visit every node in pre-order. */
export declare function walkTree(root: MarkmapNode, visitor: TreeVisitor): void;
/** Return the path from the root to the node with `id`, both included, or `undefined`. */
export declare function findPath(root: MarkmapNode, id: string): MarkmapNode[] | undefined;
export declare function findNode(root: MarkmapNode, id: string): MarkmapNode | undefined;
/** Plain text of inline content, as used for ids, search and accessibility labels. */
export declare function toPlainText(content: readonly Inline[]): string;
