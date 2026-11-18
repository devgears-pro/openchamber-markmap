import type { AtomSize, ContentPlugin, Inline, Primitive, Rect, TextStyle } from '@markmap/core';

type NodeMarker = {
  readonly glyph: string;
  readonly label: string;
};

type MarkerGroup = {
  readonly label: string;
  readonly markers: readonly NodeMarker[];
};

export const MARKER_GROUPS: readonly MarkerGroup[] = [
  {
    label: 'Status',
    markers: [
      { glyph: '✅', label: 'Done' },
      { glyph: '⏳', label: 'In progress' },
      { glyph: '🚫', label: 'Blocked' },
      { glyph: '⚠️', label: 'Risk' },
    ],
  },
  {
    label: 'Priority',
    markers: [
      { glyph: '1️⃣', label: 'P1' },
      { glyph: '2️⃣', label: 'P2' },
      { glyph: '3️⃣', label: 'P3' },
      { glyph: '4️⃣', label: 'P4' },
      { glyph: '5️⃣', label: 'P5' },
      { glyph: '6️⃣', label: 'P6' },
      { glyph: '7️⃣', label: 'P7' },
    ],
  },
  {
    label: 'Progress',
    markers: [
      { glyph: '○', label: '0%' },
      { glyph: '◔', label: '25%' },
      { glyph: '◐', label: '50%' },
      { glyph: '◑', label: '75%' },
      { glyph: '●', label: '100%' },
    ],
  },
  {
    label: 'Flags',
    markers: [
      { glyph: '🚩', label: 'Flag' },
      { glyph: '⭐', label: 'Star' },
      { glyph: '💡', label: 'Idea' },
      { glyph: '❓', label: 'Question' },
    ],
  },
];

const MARKERS: readonly NodeMarker[] = MARKER_GROUPS.flatMap((group) => group.markers);

export const leadingMarker = (label: string): NodeMarker | undefined => {
  const trimmed = label.trimStart();
  for (const marker of MARKERS) {
    if (trimmed === marker.glyph || trimmed.startsWith(`${marker.glyph} `)) {
      return marker;
    }
  }
  return undefined;
};

export const removeMarker = (label: string): string => {
  const trimmed = label.trimStart();
  for (const marker of MARKERS) {
    if (trimmed === marker.glyph) return '';
    if (trimmed.startsWith(`${marker.glyph} `)) {
      return trimmed.slice(marker.glyph.length).trimStart();
    }
  }
  return label;
};

export const applyMarker = (label: string, glyph: string): string => {
  if (glyph === '') return removeMarker(label);
  const rest = removeMarker(label).trimStart();
  return rest.length === 0 ? glyph : `${glyph} ${rest}`;
};

const PRIORITY_COLORS: Record<string, string> = {
  '1️⃣': '#ef4444',
  '2️⃣': '#f97316',
  '3️⃣': '#eab308',
  '4️⃣': '#3b82f6',
  '5️⃣': '#8b5cf6',
  '6️⃣': '#06b6d4',
  '7️⃣': '#6b7280',
};

const PRIORITY_DIGITS: Record<string, string> = {
  '1️⃣': '1',
  '2️⃣': '2',
  '3️⃣': '3',
  '4️⃣': '4',
  '5️⃣': '5',
  '6️⃣': '6',
  '7️⃣': '7',
};

const markerInnerXml = (glyph: string): string => {
  switch (glyph) {
    case '○':
      return '<circle cx="8" cy="8" r="6" fill="none" stroke="#10b981" stroke-width="1.8"/>';
    case '◔':
      return '<circle cx="8" cy="8" r="6" fill="none" stroke="#10b981" stroke-width="1.8"/><path d="M8 8 L8 2 A6 6 0 0 1 14 8 Z" fill="#10b981"/>';
    case '◐':
      return '<circle cx="8" cy="8" r="6" fill="none" stroke="#10b981" stroke-width="1.8"/><path d="M8 8 L8 2 A6 6 0 0 1 8 14 Z" fill="#10b981"/>';
    case '◑':
      return '<circle cx="8" cy="8" r="6" fill="none" stroke="#10b981" stroke-width="1.8"/><path d="M8 8 L8 2 A6 6 0 1 1 2 8 Z" fill="#10b981"/>';
    case '●':
      return '<circle cx="8" cy="8" r="6.5" fill="#10b981"/><path d="M5 8.2 L7 10.2 L11 5.8" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
    case '✅':
      return '<circle cx="8" cy="8" r="7" fill="#10b981"/><path d="M4.8 8.2 L7 10.4 L11.2 5.8" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
    case '⏳':
      return '<path d="M4 3.5 h8 v1.5 l-3 3 3 3 v1.5 h-8 v-1.5 l3 -3 -3 -3 Z" fill="#3b82f6" opacity="0.25"/><path d="M4 3.5 h8 v1.5 l-3 3 3 3 v1.5 h-8 v-1.5 l3 -3 -3 -3 Z" fill="none" stroke="#3b82f6" stroke-width="1.4" stroke-linejoin="round"/>';
    case '🚫':
      return '<circle cx="8" cy="8" r="6.5" fill="none" stroke="#ef4444" stroke-width="1.8"/><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke="#ef4444" stroke-width="1.8"/>';
    case '⚠️':
      return '<path d="M8 2.2 L14.5 13.5 H1.5 Z" fill="#f59e0b" opacity="0.25"/><path d="M8 2.2 L14.5 13.5 H1.5 Z" fill="none" stroke="#f59e0b" stroke-width="1.4" stroke-linejoin="round"/><line x1="8" y1="6" x2="8" y2="9.5" stroke="#f59e0b" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.8" r="0.8" fill="#f59e0b"/>';
    case '🚩':
      return '<path d="M3.5 14 V2.5 M3.5 3 H12 L10 6.5 L12 10 H3.5" fill="#ef4444" stroke="#ef4444" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>';
    case '⭐':
      return '<path d="M8 1.5 L9.9 5.4 L14.2 6 L11.1 9 L11.8 13.3 L8 11.3 L4.2 13.3 L4.9 9 L1.8 6 L6.1 5.4 Z" fill="#facc15" stroke="#eab308" stroke-width="1.2" stroke-linejoin="round"/>';
    case '💡':
      return '<path d="M8 2 A4 4 0 0 0 5 8.5 V10.5 H11 V8.5 A4 4 0 0 0 8 2 Z" fill="#eab308" opacity="0.25"/><path d="M8 2 A4 4 0 0 0 5 8.5 V10.5 H11 V8.5 A4 4 0 0 0 8 2 Z" fill="none" stroke="#eab308" stroke-width="1.4"/><line x1="6" y1="12.5" x2="10" y2="12.5" stroke="#eab308" stroke-width="1.4" stroke-linecap="round"/><line x1="7" y1="14" x2="9" y2="14" stroke="#eab308" stroke-width="1.4" stroke-linecap="round"/>';
    case '❓':
      return '<circle cx="8" cy="8" r="6.8" fill="#6366f1" opacity="0.2"/><circle cx="8" cy="8" r="6.8" fill="none" stroke="#6366f1" stroke-width="1.4"/><path d="M6 6 A2 2 0 0 1 9.5 7 C9.5 8.5 8 8.8 8 10" fill="none" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="12" r="0.8" fill="#6366f1"/>';
    default: {
      const color = PRIORITY_COLORS[glyph];
      const digit = PRIORITY_DIGITS[glyph];
      if (color !== undefined && digit !== undefined) {
        return `<rect x="1" y="1" width="14" height="14" rx="3.5" fill="${color}"/><text x="8" y="11.5" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">${digit}</text>`;
      }
      return '';
    }
  }
};

export const markerSvg = (glyph: string, size = 16): string => {
  const inner = markerInnerXml(glyph);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${size}" height="${size}">${inner}</svg>`;
};

const markerSnippet = (glyph: string, x: number, y: number, size: number): string => {
  const inner = markerInnerXml(glyph);
  const scale = size / 16;
  return `<g transform="translate(${x} ${y}) scale(${scale})">${inner}</g>`;
};

type HtmlInline = Extract<Inline, { type: 'html' }>;

export const markerContent: ContentPlugin = {
  name: 'markers',
  transform(content: Inline[]): Inline[] {
    const first = content[0];
    if (first?.type !== 'text') return content;
    const marker = leadingMarker(first.value);
    if (marker === undefined) return content;
    const rest = removeMarker(first.value);
    const markerNode: HtmlInline = {
      type: 'html',
      value: marker.glyph,
    };
    if (rest.length === 0) {
      return [markerNode, ...content.slice(1)];
    }
    const textNode: typeof first = {
      ...first,
      value: rest,
    };
    return [markerNode, textNode, ...content.slice(1)];
  },
  atoms: {
    html: {
      measure(_inline: HtmlInline, style: TextStyle): AtomSize {
        const size = Math.round(style.font.size * 1.05);
        return {
          width: size + Math.round(style.font.size * 0.35),
          height: size,
          baseline: size * 0.85,
        };
      },
      render(inline: HtmlInline, box: Rect): Primitive[] {
        const size = box.height;
        return [
          {
            kind: 'custom',
            svg: () => markerSnippet(inline.value, box.x, box.y, size),
          },
          {
            kind: 'hit',
            action: 'marker',
            rect: {
              x: box.x,
              y: box.y,
              width: size,
              height: size,
            },
          },
        ];
      },
    },
  },
};
