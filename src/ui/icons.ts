const ICONS = {
  tree: 'M3 5.75h2a1.25 1.25 0 0 1 1.25 1.25v1.5A1.25 1.25 0 0 1 5 9.75H3a1.25 1.25 0 0 1-1.25-1.25v-1.5A1.25 1.25 0 0 1 3 5.75ZM12.75 2.5h.5a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1h-.5a1 1 0 0 1-1-1v-.5a1 1 0 0 1 1-1ZM12.75 11h.5a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1h-.5a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1ZM6.25 7.75h1.5M7.75 3.75v8.5M7.75 3.75h4M7.75 12.25h4',
  'two-sided':
    'M7 5.75h2a1.25 1.25 0 0 1 1.25 1.25v2A1.25 1.25 0 0 1 9 10.25H7a1.25 1.25 0 0 1-1.25-1.25v-2A1.25 1.25 0 0 1 7 5.75ZM2.75 6.5h.5a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1h-.5a1 1 0 0 1-1-1v-.5a1 1 0 0 1 1-1ZM12.75 6.5h.5a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1h-.5a1 1 0 0 1-1-1v-.5a1 1 0 0 1 1-1ZM4.25 7.75h1.5M10.25 7.75h1.5',
  'org-chart':
    'M7 1.75h2a1.25 1.25 0 0 1 1.25 1.25v.5A1.25 1.25 0 0 1 9 4.75H7a1.25 1.25 0 0 1-1.25-1.25v-.5A1.25 1.25 0 0 1 7 1.75ZM2.5 11.75h.5a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1h-.5a1 1 0 0 1-1-1v-.5a1 1 0 0 1 1-1ZM13 11.75h.5a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1H13a1 1 0 0 1-1-1v-.5a1 1 0 0 1 1-1ZM7.75 4.75v2.5M2.75 7.25h10.5M2.75 7.25v4.5M13.25 7.25v4.5',
  notes: 'M2.75 13.25l1-3.5L10.75 2.75a1.75 1.75 0 0 1 2.5 2.5L6.25 12.25l-3.5 1zM9.5 4l2.5 2.5',
  marker:
    'M8 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11ZM6.25 7.25h.01M9.75 7.25h.01M5.75 9.25c.5 1 1.25 1.5 2.25 1.5s1.75-.5 2.25-1.5',
} as const;

type IconName = keyof typeof ICONS;

export const createIcon = (name: IconName): SVGSVGElement => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
};
