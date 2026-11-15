import { type MarkmapNode } from '@markmap/core';
import type { Root } from 'mdast';
import type { PluggableList } from 'unified';
export interface ToTreeOptions {
    /** Title for a synthesized root, usually from frontmatter. */
    title?: string;
    plugins?: PluggableList;
}
/**
 * Convert an mdast tree into a Markmap tree.
 *
 * - Headings nest by depth; list items nest under the heading or item that contains them.
 * - Other blocks become notes of the node that owns them. Blocks before the first
 *   heading attach to the root.
 * - A lone top-level H1 becomes the root, unless `title` is given.
 * - Raw HTML, frontmatter and link definitions are dropped. A `<!-- markmap: … -->`
 *   comment in a label sets node options: `fold` folds the node, `foldAll` folds it
 *   and everything below.
 */
export declare function toTree(mdast: Root, options?: ToTreeOptions): MarkmapNode;
