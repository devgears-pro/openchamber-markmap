import type { MarkmapNode } from '@markmap/core';
import { type Document, type RandomSource } from '@markmap/model';
import { EditError } from './errors';
import { type Splice } from './splice';
export type Command = {
    type: 'setLabel';
    node: string;
    text: string;
} | {
    type: 'setNotes';
    node: string;
    text: string;
} | {
    type: 'createRootHeading';
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
    type: 'insertBlock';
    node: string;
    text: string;
    random?: RandomSource;
} | {
    type: 'delete';
    node: string;
} | {
    type: 'deleteNodes';
    nodes: string[];
} | {
    type: 'outdent';
    node: string;
} | {
    type: 'move';
    node: string;
    parent: string;
    index: number;
} | {
    type: 'moveNodes';
    nodes: string[];
    parent: string;
    index: number;
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
export declare function rootHeadingRefusal(doc: Document, nodeId?: string): EditError | null;
