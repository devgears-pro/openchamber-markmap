import type { Document, EditNode, Range } from '@markmap/model';
export declare function lineEnding(source: string): string;
export declare function newlineLengthAt(source: string, offset: number): number;
export declare function cutRange(source: string, block: Range): Range;
export interface InsertedLine {
    insert: string;
    leading: number;
}
export declare function blockInsertion(source: string, position: number, block: string, ending: string): InsertedLine;
export declare function insertLine(source: string, position: number, line: string, ending: string): InsertedLine;
export declare function placeBlock(block: string, ending: string, atLineStart: boolean, following: boolean): InsertedLine;
export declare function headingLine(level: number, text: string): string;
export declare function listLine(indent: string, marker: string, text: string, ending: string): string;
export declare function cleanLabel(text: string): string;
export declare function listContinuation(node: EditNode): string;
export declare function formatListText(node: EditNode, text: string, ending: string): string;
export declare function assertSingleLine(node: EditNode, text: string): void;
export declare function childIndent(doc: Document, node: EditNode): string;
export declare function childMarker(doc: Document, node: EditNode): string;
export declare function dedentList(text: string, fromIndent: string, toIndent: string, ending: string): string;
export declare function dedentHeadings(doc: Document, node: EditNode, delta: number, ending: string): string;
export declare function firstLineMarker(text: string): number;
export declare function shiftHeadings(text: string, delta: number, ending: string): string;
export declare function headingsToList(text: string, indent: string, unit: string, ending: string): string;
export declare function listToHeadings(text: string, level: number, ending: string): string;
export declare function reindentList(text: string, delta: number, ending: string): string;
