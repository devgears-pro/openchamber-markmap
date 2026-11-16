import { describe, expect, test } from 'vitest';

import { layoutFor } from '../src/markmap/layouts';
import { optionsFor } from '../src/markmap/options';

describe('map options', () => {
  test('[R-02] applies the editor defaults and the host mode', () => {
    const resolved = optionsFor('light', {});

    expect(resolved.options.colorScheme).toBe('light');
    expect(resolved.options.duration).toBe(0);
    expect(resolved.options.fitPadding).toBe(24);
    expect(resolved.options.fitMaxScale).toBe(1);
    expect(resolved.options.layout).toBe(layoutFor('two-sided'));
    expect(resolved.layout).toBe('two-sided');
    expect(resolved.warnings).toEqual([]);
  });

  test('[R-02] reads every supported layout from frontmatter', () => {
    expect(optionsFor('dark', { markmap: { layout: 'tree' } }).layout).toBe('tree');
    expect(optionsFor('dark', { markmap: { layout: 'two-sided' } }).layout).toBe('two-sided');
    expect(optionsFor('dark', { markmap: { layout: 'org-chart' } }).layout).toBe('org-chart');
  });

  test('[R-32] uses the soft theme by default and keeps explicit themes', () => {
    expect(optionsFor('light', {}).options.theme?.name).toBe('soft');
    for (const theme of ['classic', 'cards', 'minimal']) {
      expect(optionsFor('light', { markmap: { theme } }).options.theme?.name).toBe(theme);
    }
    expect(
      optionsFor('light', { markmap: { color: ['#123456'], colorDepth: 2 } }).options.theme?.tokens[
        'mm-branch-0'
      ],
    ).toBe('#123456');
  });

  test('[R-02] reports ignored frontmatter values', () => {
    const resolved = optionsFor('dark', { markmap: { nope: true } });

    expect(resolved.warnings.length).toBeGreaterThan(0);
    expect(resolved.layout).toBe('two-sided');
  });
});
