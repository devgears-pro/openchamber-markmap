export interface Splice {
    from: number;
    to: number;
    insert: string;
}
export interface SpliceResult {
    text: string;
    starts: number[];
}
export declare function applySplices(source: string, splices: Splice[]): SpliceResult;
export declare function mapOffset(splices: Splice[], offset: number): number;
