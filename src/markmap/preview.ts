import { parseDocument } from '@markmap/model';
import { Markmap } from '@markmap/view';

import { messageOf } from './errors';
import { optionsFor, type MarkmapColorScheme } from './options';

export type MarkmapPreviewMount = {
  svg: SVGSVGElement;
  markdown: string;
  colorScheme: MarkmapColorScheme;
  onError: (message: string) => void;
};

export type MarkmapPreview = {
  setColorScheme: (colorScheme: MarkmapColorScheme) => void;
  destroy: () => void;
};

export type MarkmapPreviewResult =
  { ok: true; preview: MarkmapPreview } | { ok: false; message: string };

export type MarkmapPreviewFactory = (mount: MarkmapPreviewMount) => MarkmapPreviewResult;

export const createMarkmapPreview: MarkmapPreviewFactory = (mount) => {
  try {
    const parsed = parseDocument(mount.markdown);
    const resolved = optionsFor(mount.colorScheme, parsed.frontmatter);
    for (const warning of resolved.warnings) mount.onError(warning);
    const markmap = Markmap.create(mount.svg, parsed.tree, {
      ...resolved.options,
      graph: parsed.document.graph,
      identities: parsed.document.identities,
    });
    return {
      ok: true,
      preview: {
        setColorScheme: (colorScheme) => {
          markmap.setOptions({ ...markmap.options, colorScheme });
        },
        destroy: () => {
          markmap.destroy();
          mount.svg.replaceChildren();
        },
      },
    };
  } catch (error) {
    mount.svg.replaceChildren();
    return { ok: false, message: messageOf(error) };
  }
};
