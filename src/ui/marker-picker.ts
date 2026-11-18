import { MARKER_GROUPS, markerSvg } from '../markmap/markers';

type MarkerAnchorRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly right: number;
  readonly bottom: number;
};

type MarkerPickerOptions = {
  readonly anchor: MarkerAnchorRect;
  readonly onSelect: (glyph: string) => void;
  readonly onClose: () => void;
};

export type MarkerPickerInstance = {
  readonly element: HTMLElement;
  destroy: () => void;
};

export const createMarkerPicker = (options: MarkerPickerOptions): MarkerPickerInstance => {
  const container = document.createElement('div');
  container.className = 'mm-marker-popover';
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-label', 'Markers');

  const groupsContainer = document.createElement('div');
  groupsContainer.className = 'mm-marker-groups';

  for (const group of MARKER_GROUPS) {
    const category = document.createElement('div');
    category.className = 'mm-marker-category';

    const label = document.createElement('div');
    label.className = 'mm-marker-category-label';
    label.textContent = group.label;
    category.append(label);

    const grid = document.createElement('div');
    grid.className = 'mm-marker-grid';

    for (const marker of group.markers) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mm-marker-button';
      button.dataset['glyph'] = marker.glyph;
      button.setAttribute('aria-label', marker.label);
      button.title = marker.label;
      button.innerHTML = markerSvg(marker.glyph, 18);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        options.onSelect(marker.glyph);
        options.onClose();
      });
      grid.append(button);
    }
    category.append(grid);
    groupsContainer.append(category);
  }
  container.append(groupsContainer);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'mm-marker-remove-button';
  removeButton.setAttribute('aria-label', 'Remove marker');
  removeButton.textContent = 'Remove marker';
  removeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    options.onSelect('');
    options.onClose();
  });
  container.append(removeButton);

  const left = Math.max(8, options.anchor.left);
  const top = Math.max(8, options.anchor.bottom + 4);
  container.style.left = `${left}px`;
  container.style.top = `${top}px`;

  const handlePointerDown = (event: Event): void => {
    const target = event.target;
    if (target instanceof Node && !container.contains(target)) {
      options.onClose();
    }
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      options.onClose();
    }
  };

  window.addEventListener('pointerdown', handlePointerDown, true);
  window.addEventListener('keydown', handleKeyDown, true);

  const destroy = (): void => {
    window.removeEventListener('pointerdown', handlePointerDown, true);
    window.removeEventListener('keydown', handleKeyDown, true);
    container.remove();
  };

  return {
    element: container,
    destroy,
  };
};
