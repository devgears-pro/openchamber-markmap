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
    expect(select.selectedOptions[0]?.textContent).toBe('');
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

  test('[R-27] shows an outlined marker icon without changing its accessible name', () => {
    const menu = createMarkerMenu(vi.fn());
    const select = selectOf(menu);
    const icon = menu.querySelector('svg');

    expect(select.getAttribute('aria-label')).toBe('Add marker');
    expect(icon?.getAttribute('viewBox')).toBe('0 0 16 16');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.querySelectorAll('path')).toHaveLength(1);
    expect(icon?.querySelector('path')?.getAttribute('d')).toBeTruthy();
  });
});
