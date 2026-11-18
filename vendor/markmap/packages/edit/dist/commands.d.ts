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
} | {
    type: 'createGroup';
    nodes: string[];
    label?: string;
    random?: RandomSource;
} | {
    type: 'deleteGroup';
    groupIndex: number;
} | {
    type: 'setGroupLabel';
    groupIndex: number;
    text: string;
} | {
    type: 'createEdge';
    from: string;
    to: string;
    label?: string | null;
    random?: RandomSource;
} | {
    type: 'deleteEdge';
    from: string;
    to: string;
} | {
    type: 'setEdgeLabel';
    from: string;
    to: string;
    label: string | null;
} | {
    type: 'setLayout';
    layout: string;
    node?: string | null;
};
export interface EditResult {
    document: Document;
    tree: MarkmapNode;
    edits: Splice[];
    selection: number;
}
type SelectionPlan = {
    kind: 'insert';
    edit: number;
    offset: number;
} | {
    kind: 'source';
    offset: number;
};
export interface Plan {
    edits: Splice[];
    selection: SelectionPlan;
    verify: (next: Document, selection: number) => void;
}
export declare function applyCommand(doc: Document, command: Command): EditResult;
export declare function planCommand(doc: Document, command: Command): Plan;
export declare function rootHeadingRefusal(doc: Document, nodeId?: string): EditError | null;
export {};
