/** Clock and frame source, injectable for tests. */
export interface Scheduler {
    now(): number;
    request(callback: () => void): number;
    cancel(handle: number): void;
}
export declare const animationFrames: Scheduler;
/**
 * Runs one animation at a time: starting a new one stops the previous one, so callers
 * restart from whatever they last drew.
 */
export declare class Tween {
    private scheduler;
    private handle?;
    constructor(scheduler?: Scheduler);
    get running(): boolean;
    /**
     * Call `frame` with progress from 0 to 1 on every animation frame for `duration` ms.
     * The last call is always exactly 1. A duration of 0 calls `frame(1)` right away.
     */
    start(duration: number, frame: (t: number) => void): void;
    stop(): void;
}
