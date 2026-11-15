import { MARKER_GROUPS } from '../markmap/markers';

export const createMarkerMenu = (onMarker: (glyph: string) => void): HTMLElement => {
  const menu = document.createElement('div');
  menu.className = 'mm-marker-menu';
  const select = document.createElement('select');
  select.className = 'mm-marker-select';
  select.setAttribute('aria-label', 'Add marker');
  select.title = 'Marker';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '🙂';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.append(placeholder);
  for (const group of MARKER_GROUPS) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.label;
    for (const marker of group.markers) {
      const option = document.createElement('option');
      option.value = marker.glyph;
      option.textContent = `${marker.glyph} ${marker.label}`;
      optgroup.append(option);
    }
    select.append(optgroup);
  }
  select.addEventListener('change', () => {
    if (select.value === '') return;
    onMarker(select.value);
    select.value = '';
  });
  menu.append(select);
  return menu;
};
