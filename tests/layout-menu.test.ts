import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { MarkmapLayout } from '../src/markmap/layouts';
import { createLayoutMenu } from '../src/ui/layout-menu';

const buttonOf = (menu: HTMLElement, layout: MarkmapLayout): HTMLButtonElement => {
  const button = menu.querySelector(`button[data-layout="${layout}"]`);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`No ${layout} button`);
  return button;
};

describe('layout menu', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  test('[R-22] lists the three layouts and marks the active one', () => {
    const menu = createLayoutMenu('two-sided', vi.fn());
    document.body.append(menu);

    expect(menu.getAttribute('role')).toBe('group');
    expect(menu.getAttribute('aria-label')).toBe('Layout');
    expect(
      [...menu.querySelectorAll('button')].map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Tree', 'Two-sided', 'Org chart']);
    expect(buttonOf(menu, 'tree').querySelector('svg')).not.toBeNull();
    expect(buttonOf(menu, 'two-sided').title).toBe('Two-sided');
    expect(buttonOf(menu, 'tree').getAttribute('aria-pressed')).toBe('false');
    expect(buttonOf(menu, 'two-sided').getAttribute('aria-pressed')).toBe('true');
    expect(buttonOf(menu, 'org-chart').getAttribute('aria-pressed')).toBe('false');
  });

  test('[R-27] draws three distinct 16-unit outline icons for the layouts', () => {
    const menu = createLayoutMenu('tree', vi.fn());
    document.body.append(menu);

    const icons = [...menu.querySelectorAll('button svg')];
    expect(icons).toHaveLength(3);
    expect(icons.map((icon) => icon.getAttribute('viewBox'))).toEqual([
      '0 0 16 16',
      '0 0 16 16',
      '0 0 16 16',
    ]);
    const shapes = icons.map((icon) => icon.querySelectorAll('path'));
    expect(shapes.every((paths) => paths.length === 1)).toBe(true);
    const data = shapes.map((paths) => paths[0]?.getAttribute('d') ?? '');
    expect(data.every((path) => path.length > 0)).toBe(true);
    expect(new Set(data).size).toBe(3);
  });

  test('[R-27] draws the layout symbols as one family of curved branch diagrams', () => {
    const onSelect = vi.fn();
    const menu = createLayoutMenu('tree', onSelect);
    document.body.append(menu);

    const buttons = [...menu.querySelectorAll('button')];
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Tree',
      'Two-sided',
      'Org chart',
    ]);

    const icons = buttons.map((button) => button.querySelector('svg'));
    expect(icons.map((icon) => icon?.getAttribute('viewBox'))).toEqual([
      '0 0 16 16',
      '0 0 16 16',
      '0 0 16 16',
    ]);
    expect(icons.map((icon) => icon?.getAttribute('aria-hidden'))).toEqual([
      'true',
      'true',
      'true',
    ]);
    expect(icons.map((icon) => icon?.children.length)).toEqual([1, 1, 1]);

    const shapes = icons.map((icon) => icon?.querySelector('path')?.getAttribute('d') ?? '');
    expect(new Set(shapes).size).toBe(3);
    const commands = shapes.map((shape) => shape.match(/[A-Za-z]/g) ?? []);
    expect(commands).toEqual([
      ['M', 'h', 'c', 'M', 'c'],
      ['M', 'H', 'c', 'M', 'c', 'M', 'h', 'c', 'M', 'c'],
      ['M', 'v', 'c', 'v', 'M', 'c', 'v'],
    ]);

    for (const icon of icons) {
      expect(icon?.hasAttribute('style')).toBe(false);
      expect(icon?.querySelector('path')?.hasAttribute('style')).toBe(false);
    }

    buttonOf(menu, 'two-sided').click();
    buttonOf(menu, 'org-chart').click();
    expect(onSelect.mock.calls).toEqual([['two-sided'], ['org-chart']]);
  });

  test('[R-22] forwards a choice and updates the active button', () => {
    const onSelect = vi.fn();
    const menu = createLayoutMenu('two-sided', onSelect);
    document.body.append(menu);

    buttonOf(menu, 'org-chart').click();

    expect(onSelect).toHaveBeenCalledWith('org-chart');
    expect(buttonOf(menu, 'two-sided').getAttribute('aria-pressed')).toBe('false');
    expect(buttonOf(menu, 'org-chart').getAttribute('aria-pressed')).toBe('true');
  });
});
