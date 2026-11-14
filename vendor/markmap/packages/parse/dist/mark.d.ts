import type { Extension as FromMarkdownExtension } from 'mdast-util-from-markdown';
import type { Extension } from 'micromark-util-types';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';
declare module 'micromark-util-types' {
    interface TokenTypeMap {
        mark: 'mark';
        markSequence: 'markSequence';
        markSequenceTemporary: 'markSequenceTemporary';
        markText: 'markText';
    }
}
/**
 * micromark syntax for `==text==`, modeled on GFM strikethrough: a sequence of exactly two
 * `=` with the same flanking rules as `**`. Because it runs in the tokenizer, escapes
 * (`\=`), character references (`&#61;`) and code spans are never delimiters.
 */
export declare function markSyntax(): Extension;
export declare function markFromMarkdown(): FromMarkdownExtension;
/**
 * Turn `==text==` into `mark` nodes. Like `**`, delimiters can wrap other inline nodes
 * (`==a **b**==`) but not cross block boundaries.
 */
export declare const remarkMark: Plugin<[], Root>;
