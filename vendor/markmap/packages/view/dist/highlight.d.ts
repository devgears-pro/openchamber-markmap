import type { Root } from 'hast';
/**
 * Color `<pre><code class="language-…">` blocks in place with highlight.js classes
 * (`hljs-keyword`, …). Unknown languages are left as they are. The tree must already be
 * sanitized: the highlighter only adds spans around the code's own text.
 */
export declare function highlightCode(tree: Root): void;
