import { parse } from '@markmap/parse';
import { createToolbar } from '@markmap/toolbar';
import { Markmap, resolveViewOptions, type ViewOptions } from '@markmap/view';

export type MarkmapColorScheme = 'light' | 'dark';

export type MarkmapSourceRange = { start: number; end: number };

export type MarkmapView = {
  readonly toolbar: HTMLDivElement;
  update: (markdown: string, colorScheme: MarkmapColorScheme) => void;
  destroy: () => void;
};

export type MarkmapResult = { ok: true; view: MarkmapView } | { ok: false; message: string };

export type MarkmapFactory = (
  svg: SVGSVGElement,
  markdown: string,
  colorScheme: MarkmapColorScheme,
  onNode: (range: MarkmapSourceRange) => void,
) => MarkmapResult;

type TreeNode = {
  id: string;
  position?: MarkmapSourceRange;
  children: TreeNode[];
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const positionOf = (node: TreeNode, id: string): MarkmapSourceRange | null => {
  if (node.id === id) return node.position ?? null;
  for (const child of node.children) {
    const range = positionOf(child, id);
    if (range !== null) return range;
  }
  return null;
};

const optionsFor = (
  colorScheme: MarkmapColorScheme,
  frontmatter: Record<string, unknown>,
): ViewOptions => ({
  ...resolveViewOptions({ duration: 0, fitPadding: 24 }, frontmatter.markmap).options,
  colorScheme,
});

export const createMarkmapView: MarkmapFactory = (svg, markdown, colorScheme, onNode) => {
  let markmap: Markmap | null = null;
  try {
    const parsed = parse(markdown);
    markmap = Markmap.create(svg, parsed.root, optionsFor(colorScheme, parsed.frontmatter));
    const instance = markmap;
    const toolbar = createToolbar(instance);

    const handleClick = (event: MouseEvent): void => {
      if (event.button !== 0) return;
      const root = instance.tree;
      if (root === undefined) return;
      const [x, y] = instance.layoutPoint(event.clientX, event.clientY);
      const hit = instance.hitAt(x, y);
      if (hit?.kind !== 'node') return;
      const range = positionOf(root, hit.nodeId);
      if (range !== null) onNode(range);
    };
    svg.addEventListener('click', handleClick);

    const view: MarkmapView = {
      toolbar: toolbar.element,
      update: (nextMarkdown, nextScheme) => {
        const next = parse(nextMarkdown);
        instance.setTree(next.root, optionsFor(nextScheme, next.frontmatter));
        instance.fit();
      },
      destroy: () => {
        svg.removeEventListener('click', handleClick);
        toolbar.destroy();
        instance.destroy();
        markmap = null;
        svg.replaceChildren();
      },
    };
    return { ok: true, view };
  } catch (error) {
    markmap?.destroy();
    svg.replaceChildren();
    return { ok: false, message: messageOf(error) };
  }
};
