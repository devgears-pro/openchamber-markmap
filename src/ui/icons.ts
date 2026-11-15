const ICONS = {
  tree: 'M2.5 6.1h1.8a1 1 0 0 1 1 1v1.8a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V7.1a1 1 0 0 1 1-1ZM12.5 2.3h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1ZM12.5 10.7h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1ZM5.3 8h2.3M7.6 3.8v8.4M7.6 3.8h3.9M7.6 12.2h3.9',
  'two-sided':
    'M7.1 6.1h1.8a1 1 0 0 1 1 1v1.8a1 1 0 0 1-1 1H7.1a1 1 0 0 1-1-1V7.1a1 1 0 0 1 1-1ZM2.4 6.5h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1ZM12.6 6.5h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1ZM4.4 8h1.7M9.9 8h1.7',
  'org-chart':
    'M7.1 1.95h1.8a1 1 0 0 1 1 1v1.8a1 1 0 0 1-1 1H7.1a1 1 0 0 1-1-1V2.95a1 1 0 0 1 1-1ZM2.5 11.05h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1ZM12.5 11.05h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1ZM8 5.75v1.5M3 7.25h10M3 7.25v3.8M13 7.25v3.8',
  notes: 'M3 13l1-3.4L11 2.6a1.7 1.7 0 0 1 2.4 2.4L6.4 12 3 13zM9.9 3.7l2.4 2.4',
  marker:
    'M8 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11ZM6 7h.01M10 7h.01M5.4 9.2c.6 1.1 1.5 1.7 2.6 1.7s2-.6 2.6-1.7',
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
