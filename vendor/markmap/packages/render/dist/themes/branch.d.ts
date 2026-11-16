/**
 * Pick a color index for a node from its path of ids, for themes that color by branch.
 * The node's id is hashed, so colors stay put as the tree changes. With `colorDepth`
 * (the root is level 1), nodes deeper than that level use their ancestor's id instead.
 */
export declare function branchIndex(path: readonly string[], count: number, colorDepth?: number): number;
/** The d3 category10 palette, used by the built-in themes. */
export declare const DEFAULT_COLORS: readonly string[];
/** Options shared by themes that color by branch. */
export interface BranchColorOptions {
    /** Branch colors, cycled through. One color paints every branch the same. */
    color?: string[];
    /** Nodes deeper than this level (the root is level 1) take their ancestor's color. `0` disables. */
    colorDepth?: number;
}
/** Branch color tokens and a lookup from a node's path to its `var(--mm-branch-N)`. */
export declare function branchColors(options: BranchColorOptions): {
    tokens: {
        [k: string]: string;
    };
    colorOf: (path: readonly string[]) => string;
};
