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
