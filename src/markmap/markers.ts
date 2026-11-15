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
      { glyph: '1️⃣', label: 'High' },
      { glyph: '2️⃣', label: 'Medium' },
      { glyph: '3️⃣', label: 'Low' },
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

export const applyMarker = (label: string, glyph: string): string => {
  let rest = label.trimStart();
  for (const marker of MARKERS) {
    if (rest === marker.glyph) {
      rest = '';
      break;
    }
    if (rest.startsWith(`${marker.glyph} `)) {
      rest = rest.slice(marker.glyph.length).trimStart();
      break;
    }
  }
  return rest.length === 0 ? glyph : `${glyph} ${rest}`;
};
