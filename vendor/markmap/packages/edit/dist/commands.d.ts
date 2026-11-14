import type { MarkmapNode } from '@markmap/core';
import { type Document } from '@markmap/model';
import { type Splice } from './splice';
export type Command = {
    type: 'setLabel';
    node: string;
    text: string;
} | {
    type: 'insertChild';
    node: string;
    text?: string;
} | {
    type: 'insertSibling';
    node: string;
    text?: string;
} | {
    type: 'delete';
    node: string;
} | {
    type: 'outdent';
    node: string;
} | {
    type: 'toggleCheck';
    node: string;
};
export interface EditResult {
    document: Document;
    tree: MarkmapNode;
    edits: Splice[];
    selection: number;
}
export declare function applyCommand(doc: Document, command: Command): EditResult;
