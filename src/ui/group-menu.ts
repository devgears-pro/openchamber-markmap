import { createIcon } from './icons';

export const createGroupMenu = (onCreate: () => void): HTMLElement => {
  const menu = document.createElement('div');
  menu.className = 'mm-group-menu';
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', 'Group');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mm-layout-button';
  button.setAttribute('aria-label', 'Create group');
  button.title = 'Create group';
  button.append(createIcon('group'));
  button.addEventListener('click', onCreate);
  menu.append(button);
  return menu;
};
