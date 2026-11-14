import type { Root } from 'mdast';
/** Replace `[text][ref]` and `![alt][ref]` with plain links and images, and drop definitions. */
export declare function remarkResolveReferences(): (tree: Root) => void;
