import { builtinButtons, type ToolbarItem } from '@markmap/toolbar';

const ICONS = {
  zoomIn: 'M8 2.5v11M2.5 8h11',
  zoomOut: 'M2.5 8h11',
  fit: 'M6 2.5H2.5V6M14 2.5h3.5V6M17.5 14v3.5H14M6 17.5H2.5V14',
  expandAll: 'M3 5h10M3 10h14M3 15h7M14 3l3 2-3 2',
} as const;

export const createToolbarItems = (): readonly ToolbarItem[] => [
  { ...builtinButtons['zoom-in'], icon: ICONS.zoomIn },
  { ...builtinButtons['zoom-out'], icon: ICONS.zoomOut },
  { ...builtinButtons.fit, icon: ICONS.fit },
  { ...builtinButtons['expand-all'], icon: ICONS.expandAll },
  'fold-level',
];
