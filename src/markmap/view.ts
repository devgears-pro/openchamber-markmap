import { parse } from '@markmap/parse';
import { createToolbar } from '@markmap/toolbar';
import { Markmap, resolveViewOptions, type ViewOptions } from '@markmap/view';

export type MarkmapColorScheme = 'light' | 'dark';

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
) => MarkmapResult;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const optionsFor = (
  colorScheme: MarkmapColorScheme,
  frontmatter: Record<string, unknown>,
): ViewOptions => ({
  ...resolveViewOptions({ duration: 0, fitPadding: 24 }, frontmatter.markmap).options,
  colorScheme,
});

export const createMarkmapView: MarkmapFactory = (svg, markdown, colorScheme) => {
  let markmap: Markmap | null = null;
  try {
    const parsed = parse(markdown);
    markmap = Markmap.create(svg, parsed.root, optionsFor(colorScheme, parsed.frontmatter));
    const toolbar = createToolbar(markmap);
    const view: MarkmapView = {
      toolbar: toolbar.element,
      update: (nextMarkdown, nextScheme) => {
        const next = parse(nextMarkdown);
        markmap?.setTree(next.root, optionsFor(nextScheme, next.frontmatter));
        markmap?.fit();
      },
      destroy: () => {
        toolbar.destroy();
        markmap?.destroy();
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
