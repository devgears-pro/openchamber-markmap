import { builtinButtons, type ToolbarItem } from '@markmap/toolbar';

const ICONS = {
  zoomIn: 'M6.75 2.75a4 4 0 1 1 0 8a4 4 0 1 1 0-8ZM4.75 6.75h4M6.75 4.75v4M9.75 9.75 13.25 13.25',
  zoomOut: 'M6.75 2.75a4 4 0 1 1 0 8a4 4 0 1 1 0-8ZM4.75 6.75h4M9.75 9.75 13.25 13.25',
  fit: 'M6.5 2.25H2.25v4.25M9.5 2.25h4.25v4.25M13.75 9.5v4.25H9.5M6.5 13.75H2.25V9.5',
  expandAll: 'M3.25 3.25 8 8l4.75-4.75M3.25 8 8 12.75l4.75-4.75',
} as const;

export const createToolbarItems = (): readonly ToolbarItem[] => [
  { ...builtinButtons['zoom-in'], icon: ICONS.zoomIn },
  { ...builtinButtons['zoom-out'], icon: ICONS.zoomOut },
  { ...builtinButtons.fit, icon: ICONS.fit },
  { ...builtinButtons['expand-all'], icon: ICONS.expandAll },
  'fold-level',
];
