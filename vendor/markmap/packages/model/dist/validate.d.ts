import type { Document, Issue } from './types';
export declare class ModelError extends Error {
    issues: Issue[];
    constructor(issues: Issue[]);
}
export declare function validateDocument(doc: Document): Issue[];
export declare function assertDocument(doc: Document): void;
