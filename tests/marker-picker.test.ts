import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createMarkerPicker } from '../src/ui/marker-picker';

describe('marker picker', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  test('[R-18] renders categorized vector marker buttons and a remove action', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const anchor = { left: 100, top: 100, width: 20, height: 20, right: 120, bottom: 120 };
    const picker = createMarkerPicker({ anchor, onSelect, onClose });
    document.body.append(picker.element);

    const categories = picker.element.querySelectorAll('.mm-marker-category');
    expect(categories.length).toBe(4);

    const buttons = picker.element.querySelectorAll<HTMLButtonElement>('.mm-marker-button');
    expect(buttons.length).toBeGreaterThanOrEqual(18);

    const firstSvg = buttons[0]?.querySelector('svg');
    expect(firstSvg).toBeTruthy();

    const removeButton = picker.element.querySelector('.mm-marker-remove-button');
    expect(removeButton).toBeTruthy();
    expect(removeButton?.textContent).toBe('Remove marker');

    picker.destroy();
  });

  test('[R-18] chooses a marker on button click and notifies listeners', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const anchor = { left: 50, top: 50, width: 16, height: 16, right: 66, bottom: 66 };
    const picker = createMarkerPicker({ anchor, onSelect, onClose });
    document.body.append(picker.element);

    const doneButton = picker.element.querySelector<HTMLButtonElement>('button[data-glyph="✅"]');
    expect(doneButton).toBeTruthy();
    doneButton?.click();

    expect(onSelect).toHaveBeenCalledWith('✅');
    expect(onClose).toHaveBeenCalled();

    picker.destroy();
  });

  test('[R-18] removes the marker on remove button click', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const anchor = { left: 50, top: 50, width: 16, height: 16, right: 66, bottom: 66 };
    const picker = createMarkerPicker({ anchor, onSelect, onClose });
    document.body.append(picker.element);

    const removeButton = picker.element.querySelector<HTMLButtonElement>(
      '.mm-marker-remove-button',
    );
    removeButton?.click();

    expect(onSelect).toHaveBeenCalledWith('');
    expect(onClose).toHaveBeenCalled();

    picker.destroy();
  });

  test('[R-18] closes on Escape key', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const anchor = { left: 50, top: 50, width: 16, height: 16, right: 66, bottom: 66 };
    const picker = createMarkerPicker({ anchor, onSelect, onClose });
    document.body.append(picker.element);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    picker.destroy();
  });

  test('[R-18] ignores non-Escape keys', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const anchor = { left: 50, top: 50, width: 16, height: 16, right: 66, bottom: 66 };
    const picker = createMarkerPicker({ anchor, onSelect, onClose });
    document.body.append(picker.element);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    picker.destroy();
  });

  test('[R-18] closes on outside pointer down', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const anchor = { left: 50, top: 50, width: 16, height: 16, right: 66, bottom: 66 };
    const picker = createMarkerPicker({ anchor, onSelect, onClose });
    document.body.append(picker.element);

    const outside = document.createElement('div');
    document.body.append(outside);
    outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    picker.destroy();
  });

  test('[R-18] ignores non-Escape keys', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const anchor = { left: 50, top: 50, width: 16, height: 16, right: 66, bottom: 66 };
    const picker = createMarkerPicker({ anchor, onSelect, onClose });
    document.body.append(picker.element);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    picker.destroy();
  });

  test('[R-18] ignores pointer down on window or non-node target', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const anchor = { left: 50, top: 50, width: 16, height: 16, right: 66, bottom: 66 };
    const picker = createMarkerPicker({ anchor, onSelect, onClose });
    document.body.append(picker.element);

    window.dispatchEvent(new Event('pointerdown'));
    expect(onClose).not.toHaveBeenCalled();

    picker.destroy();
  });
});
