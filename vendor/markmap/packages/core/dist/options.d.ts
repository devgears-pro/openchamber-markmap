/**
 * Options that can be written in Markdown frontmatter under the `markmap` key and
 * apply to every theme. Themes add their own keys, see `Theme.options`.
 */
export interface MarkmapJSONOptions {
    /** Fold nodes at this depth and deeper when first shown. Leave out to expand everything. */
    foldLevel?: number;
    /** Wrap labels wider than this, in px. `0` disables wrapping. */
    wrapWidth?: number;
    levelGap?: number;
    siblingGap?: number;
    zoom?: boolean;
    pan?: boolean;
    fitPadding?: number;
    fitMaxScale?: number;
    /** Smallest scale to zoom out to. `fit()` may go further to show everything. */
    minScale?: number;
    /** Largest scale to zoom in to. */
    maxScale?: number;
    /** Length of fold, update and fit animations, in ms. `0` disables them. */
    duration?: number;
    /** Name of a registered layout, such as `two-sided` or `org-chart`. */
    layout?: string;
    /** Name of a registered theme, such as `cards`. Its own options apply on top. */
    theme?: string;
    /** `light`, `dark`, or `auto` to follow the reader's system setting. */
    colorScheme?: 'light' | 'dark' | 'auto';
}
/**
 * Checks one untrusted option value. Return `value` to keep it (possibly normalized),
 * `warning` to report a problem, or both when part of the value was dropped.
 */
export type OptionValidator = (value: unknown, key: string) => {
    value?: unknown;
    warning?: string;
};
export type OptionSchema = Record<string, OptionValidator>;
/**
 * A CSS value that cannot break out of a declaration or a `<style>` element.
 * Colors from Markdown end up in embedded CSS, so they must pass this check.
 */
export declare function isSafeCSSValue(value: string): boolean;
export declare const validators: {
    number(min: number, integer?: boolean): OptionValidator;
    /** A short non-empty string, such as a name to look up. */
    string(): OptionValidator;
    oneOf<T extends string>(values: readonly T[]): OptionValidator;
    boolean(): OptionValidator;
    /** One CSS color or a list of them; always normalized to a list. Unsafe values are dropped. */
    colors(): OptionValidator;
};
export interface ValidatedOptions<T> {
    options: T;
    /** Keys the schema does not know, left for another schema (such as the theme's). */
    rest: Record<string, unknown>;
    /** Problems found, one per ignored or partly ignored value. */
    warnings: string[];
}
/** Validate untrusted options against a schema. */
export declare function validateOptions<T = Record<string, unknown>>(input: unknown, schema: OptionSchema): ValidatedOptions<T>;
/** Validate the theme-independent options. Theme keys are returned in `rest`. */
export declare function readJSONOptions(input: unknown): ValidatedOptions<MarkmapJSONOptions>;
/** Warnings for keys that no schema claimed. */
export declare function unknownOptionWarnings(rest: Record<string, unknown>): string[];
