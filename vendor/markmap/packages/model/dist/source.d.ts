export declare function lineStart(source: string, offset: number): number;
export declare function lineEnd(source: string, offset: number): number;
export declare function firstLine(source: string, offset: number): string;
export declare function indentWidth(indent: string): number;
export declare const LIST_MARKER: RegExp;
export declare const HEADING_MARKER: RegExp;
