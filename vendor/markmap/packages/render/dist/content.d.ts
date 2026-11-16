import type { ContentPlugin } from '@markmap/core';
/** Keep http(s), mailto, tel and relative URLs. Anything else, such as `javascript:`, is dropped. */
export declare function sanitizeUrl(url: string): string | undefined;
/** Bold, italic, inline code, links, strikethrough, highlight and task checkboxes. */
export declare const basicContent: ContentPlugin;
/**
 * Adds a dot after the label of nodes with notes, with a hit area that asks the
 * view to open them. The dot is exported; the hit area is interactive-only.
 */
export declare const noteContent: ContentPlugin;
