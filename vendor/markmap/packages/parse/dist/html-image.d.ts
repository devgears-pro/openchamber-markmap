import type { Root } from 'mdast';
export interface HtmlImage {
    src: string;
    alt: string;
    /** In px. Missing when not given, or not in px (such as a percentage). */
    width?: number;
    height?: number;
}
/**
 * Read one GitHub-style `<img>` tag: exactly one tag, nothing around it, well-formed
 * attributes. Only `src`, `alt`, `width` and `height` are kept; other attributes are
 * ignored. Returns `undefined` for anything else, which callers then drop.
 */
export declare function parseHtmlImage(html: string): HtmlImage | undefined;
/**
 * Turn raw `<img>` tags into `image` nodes, inline and on their own line. All other raw
 * HTML is left alone for later steps to drop.
 */
export declare function remarkHtmlImages(): (tree: Root) => void;
