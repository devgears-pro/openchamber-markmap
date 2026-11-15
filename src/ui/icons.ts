const ICONS = {
  tree: 'M3 10h5m0 0V5m0 5v5m0-5h5m0 0V7m0 3v3',
  'two-sided': 'M10 10H4m6 0h6M4 10V6m0 4v4m12-4V6m0 4v4',
  'org-chart': 'M10 3v4M10 7H4m6 0h6M4 7v6m6-6v6m6-6v6',
  notes: 'M4 3.5h9l3 3v3.2M13 3.5v3h3M4 3.5v13h6m6.5-6.5 2 2-5.8 5.8-3 .5.6-3 5.7-5.8Z',
  marker:
    'M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM7 8h.01M13 8h.01M6.8 11.2c.7 1.1 1.8 1.7 3.2 1.7s2.5-.6 3.2-1.7',
} as const;

type IconName = keyof typeof ICONS;

export const createIcon = (name: IconName): SVGSVGElement => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
};
