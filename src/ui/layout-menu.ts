import { MARKMAP_LAYOUTS, type MarkmapLayout } from '../markmap/layouts';

const LABELS: Record<MarkmapLayout, string> = {
  tree: 'Tree',
  'two-sided': 'Two-sided',
  'org-chart': 'Org chart',
};

const ICONS: Record<MarkmapLayout, string> = {
  tree: 'M2 8h4M6 8V3h8M6 8v5h8',
  'two-sided': 'M8 8H1M8 8h7M1 8V4M1 8v4M15 8V4M15 8v4',
  'org-chart': 'M8 2v4M8 6H3v7M8 6h5v7',
};

const createIcon = (layout: MarkmapLayout): SVGSVGElement => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[layout]);
  svg.append(path);
  return svg;
};

export const createLayoutMenu = (
  initial: MarkmapLayout,
  onSelect: (layout: MarkmapLayout) => void,
): HTMLElement => {
  const menu = document.createElement('div');
  menu.className = 'mm-layout-menu';
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', 'Layout');
  const buttons = new Map<MarkmapLayout, HTMLButtonElement>();
  const setValue = (value: MarkmapLayout): void => {
    for (const [layout, button] of buttons) {
      button.setAttribute('aria-pressed', String(layout === value));
    }
  };
  for (const layout of MARKMAP_LAYOUTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mm-layout-button';
    button.dataset['layout'] = layout;
    button.setAttribute('aria-label', LABELS[layout]);
    button.title = LABELS[layout];
    button.append(createIcon(layout));
    button.addEventListener('click', () => {
      setValue(layout);
      onSelect(layout);
    });
    buttons.set(layout, button);
    menu.append(button);
  }
  setValue(initial);
  return menu;
};
