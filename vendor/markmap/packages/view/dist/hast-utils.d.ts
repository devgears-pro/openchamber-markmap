import type { Element, Root as HastRoot } from 'hast';
/** Languages named by `<pre><code class="language-…">` blocks. */
export declare function codeLanguages(tree: HastRoot): string[];
export declare function languageOf(code: Element | undefined): string | undefined;
export declare function walkElements(node: HastRoot | Element, tagName: string): Generator<Element>;
