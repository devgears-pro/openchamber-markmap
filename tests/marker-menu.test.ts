import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createMarkerMenu } from '../src/ui/marker-menu';

const selectOf = (menu: HTMLElement): HTMLSelectElement => {
  const select = menu.querySelector('select');
  if (!(select instanceof HTMLSelectElement)) throw new Error('No marker select');
  return select;
};

describe('marker menu', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  test('[R-18] lists grouped markers and forwards the chosen glyph', () => {
    const onMarker = vi.fn();
    const menu = createMarkerMenu(onMarker);
    document.body.append(menu);
    const select = selectOf(menu);

    expect(select.getAttribute('aria-label')).toBe('Add marker');
    expect(select.title).toBe('Marker');
    expect(select.selectedOptions[0]?.textContent).toBe('🙂');
    expect(select.querySelectorAll('optgroup')).toHaveLength(4);
    select.value = '✅';
    select.dispatchEvent(new Event('change'));

    expect(onMarker).toHaveBeenCalledWith('✅');
    expect(select.value).toBe('');
  });

  test('[R-18] ignores an empty selection', () => {
    const onMarker = vi.fn();
    const menu = createMarkerMenu(onMarker);
    document.body.append(menu);

    selectOf(menu).dispatchEvent(new Event('change'));

    expect(onMarker).not.toHaveBeenCalled();
  });
});
