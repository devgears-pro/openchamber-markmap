import { builtinLayouts, builtinThemes, softTheme } from '@markmap/render';
import { resolveViewOptions, type ViewOptions } from '@markmap/view';

import { mapGestures } from './gestures';
import { layoutFor, type MarkmapLayout } from './layouts';

export type MarkmapColorScheme = 'light' | 'dark';

type ResolvedView = {
  options: ViewOptions;
  warnings: string[];
  layout: MarkmapLayout;
};

const layoutNameOf = (layout: ViewOptions['layout']): MarkmapLayout => {
  if (layout?.name === 'tree') return 'tree';
  if (layout?.name === 'org-chart') return 'org-chart';
  return 'two-sided';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const optionsFor = (
  colorScheme: MarkmapColorScheme,
  frontmatter: Record<string, unknown>,
): ResolvedView => {
  const mapOptions = isRecord(frontmatter['markmap']) ? frontmatter['markmap'] : {};
  const themeName = mapOptions['theme'];
  const softDefault =
    themeName !== 'classic' && themeName !== 'cards' && themeName !== 'minimal';
  const base: ViewOptions = {
    duration: 0,
    fitPadding: 24,
    fitMaxScale: 1,
    layout: layoutFor('two-sided'),
    theme: softTheme,
    ...(softDefault ? { siblingGap: 14, levelGap: 110 } : {}),
  };
  const resolved = resolveViewOptions(base, frontmatter['markmap'], {
    layouts: builtinLayouts,
    themes: builtinThemes,
  });
  return {
    options: { ...resolved.options, colorScheme, gestures: mapGestures },
    warnings: resolved.warnings,
    layout: layoutNameOf(resolved.options.layout),
  };
};
