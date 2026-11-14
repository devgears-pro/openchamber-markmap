import type { MarkmapNode } from './types';
export declare const ROOT_ID = "root";
/** 32-bit FNV-1a hash of a string, in base 36. */
export declare function hashString(input: string): string;
/**
 * Assign stable ids in place. The root is always `root`. Every other id is a hash of
 * the parent id and the node's plain text, so ids survive edits elsewhere in the
 * document. Siblings with the same text are told apart by their occurrence index.
 */
export declare function assignIds(root: MarkmapNode): MarkmapNode;
