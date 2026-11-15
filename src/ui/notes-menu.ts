const ICON = 'M4 2h5l3 3v9H4zM9 2v3h3M6 8h4M6 11h4';

const createIcon = (): SVGSVGElement => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICON);
  svg.append(path);
  return svg;
};

export const createNotesMenu = (onEdit: () => void): HTMLElement => {
  const menu = document.createElement('div');
  menu.className = 'mm-notes-menu';
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', 'Notes');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mm-layout-button';
  button.setAttribute('aria-label', 'Edit notes');
  button.title = 'Edit notes';
  button.append(createIcon());
  button.addEventListener('click', onEdit);
  menu.append(button);
  return menu;
};
