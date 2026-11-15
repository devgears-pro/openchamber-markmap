import { builtinButtons, type ToolbarButton } from '@markmap/toolbar';
import { describe, expect, test } from 'vitest';

import { createToolbarItems } from '../src/markmap/toolbar-items';

const buttonOf = (label: string): ToolbarButton => {
  const button = createToolbarItems().find(
    (item): item is ToolbarButton => typeof item !== 'string' && item.label === label,
  );
  if (button === undefined) throw new Error(`No toolbar button ${label}`);
  return button;
};

describe('map toolbar icons', () => {
  test('[R-27] replaces built-in paths while preserving map actions and labels', () => {
    const items = createToolbarItems();
    const labels = ['Zoom in', 'Zoom out', 'Fit to view', 'Expand all'];
    const keys = ['zoom-in', 'zoom-out', 'fit', 'expand-all'] as const;

    expect(
      items
        .filter((item): item is ToolbarButton => typeof item !== 'string')
        .map((item) => item.label),
    ).toEqual(labels);
    expect(items).toContain('fold-level');

    for (const [index, key] of keys.entries()) {
      const item = buttonOf(labels[index] ?? '');
      expect(item.icon).toBeTruthy();
      expect(item.icon).not.toBe(builtinButtons[key].icon);
      expect(item.onClick).toBe(builtinButtons[key].onClick);
      expect(item.disabled).toBe(builtinButtons[key].disabled);
    }
  });
});
