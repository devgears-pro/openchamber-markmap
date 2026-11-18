import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createMarkerMenu } from '../src/ui/marker-menu';

const buttonOf = (menu: HTMLElement): HTMLButtonElement => {
  const button = menu.querySelector('button');
  if (!(button instanceof HTMLButtonElement)) throw new Error('No marker button');
  return button;
};

describe('marker menu', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  test('[R-18] opens marker picker popover on click and forwards the chosen glyph', () => {
    const onMarker = vi.fn();
    const menu = createMarkerMenu(onMarker);
    document.body.append(menu);
    const button = buttonOf(menu);

    expect(button.getAttribute('aria-label')).toBe('Add marker');
    expect(button.title).toBe('Marker');

    button.click();

    const popover = document.body.querySelector('.mm-marker-popover');
    expect(popover).toBeTruthy();

    const doneButton = popover?.querySelector<HTMLButtonElement>('button[data-glyph="✅"]');
    expect(doneButton).toBeTruthy();
    doneButton?.click();

    expect(onMarker).toHaveBeenCalledWith('✅');
    expect(document.body.querySelector('.mm-marker-popover')).toBeNull();
  });

  test('[R-18] toggles popover when button is clicked repeatedly', () => {
    const onMarker = vi.fn();
    const menu = createMarkerMenu(onMarker);
    document.body.append(menu);
    const button = buttonOf(menu);

    button.click();
    expect(document.body.querySelector('.mm-marker-popover')).toBeTruthy();

    button.click();
    expect(document.body.querySelector('.mm-marker-popover')).toBeNull();
  });

  test('[R-27] shows an outlined marker icon without changing its accessible name', () => {
    const menu = createMarkerMenu(vi.fn());
    const button = buttonOf(menu);
    const icon = menu.querySelector('svg');

    expect(button.getAttribute('aria-label')).toBe('Add marker');
    expect(icon?.getAttribute('viewBox')).toBe('0 0 16 16');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.querySelectorAll('path')).toHaveLength(1);
    expect(icon?.querySelector('path')?.getAttribute('d')).toBeTruthy();
  });
});
