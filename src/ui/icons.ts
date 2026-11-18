const ICONS = {
  tree: 'M2 8h3c0-4 2-6 9-6M5 8c0 4 2 6 9 6',
  'two-sided': 'M8 8H6c0-4-2-6-4.5-6M6 8c0 4-2 6-4.5 6M8 8h2c0-4 2-6 4.5-6M10 8c0 4 2 6 4.5 6',
  'org-chart': 'M8 2v3c0 2-3 2-5 2v7M8 5c0 2 3 2 5 2v7',
  notes: 'M2.75 13.25l1-3.5L10.75 2.75a1.75 1.75 0 0 1 2.5 2.5L6.25 12.25l-3.5 1zM9.5 4l2.5 2.5',
  marker:
    'M8 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11ZM6.25 7.25h.01M9.75 7.25h.01M5.75 9.25c.5 1 1.25 1.5 2.25 1.5s1.75-.5 2.25-1.5',
  group: 'M2.5 4.5A2 2 0 0 1 4.5 2.5h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7Z',
} as const;

type IconName = keyof typeof ICONS;

export const createIcon = (name: IconName): SVGSVGElement => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  if (name === 'group') path.setAttribute('stroke-dasharray', '2 2');
  svg.append(path);
  return svg;
};
