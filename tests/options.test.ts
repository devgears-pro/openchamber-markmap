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

  test('[R-02] reports ignored frontmatter values', () => {
    const resolved = optionsFor('dark', { markmap: { nope: true } });

    expect(resolved.warnings.length).toBeGreaterThan(0);
    expect(resolved.layout).toBe('two-sided');
  });
});
