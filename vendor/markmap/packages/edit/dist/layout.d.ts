import type { Document } from '@markmap/model';
import type { Plan } from './commands';
export declare function validateCandidate(doc: Document, edits: Array<{
    from: number;
    to: number;
    insert: string;
}>, targetLayout: string): void;
export declare function planSetLayout(doc: Document, layout: string, nodeId?: string | null): Plan;
