import { builtinButtons, type ToolbarItem } from '@markmap/toolbar';

const ICONS = {
  zoomIn: 'M7 2.8a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4ZM10.1 10.1 13.8 13.8M4.9 7h4.2M7 4.9v4.2',
  zoomOut: 'M7 2.8a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4ZM10.1 10.1 13.8 13.8M4.9 7h4.2',
  fit: 'M6.5 2H2v4.5M9.5 2H14v4.5M14 9.5V14H9.5M6.5 14H2V9.5',
  expandAll: 'M3 3 8 8l5-5M3 8l5 5 5-5',
} as const;

export const createToolbarItems = (): readonly ToolbarItem[] => [
  { ...builtinButtons['zoom-in'], icon: ICONS.zoomIn },
  { ...builtinButtons['zoom-out'], icon: ICONS.zoomOut },
  { ...builtinButtons.fit, icon: ICONS.fit },
  { ...builtinButtons['expand-all'], icon: ICONS.expandAll },
  'fold-level',
];
