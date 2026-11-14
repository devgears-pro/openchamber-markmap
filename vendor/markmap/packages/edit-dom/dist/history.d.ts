import type { HistoryEntry } from './types';
export declare class History {
    private undoStack;
    private redoStack;
    get canUndo(): boolean;
    get canRedo(): boolean;
    push(entry: HistoryEntry): void;
    undo(current: HistoryEntry): HistoryEntry | undefined;
    redo(current: HistoryEntry): HistoryEntry | undefined;
    clear(): void;
}
