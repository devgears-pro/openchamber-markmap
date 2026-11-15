import type { Root } from 'mdast';
import { type PluggableList } from 'unified';
/**
 * GFM depends on the most third-party code, and old browsers reject syntax it may use, like
 * regex lookbehind before Safari 16.4. A map without GFM is better than no map at all.
 */
export declare function parseMdast(markdown: string, plugins: PluggableList, gfm?: boolean): {
    mdast: Root;
    gfm: boolean;
};
