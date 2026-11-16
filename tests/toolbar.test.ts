import { builtinButtons, type ToolbarButton, type ToolbarItem } from '@markmap/toolbar';
import { describe, expect, test, vi } from 'vitest';

import { createToolbarItems } from '../src/markmap/toolbar-items';

const onReset = vi.fn();

const itemsOf = (): readonly ToolbarItem[] => createToolbarItems(onReset);

const buttonOf = (label: string, items: readonly ToolbarItem[]): ToolbarButton => {
  const button = items.find(
    (item): item is ToolbarButton => typeof item !== 'string' && item.label === label,
  );
  if (button === undefined) throw new Error(`No toolbar button ${label}`);
  return button;
};

describe('map toolbar icons', () => {
  test('[R-27] replaces built-in paths while preserving map actions and labels', () => {
    const items = itemsOf();
    const labels = ['Zoom in', 'Zoom out', 'Fit to view', 'Reset view', 'Expand all'];
    const builtins = ['Zoom in', 'Zoom out', 'Fit to view', 'Expand all'];
    const keys = ['zoom-in', 'zoom-out', 'fit', 'expand-all'] as const;

    expect(
      items
        .filter((item): item is ToolbarButton => typeof item !== 'string')
        .map((item) => item.label),
    ).toEqual(labels);
    expect(items).toContain('fold-level');

    const custom = items.filter((item): item is ToolbarButton => typeof item !== 'string');
    expect(new Set(custom.map((item) => item.icon)).size).toBe(labels.length);

    for (const [index, key] of keys.entries()) {
      const item = buttonOf(builtins[index] ?? '', items);
      expect(item.icon).toBeTruthy();
      expect(item.icon).not.toBe(builtinButtons[key].icon);
      expect(item.onClick).toBe(builtinButtons[key].onClick);
      expect(item.disabled).toBe(builtinButtons[key].disabled);
    }

    const reset = buttonOf('Reset view', items);
    expect(reset.icon).toBeTruthy();
    expect(reset.onClick).toBe(onReset);
  });
});
