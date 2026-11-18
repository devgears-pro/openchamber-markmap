import type { Inline, InlineContext, MarkmapNode, Rect, TextStyle } from '@markmap/core';
import { softTheme } from '@markmap/render';
import { describe, expect, test } from 'vitest';

import {
  applyMarker,
  leadingMarker,
  MARKER_GROUPS,
  markerContent,
  markerSvg,
  removeMarker,
} from '../src/markmap/markers';

const dummyNode: MarkmapNode = {
  id: 'root',
  type: 'root',
  content: [],
  notes: [],
  data: {},
  children: [],
};

const dummyContext: InlineContext = {
  theme: softTheme,
  measurer: {
    measure: () => 10,
  },
  node: dummyNode,
};

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

  test('[R-18] groups markers into XMind-aligned categories', () => {
    expect(MARKER_GROUPS.map((group) => group.label)).toEqual([
      'Tag',
      'Priority',
      'Task',
      'Flag',
      'Star',
      'People',
      'Symbol',
    ]);
    expect(MARKER_GROUPS.every((group) => group.markers.length > 0)).toBe(true);
  });

  test('[R-18] includes priority 1 through 7', () => {
    const priority = MARKER_GROUPS.find((group) => group.label === 'Priority');
    expect(priority?.markers.map((marker) => marker.glyph)).toEqual([
      '1️⃣',
      '2️⃣',
      '3️⃣',
      '4️⃣',
      '5️⃣',
      '6️⃣',
      '7️⃣',
    ]);
  });

  test('[R-18] extracts the leading marker from a label', () => {
    expect(leadingMarker('✅ Root')?.glyph).toBe('✅');
    expect(leadingMarker('7️⃣ Late task')?.label).toBe('7');
    expect(leadingMarker('  ○ Empty')?.glyph).toBe('○');
    expect(leadingMarker('Plain title')).toBeUndefined();
    expect(leadingMarker('')).toBeUndefined();
  });

  test('[R-18] removes the leading marker and trims following whitespace', () => {
    expect(removeMarker('✅ Root')).toBe('Root');
    expect(removeMarker('🚩   Multiple spaces')).toBe('Multiple spaces');
    expect(removeMarker('⭐')).toBe('');
    expect(removeMarker('No marker here')).toBe('No marker here');
  });

  test('[R-18] generates vector SVG for every supported marker', () => {
    const allMarkers = MARKER_GROUPS.flatMap((group) => group.markers);
    for (const marker of allMarkers) {
      const svg = markerSvg(marker.glyph, 16);
      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('</svg>');
    }
  });

  test('[R-18] renders pie-chart progress markers with sector paths', () => {
    const empty = markerSvg('○', 16);
    const quarter = markerSvg('◔', 16);
    const half = markerSvg('◐', 16);
    const full = markerSvg('●', 16);

    expect(empty).toContain('<circle');
    expect(quarter).toContain('<path');
    expect(half).toContain('<path');
    expect(full).toContain('<circle');
  });

  test('[R-18] renders priority markers as rounded badges with number paths', () => {
    const p1 = markerSvg('1️⃣', 16);
    const p7 = markerSvg('7️⃣', 16);

    expect(p1).toContain('<circle');
    expect(p1).toContain('<path');
    expect(p7).toContain('<circle');
    expect(p7).toContain('<path');
  });

  test('[R-18] transforms leading marker text into html atom inline', () => {
    if (markerContent.transform === undefined) throw new Error('No transform');

    const result = markerContent.transform([{ type: 'text', value: '✅ Root' }], dummyNode);
    expect(result).toEqual([
      { type: 'html', value: '✅' },
      { type: 'text', value: 'Root' },
    ]);

    const onlyMarker = markerContent.transform([{ type: 'text', value: '⭐' }], dummyNode);
    expect(onlyMarker).toEqual([{ type: 'html', value: '⭐' }]);

    const plain: Inline[] = [{ type: 'text', value: 'No marker' }];
    expect(markerContent.transform(plain, dummyNode)).toBe(plain);

    const empty: Inline[] = [];
    expect(markerContent.transform(empty, dummyNode)).toBe(empty);

    const nonText: Inline[] = [{ type: 'html', value: '<div></div>' }];
    expect(markerContent.transform(nonText, dummyNode)).toBe(nonText);
  });

  test('[R-18] measures and renders marker atom primitives', () => {
    const htmlAtom = markerContent.atoms?.html;
    if (htmlAtom === undefined) throw new Error('No html atom');

    const style: TextStyle = {
      font: {
        size: 16,
        style: 'normal' as const,
        weight: 400,
        family: 'sans-serif',
        lineHeight: 20,
      },
      fill: '#000000',
    };
    const size = htmlAtom.measure({ type: 'html', value: '✅' }, style, dummyContext);
    expect(size.width).toBeGreaterThan(16);
    expect(size.height).toBeGreaterThan(16);
    expect(size.baseline).toBeGreaterThan(0);

    const box: Rect = { x: 10, y: 20, width: 20, height: 20 };
    const primitives = htmlAtom.render({ type: 'html', value: '✅' }, box, style, dummyContext);
    expect(primitives).toHaveLength(2);
    const first = primitives[0];
    expect(first?.kind).toBe('custom');
    if (first?.kind === 'custom') {
      expect(first.svg?.()).toContain('<g transform="translate(10 20) scale(');
    }
    expect(primitives[1]).toEqual({
      kind: 'hit',
      action: 'marker',
      rect: { x: 10, y: 20, width: 20, height: 20 },
    });
  });

  test('[R-18] handles unknown marker glyph gracefully', () => {
    expect(markerSvg('unknown')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"></svg>',
    );
  });
});
