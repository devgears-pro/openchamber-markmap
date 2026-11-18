import { createIcon } from './icons';
import { createMarkerPicker, type MarkerPickerInstance } from './marker-picker';

export const createMarkerMenu = (onMarker: (glyph: string) => void): HTMLElement => {
  const menu = document.createElement('div');
  menu.className = 'mm-marker-menu';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mm-marker-toolbar-button';
  button.setAttribute('aria-label', 'Add marker');
  button.title = 'Marker';
  button.append(createIcon('marker'));

  let activePicker: MarkerPickerInstance | null = null;

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (activePicker !== null) {
      activePicker.destroy();
      activePicker = null;
      return;
    }
    const rect = button.getBoundingClientRect();
    activePicker = createMarkerPicker({
      anchor: rect,
      trigger: button,
      onSelect: (glyph) => {
        onMarker(glyph);
      },
      onClose: () => {
        activePicker?.destroy();
        activePicker = null;
      },
    });
    document.body.append(activePicker.element);
  });

  menu.append(button);
  return menu;
};
