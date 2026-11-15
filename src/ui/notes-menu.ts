import { createIcon } from './icons';

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
  button.append(createIcon('notes'));
  button.addEventListener('click', onEdit);
  menu.append(button);
  return menu;
};
