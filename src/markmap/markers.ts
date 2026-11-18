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
    label: 'Tag',
    markers: [
      {
        glyph: '🔴',
        label: 'Red',
      },
      {
        glyph: '🟠',
        label: 'Orange',
      },
      {
        glyph: '🟡',
        label: 'Yellow',
      },
      {
        glyph: '🟢',
        label: 'Green',
      },
      {
        glyph: '🔵',
        label: 'Blue',
      },
      {
        glyph: '🟣',
        label: 'Purple',
      },
      {
        glyph: '⚪',
        label: 'Gray',
      },
    ],
  },
  {
    label: 'Priority',
    markers: [
      {
        glyph: '1️⃣',
        label: '1',
      },
      {
        glyph: '2️⃣',
        label: '2',
      },
      {
        glyph: '3️⃣',
        label: '3',
      },
      {
        glyph: '4️⃣',
        label: '4',
      },
      {
        glyph: '5️⃣',
        label: '5',
      },
      {
        glyph: '6️⃣',
        label: '6',
      },
      {
        glyph: '7️⃣',
        label: '7',
      },
    ],
  },
  {
    label: 'Task',
    markers: [
      {
        glyph: '○',
        label: 'Start',
      },
      {
        glyph: '◔',
        label: '1/8',
      },
      {
        glyph: '◑',
        label: '3/8',
      },
      {
        glyph: '◐',
        label: 'Half',
      },
      {
        glyph: '◕',
        label: '5/8',
      },
      {
        glyph: '◓',
        label: '7/8',
      },
      {
        glyph: '✅',
        label: 'Done',
      },
    ],
  },
  {
    label: 'Flag',
    markers: [
      {
        glyph: '🚩',
        label: 'Red',
      },
      {
        glyph: '🟧',
        label: 'Orange',
      },
      {
        glyph: '🟨',
        label: 'Yellow',
      },
      {
        glyph: '🟩',
        label: 'Green',
      },
      {
        glyph: '🟦',
        label: 'Blue',
      },
      {
        glyph: '🟪',
        label: 'Purple',
      },
      {
        glyph: '⬜',
        label: 'Gray',
      },
    ],
  },
  {
    label: 'Star',
    markers: [
      {
        glyph: '⭐🔴',
        label: 'Red',
      },
      {
        glyph: '⭐🟠',
        label: 'Orange',
      },
      {
        glyph: '⭐',
        label: 'Yellow',
      },
      {
        glyph: '⭐🟢',
        label: 'Green',
      },
      {
        glyph: '⭐🔵',
        label: 'Blue',
      },
      {
        glyph: '⭐🟣',
        label: 'Purple',
      },
      {
        glyph: '⭐⚪',
        label: 'Gray',
      },
    ],
  },
  {
    label: 'People',
    markers: [
      {
        glyph: '👤🔴',
        label: 'Red',
      },
      {
        glyph: '👤🟠',
        label: 'Orange',
      },
      {
        glyph: '👤🟡',
        label: 'Yellow',
      },
      {
        glyph: '👤🟢',
        label: 'Green',
      },
      {
        glyph: '👤',
        label: 'Blue',
      },
      {
        glyph: '👤🟣',
        label: 'Purple',
      },
      {
        glyph: '👤⚪',
        label: 'Gray',
      },
    ],
  },
  {
    label: 'Symbol',
    markers: [
      {
        glyph: '❤️',
        label: 'Heart',
      },
      {
        glyph: '👍',
        label: 'Like',
      },
      {
        glyph: '👎',
        label: 'Dislike',
      },
      {
        glyph: '📌',
        label: 'Pin',
      },
      {
        glyph: '💡',
        label: 'Idea',
      },
      {
        glyph: '⚡',
        label: 'Lightning',
      },
      {
        glyph: '⏳',
        label: 'Hourglass',
      },
      {
        glyph: '📞',
        label: 'Telephone',
      },
      {
        glyph: '✏️',
        label: 'Pen',
      },
      {
        glyph: '🎵',
        label: 'Music',
      },
      {
        glyph: '🎮',
        label: 'Game',
      },
      {
        glyph: '💯',
        label: '100',
      },
      {
        glyph: '✈️',
        label: 'Flight',
      },
      {
        glyph: '🏃',
        label: 'Run',
      },
      {
        glyph: '❗',
        label: 'Exclamation',
      },
      {
        glyph: '❓',
        label: 'Question',
      },
    ],
  },
];

const MARKERS: readonly NodeMarker[] = [
  ...MARKER_GROUPS.flatMap((group) => group.markers),
  { glyph: '⭐🟡', label: 'Yellow' },
  { glyph: '👤🔵', label: 'Blue' },
  { glyph: '●', label: 'Done' },
  { glyph: '⚠️', label: 'Warning' },
  { glyph: '🚫', label: 'Dislike' },
];

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

const C = {
  red: '#f04438',
  orange: '#fb6514',
  yellow: '#eab308',
  green: '#12b76a',
  blue: '#2e90fa',
  purple: '#7a5af8',
  gray: '#667085',
};

const circle = (color: string): string => `<circle cx="12" cy="12" r="12" fill="${color}"/>`;

const FLAG_PATH =
  '<path d="M7 4.5a.75.75 0 0 1 .75-.75h6.5c.8 0 1.3.5 1.9.9.5.3 1 .6 1.6.6a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-.75.75c-.8 0-1.3-.5-1.9-.9-.5-.3-1-.6-1.6-.6H8.5v6.25a.75.75 0 1 1-1.5 0V4.5z" fill="#fff"/>';
const STAR_PATH =
  '<path d="M12 4.2l1.9 4.8 5.1.4-3.9 3.4 1.2 5-4.3-2.7-4.3 2.7 1.2-5-3.9-3.4 5.1-.4L12 4.2z" fill="#fff"/>';
const PEOPLE_PATH =
  '<circle cx="12" cy="7.8" r="3.3" fill="#fff"/><path d="M12 13c-3.6 0-6.6 1.9-7.2 4.6a1 1 0 0 0 .9 1.2h12.6a1 1 0 0 0 .9-1.2c-.6-2.7-3.6-4.6-7.2-4.6z" fill="#fff"/>';

const P1 = '<path d="M13.8 5v14h-3.4V7.8h-1.4V5h4.8z" fill="#fff"/>';
const P2 =
  '<path d="M11.2 12.4C12.7 11 13.4 9.9 13.4 9.1c0-.8-.5-1.5-1.6-1.5-.9 0-1.5.4-2 1.1L7.5 7.2c.8-.9 2-1.6 3.8-1.6 2.4 0 4.1 1.4 4.1 3.5 0 1.4-.8 2.8-2 4.1-1.2 1.3-2.4 2.4-3.8 3.5h6.4V19H6.6v-2.9c1.6-1.1 3.2-2.4 4.6-3.7z" fill="#fff"/>';
const P3 =
  '<path fill-rule="evenodd" clip-rule="evenodd" d="M9.7 19.1c-.7-.2-1.3-.6-1.9-1-.5-.5-.9-1-1.2-1.6l2-2c.4.6.9 1.1 1.5 1.5.5.3 1.1.5 1.7.5.7 0 1.3-.2 1.7-.5.4-.4.6-.9.6-1.6 0-.7-.4-1.2-1-1.6-.7-.4-1.6-.6-2.7-.6h-1v-1.6l3.3-3.1H7.3V4.5h9.7v3.2l-3.1 2.6c.7.1 1.4.2 1.9.6.5.4.9.9 1.2 1.5.3.6.5 1.4.5 2.3 0 1-.2 1.9-.7 2.6-.4.7-1 1.3-1.8 1.6-.9.4-1.9.6-3 .6-.8 0-1.6-.1-2.3-.4z" fill="#fff"/>';
const P4 =
  '<path d="M12 9.6c-.5.5-.9 1.1-1.2 1.6l-.3.5h1.5V9.6zm-6 6.4v-3.1c.2-.3.5-.8.9-1.4.4-.6.7-1.2 1-1.6.3-.5.7-1 1.1-1.6.8-1.2 1.5-2.1 2.1-2.8.5-.8.8-1.1.8-1h3.4v8.5h1.7v3h-1.7v3.5h-3.4v-3.5H6z" fill="#fff"/>';
const P5 =
  '<path d="M9 19c-.6-.3-1-.6-1.2-.8-.2-.2-.3-.4-.3-.4l1.4-2.3c.3.3.7.5 1.1.7.5.2.9.4 1.3.4.4 0 .7-.1 1-.3.3-.2.6-.4.8-.7.1-.3.2-.6.2-1 0-.6-.1-1-.4-1.5-.3-.4-.7-.7-1.2-.7h-.5c-.7 0-1.3.3-1.7.9l-.6-.02L8 4.5h7.8v2.9h-4.6l-.3 2.5c.2-.1.4-.2.7-.3.2-.1.5-.1.8-.2.1 0 .3 0 .3 0 .8 0 1.5.3 2.1.8.6.5 1.1 1.1 1.4 1.9.3.7.5 1.6.5 2.6s-.2 1.8-.6 2.6c-.4.8-1 1.4-1.7 1.8-.8.4-1.6.6-2.6.6-1.1 0-2-.2-2.6-.7z" fill="#fff"/>';
const P6 =
  '<path d="M12.8 16.2c.3-.2.5-.4.7-.7.2-.3.2-.6.2-1 0-.6-.1-1.1-.4-1.5-.2-.4-.6-.6-1.2-.6-.3 0-.6.1-.9.4-.2.2-.4.5-.6.9 0 .1 0 .3 0 .6 0 .1 0 .2 0 .3 0 .4.1.7.3.9.1.3.3.5.5.7.2.1.5.2.8.2.3.1.6 0 .6-.2zm2-5.6c.7.3 1.2.9 1.6 1.6.4.7.6 1.5.6 2.4 0 1-.2 1.8-.6 2.5-.5.7-1.1 1.3-1.9 1.7-.7.4-1.5.6-2.5.6-1 0-1.8-.2-2.6-.6-.7-.3-1.3-.9-1.7-1.6-.4-.6-.6-1.4-.6-2.3 0-.2 0-.3 0-.4 0-.4.1-.8.2-1.1.1-.3.3-.7.5-1L11.2 4.5h3.5L12.3 10h.1c.9 0 1.7.2 2.4.6z" fill="#fff"/>';
const P7 =
  '<path d="M9.3 15.8c.4-1.2.8-2.5 1.4-4 .2-.3.4-1 .8-1.8.5-1.3.9-2.1 1-2.5H7.5V4.5h10c-.9 1.8-1.5 3.2-2 4.4-.6 1.2-1.2 2.9-2 5-.3.8-.6 1.7-.9 2.8-.3 1-.6 1.9-.8 2.8H8.2c.3-1.4.7-2.6 1.1-3.7z" fill="#fff"/>';

const S_HEART =
  '<path d="M12 19.2c-.2 0-.4-.1-.6-.2-4-3.4-6.4-5.8-6.4-8.6 0-2.3 1.8-4.2 4.2-4.2 1.4 0 2.7.7 2.8 1.8.1-1.1 1.4-1.8 2.8-1.8 2.4 0 4.2 1.9 4.2 4.2 0 2.8-2.4 5.2-6.4 8.6-.2.1-.4.2-.6.2z" fill="#fff"/>';
const S_LIKE =
  '<path d="M8.5 10v7.5H5.8a.8.8 0 0 1-.8-.8v-5.9a.8.8 0 0 1 .8-.8h2.7zm2 7.5h5a1.8 1.8 0 0 0 1.8-1.4l1.1-4.8a1.8 1.8 0 0 0-1.8-2.1H14V6.2a1.8 1.8 0 0 0-1.8-1.7l-1 2.8-1.7 2.7v7.5z" fill="#fff"/>';
const S_DISLIKE =
  '<path d="M8.5 14V6.5H5.8a.8.8 0 0 0-.8.8v5.9c0 .4.4.8.8.8h2.7zm2-7.5h5a1.8 1.8 0 0 1 1.8 1.4l1.1 4.8a1.8 1.8 0 0 1-1.8 2.1H14v2.9a1.8 1.8 0 0 1-1.8 1.8l-1-2.9-1.7-2.6V6.5z" fill="#fff"/>';
const S_PIN =
  '<path d="M18.8 8.2l-3-3a1 1 0 0 0-1.4 0l-1.1 1.1a1 1 0 0 0-.2.5l-.2 1.8-3.4 3.4-2.1-.5a1 1 0 0 0-.9.3l-.7.7a.8.8 0 0 0 0 1.1l3.5 3.5-3.8 3.8a.5.5 0 0 0 .7.7l3.8-3.8 3.5 3.5a.8.8 0 0 0 1.1 0l.7-.7a1 1 0 0 0 .3-.9l-.5-2.1 3.4-3.4 1.8-.2a1 1 0 0 0 .5-.2l1.1-1.1a1 1 0 0 0 0-1.5z" fill="#fff"/>';
const S_IDEA =
  '<path d="M12 4a5.3 5.3 0 0 0-3.4 9.4c.6.5.9 1.3 1 2.1h4.8c.1-.8.4-1.6 1-2.1A5.3 5.3 0 0 0 12 4zm-1.8 12.5h3.6v.8a.9.9 0 0 1-.9.9h-1.8a.9.9 0 0 1-.9-.9v-.8z" fill="#fff"/>';
const S_LIGHTNING = '<path d="M12.8 3.8L6.4 12.2h4.5l-1.7 8 6.9-9.8h-4.6l1.9-6.6z" fill="#fff"/>';
const S_HOURGLASS =
  '<path d="M7 4.5h10v2a4 4 0 0 1-3 3.9v3.2a4 4 0 0 1 3 3.9v2H7v-2a4 4 0 0 1 3-3.9v-3.2A4 4 0 0 1 7 6.5v-2zm2.5 2a2 2 0 0 0 1.8 2h1.4a2 2 0 0 0 1.8-2H9.5zm5 11a2 2 0 0 0-1.8-2h-1.4a2 2 0 0 0-1.8 2h5z" fill="#fff"/>';
const S_TELEPHONE =
  '<path d="M6.2 5.2a2.2 2.2 0 0 1 3.1 0l1.2 1.2a2.2 2.2 0 0 1 0 3.1l-.7.7c.5 1.1 1.2 2.1 2.2 3.1 1 1 2 1.7 3.1 2.2l.7-.7a2.2 2.2 0 0 1 3.1 0l1.2 1.2a2.2 2.2 0 0 1 0 3.1l-1 1c-1 .9-2.3 1.4-3.6 1.1-2.7-.5-5.3-2-7.4-4.1S4.5 12.5 4 9.8c-.3-1.3.2-2.6 1.1-3.6l1.1-1z" fill="#fff"/>';
const S_PEN =
  '<path d="M14.8 5.2a1.5 1.5 0 0 1 2.1 0l1.9 1.9a1.5 1.5 0 0 1 0 2.1L9.6 18.4l-4.5 1.1 1.1-4.5L14.8 5.2zm.7 2.1l-7.7 7.7-.4 1.8 1.8-.4 7.7-7.7-1.4-1.4z" fill="#fff"/>';
const S_MUSIC =
  '<ellipse cx="8.5" cy="16.5" rx="3.3" ry="2.3" transform="rotate(-22 8.5 16.5)" fill="#fff"/><rect x="10.8" y="4" width="1.8" height="13" rx="0.4" fill="#fff"/><path d="M12.6 4c2.8 0 5 1.5 5.4 4.5.3 2.5-.8 4.2-2.2 5.5-.3.3-.8.2-.8-.2.2-1.5.5-3.2-.6-4.5-1-1.2-2-1.8-3.8-2V4z" fill="#fff"/>';
const S_ENTERTAINMENT =
  '<path fill-rule="evenodd" clip-rule="evenodd" d="M7 6h10c2.2 0 4 1.8 4 4 0 .5-.1 1-.3 1.5l-1.4 4.8c-.4 1.4-1.8 2.2-3.1 1.7-.8-.3-1.5-.9-1.9-1.8L13.5 14h-3l-.8 2.2c-.4.9-1.1 1.5-1.9 1.8-1.3.5-2.7-.3-3.1-1.7L3.3 11.5c-.2-.5-.3-1-.3-1.5 0-2.2 1.8-4 4-4zm1.5 3.8H7.2v1.5H5.7v1.4h1.5v1.5h1.3v-1.5H10v-1.4H8.5V9.8zm7.5.4a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm2 2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" fill="#fff"/>';
const S_100 =
  '<path d="M6.8 6.5c.3 0 .5.2.5.5v8.5a.6.6 0 0 1-1.2 0V8.2L5 8.9a.6.6 0 0 1-.5-.9l1.8-1.4c.2-.1.3-.1.5-.1zm4.4 0c1.8 0 3 1.9 3 4.5s-1.2 4.5-3 4.5-3-1.9-3-4.5 1.2-4.5 3-4.5zm0 1.3c-1.1 0-1.8 1.4-1.8 3.2s.7 3.2 1.8 3.2 1.8-1.4 1.8-3.2-.7-3.2-1.8-3.2zm6 -1.3c1.8 0 3 1.9 3 4.5s-1.2 4.5-3 4.5-3-1.9-3-4.5 1.2-4.5 3-4.5zm0 1.3c-1.1 0-1.8 1.4-1.8 3.2s.7 3.2 1.8 3.2 1.8-1.4 1.8-3.2-.7-3.2-1.8-3.2zM4.5 18a.6.6 0 0 1 .6-.6h13.8a.6.6 0 1 1 0 1.2H5.1a.6.6 0 0 1-.6-.6zm1.2 2a.6.6 0 0 1 .6-.6h11.4a.6.6 0 1 1 0 1.2H6.3a.6.6 0 0 1-.6-.6z" fill="#fff"/>';
const S_FLIGHT =
  '<path d="M12 3.8a.9.9 0 0 0-.9.9v4.6L4.5 13v2l6.6-1.8v3.4L9.3 18v1.5l2.7-.7 2.7.7V18l-1.8-1.4v-3.4l6.6 1.8v-2L12.9 9.3V4.7a.9.9 0 0 0-.9-.9z" fill="#fff"/>';
const S_RUN =
  '<circle cx="16.8" cy="5.8" r="2.2" fill="#fff"/><path d="M13.6 8.5l-3 4.2 3.8 3.5-.6 3.4M10.6 12.7L7.8 15l-3.2.8M13.6 9.8l3 1.5 2.8-.8M13.6 9.8l-3.5-1.2-2.5 1.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';
const S_EXCLAM =
  '<circle cx="12" cy="18" r="1.6" fill="#fff"/><path d="M10.5 5.2c0-.7.6-1.2 1.3-1.2h.4c.7 0 1.3.5 1.3 1.2l-.3 8.6c0 .6-.5 1-1.1 1h-.6c-.6 0-1.1-.4-1.1-1l-.4-8.6z" fill="#fff"/>';
const S_QUESTION =
  '<circle cx="12" cy="18" r="1.6" fill="#fff"/><path d="M12 4.5c2.6 0 4.6 1.7 4.6 4.1 0 1.6-.9 2.8-2.4 3.8-.8.5-1.3 1.1-1.3 2v.8h-2.8v-.9c0-1.5.8-2.5 2-3.4.9-.7 1.6-1.3 1.6-2.1 0-1-.8-1.7-1.8-1.7-1 0-1.8.6-2 1.8H7.5C7.8 6.4 9.6 4.5 12 4.5z" fill="#fff"/>';

const GLYPH_SNIPPETS: Record<string, string> = {
  '🔴': circle(C.red),
  '🟠': circle(C.orange),
  '🟡': circle(C.yellow),
  '🟢': circle(C.green),
  '🔵': circle(C.blue),
  '🟣': circle(C.purple),
  '⚪': circle(C.gray),

  '1️⃣': `${circle(C.red)} ${P1}`,
  '2️⃣': `${circle(C.orange)} ${P2}`,
  '3️⃣': `${circle(C.yellow)} ${P3}`,
  '4️⃣': `${circle(C.green)} ${P4}`,
  '5️⃣': `${circle(C.blue)} ${P5}`,
  '6️⃣': `${circle(C.purple)} ${P6}`,
  '7️⃣': `${circle(C.gray)} ${P7}`,

  '○': '<circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#12b76a" stroke-width="2"/> <path d="M9.2 6.7L17.5 11.8C17.7 11.9 17.7 12.1 17.5 12.2L9.2 17.3C9 17.4 8.8 17.3 8.8 17.1V6.9C8.8 6.7 9 6.6 9.2 6.7Z" fill="#12b76a"/>',
  '◔': '<circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#12b76a" stroke-width="2"/> <path d="M12 12V1.5C15.5 1.5 18.7 3.3 20.7 6.1L12 12Z" fill="#12b76a"/>',
  '◑': '<circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#12b76a" stroke-width="2"/> <path d="M12 12V1.5C17.8 1.5 22.5 6.2 22.5 12C22.5 14.3 21.8 16.4 20.7 18.1L12 12Z" fill="#12b76a"/>',
  '◐': '<circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#12b76a" stroke-width="2"/> <path d="M12 1.5C17.8 1.5 22.5 6.2 22.5 12C22.5 17.8 17.8 22.5 12 22.5V1.5Z" fill="#12b76a"/>',
  '◕': '<circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#12b76a" stroke-width="2"/> <path d="M12 12V1.5C17.8 1.5 22.5 6.2 22.5 12C22.5 17.8 17.8 22.5 12 22.5C9.2 22.5 6.5 21.6 4.4 19.6L12 12Z" fill="#12b76a"/>',
  '◓': '<circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#12b76a" stroke-width="2"/> <path d="M12 12V1.5C17.8 1.5 22.5 6.2 22.5 12C22.5 17.8 17.8 22.5 12 22.5C6.2 22.5 1.5 17.8 1.5 12C1.5 9.6 2.3 7.2 3.7 5.3L12 12Z" fill="#12b76a"/>',
  '✅': '<circle cx="12" cy="12" r="12" fill="#12b76a"/> <path d="M7.3 13.1L10.7 16.4L16.6 7.3" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  '●': '<circle cx="12" cy="12" r="12" fill="#12b76a"/> <path d="M7.3 13.1L10.7 16.4L16.6 7.3" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',

  '🚩': `${circle(C.red)} ${FLAG_PATH}`,
  '🟧': `${circle(C.orange)} ${FLAG_PATH}`,
  '🟨': `${circle(C.yellow)} ${FLAG_PATH}`,
  '🟩': `${circle(C.green)} ${FLAG_PATH}`,
  '🟦': `${circle(C.blue)} ${FLAG_PATH}`,
  '🟪': `${circle(C.purple)} ${FLAG_PATH}`,
  '⬜': `${circle(C.gray)} ${FLAG_PATH}`,

  '⭐🔴': `${circle(C.red)} ${STAR_PATH}`,
  '⭐🟠': `${circle(C.orange)} ${STAR_PATH}`,
  '⭐': `${circle(C.yellow)} ${STAR_PATH}`,
  '⭐🟡': `${circle(C.yellow)} ${STAR_PATH}`,
  '⭐🟢': `${circle(C.green)} ${STAR_PATH}`,
  '⭐🔵': `${circle(C.blue)} ${STAR_PATH}`,
  '⭐🟣': `${circle(C.purple)} ${STAR_PATH}`,
  '⭐⚪': `${circle(C.gray)} ${STAR_PATH}`,

  '👤🔴': `${circle(C.red)} ${PEOPLE_PATH}`,
  '👤🟠': `${circle(C.orange)} ${PEOPLE_PATH}`,
  '👤🟡': `${circle(C.yellow)} ${PEOPLE_PATH}`,
  '👤🟢': `${circle(C.green)} ${PEOPLE_PATH}`,
  '👤': `${circle(C.blue)} ${PEOPLE_PATH}`,
  '👤🔵': `${circle(C.blue)} ${PEOPLE_PATH}`,
  '👤🟣': `${circle(C.purple)} ${PEOPLE_PATH}`,
  '👤⚪': `${circle(C.gray)} ${PEOPLE_PATH}`,

  '❤️': `${circle(C.red)} ${S_HEART}`,
  '👍': `${circle(C.red)} ${S_LIKE}`,
  '👎': `${circle(C.blue)} ${S_DISLIKE}`,
  '📌': `${circle(C.red)} ${S_PIN}`,
  '💡': `${circle(C.yellow)} ${S_IDEA}`,
  '⚡': `${circle(C.blue)} ${S_LIGHTNING}`,
  '⏳': `${circle(C.orange)} ${S_HOURGLASS}`,
  '📞': `${circle(C.green)} ${S_TELEPHONE}`,
  '✏️': `${circle(C.orange)} ${S_PEN}`,
  '🎵': `${circle(C.purple)} ${S_MUSIC}`,
  '🎮': `${circle(C.yellow)} ${S_ENTERTAINMENT}`,
  '💯': `${circle(C.red)} ${S_100}`,
  '✈️': `${circle(C.blue)} ${S_FLIGHT}`,
  '🏃': `${circle(C.green)} ${S_RUN}`,
  '❗': `${circle(C.red)} ${S_EXCLAM}`,
  '⚠️': `${circle(C.red)} ${S_EXCLAM}`,
  '❓': `${circle(C.blue)} ${S_QUESTION}`,
  '🚫': `${circle(C.blue)} ${S_DISLIKE}`,
};

const markerInnerXml = (glyph: string): string => GLYPH_SNIPPETS[glyph] ?? '';

export const markerSvg = (glyph: string, size = 16): string => {
  const inner = markerInnerXml(glyph);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">${inner}</svg>`;
};

const markerSnippet = (glyph: string, x: number, y: number, size: number): string => {
  const inner = markerInnerXml(glyph);
  const scale = size / 24;
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
        const size = Math.round(style.font.size * 1.1);
        return {
          width: size + Math.round(style.font.size * 0.3),
          height: size,
          baseline: size * 0.8,
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
