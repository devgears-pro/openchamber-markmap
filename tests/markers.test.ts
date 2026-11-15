import { describe, expect, test } from 'vitest';

import { applyMarker, MARKER_GROUPS } from '../src/markmap/markers';

describe('node markers', () => {
  test('[R-18] prefixes a plain label', () => {
    expect(applyMarker('Root', '✅')).toBe('✅ Root');
  });

  test('[R-18] replaces an existing leading marker', () => {
    expect(applyMarker('🚩 Root', '✅')).toBe('✅ Root');
  });

  test('[R-18] keeps the same marker unchanged', () => {
    expect(applyMarker('✅ Root', '✅')).toBe('✅ Root');
  });

  test('[R-18] handles a label that is only a marker', () => {
    expect(applyMarker('⭐', '✅')).toBe('✅');
  });

  test('[R-18] normalizes whitespace before prefixing', () => {
    expect(applyMarker('  Root', '✅')).toBe('✅ Root');
    expect(applyMarker('🚩  Root', '✅')).toBe('✅ Root');
  });

  test('[R-18] leaves an unknown leading glyph in place', () => {
    expect(applyMarker('🔥 Root', '✅')).toBe('✅ 🔥 Root');
  });

  test('[R-18] groups status, priority, progress and flags', () => {
    expect(MARKER_GROUPS.map((group) => group.label)).toEqual([
      'Status',
      'Priority',
      'Progress',
      'Flags',
    ]);
    expect(MARKER_GROUPS.every((group) => group.markers.length > 0)).toBe(true);
  });
});
