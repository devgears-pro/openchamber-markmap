import { MARKMAP_LAYOUTS, type MarkmapLayout } from '../markmap/layouts';
import { createIcon } from './icons';

const LABELS: Record<MarkmapLayout, string> = {
  tree: 'Tree',
  'two-sided': 'Two-sided',
  'org-chart': 'Org chart',
};

type LayoutMenu = HTMLDivElement & {
  readonly setLayout: (layout: MarkmapLayout) => void;
};

export const createLayoutMenu = (
  initial: MarkmapLayout,
  onSelect: (layout: MarkmapLayout) => void,
): LayoutMenu => {
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
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    button.addEventListener('click', () => {
      setValue(layout);
      onSelect(layout);
    });
    buttons.set(layout, button);
    menu.append(button);
  }
  setValue(initial);
  return Object.assign(menu, { setLayout: setValue });
};
