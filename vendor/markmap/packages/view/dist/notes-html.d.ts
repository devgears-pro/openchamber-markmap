import type { Note, ContentPlugin } from '@markmap/core';
export interface NotesHtmlOptions {
    /** Plugins whose `popover` hooks run on the sanitized tree, in order. */
    plugins?: readonly ContentPlugin[];
    /** Color code blocks that name a language. Defaults to `true`. */
    highlight?: boolean;
}
/**
 * Render note blocks as HTML: Markdown to HTML, sanitized, then code highlighting
 * and plugin hooks, which may add trusted markup. Loaded on demand by the view, and
 * the highlighter only when a code block names a language, so neither weighs on the
 * initial bundle.
 */
export declare function notesToHtml(notes: readonly Note[], options?: NotesHtmlOptions): Promise<string>;
