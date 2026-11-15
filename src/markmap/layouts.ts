import { orgChartLayout, treeLayout, twoSidedLayout } from '@markmap/render';

export const MARKMAP_LAYOUTS = ['tree', 'two-sided', 'org-chart'] as const;

export type MarkmapLayout = (typeof MARKMAP_LAYOUTS)[number];

const LAYOUTS = {
  tree: treeLayout,
  'two-sided': twoSidedLayout,
  'org-chart': orgChartLayout,
} as const;

export const layoutFor = (layout: MarkmapLayout): (typeof LAYOUTS)[MarkmapLayout] =>
  LAYOUTS[layout];
