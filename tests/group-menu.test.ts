import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createGroupMenu } from '../src/ui/group-menu';

describe('group menu', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  test('[R-36] offers a labelled Create group control', () => {
    const menu = createGroupMenu(vi.fn());
    document.body.append(menu);
    const button = menu.querySelector('button');
    if (!(button instanceof HTMLButtonElement)) throw new Error('No group button');

    expect(menu.getAttribute('role')).toBe('group');
    expect(menu.getAttribute('aria-label')).toBe('Group');
    expect(button.getAttribute('aria-label')).toBe('Create group');
    expect(button.title).toBe('Create group');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  test('[R-27] uses a consistent outline group icon', () => {
    const menu = createGroupMenu(vi.fn());
    const icon = menu.querySelector('button svg');

    expect(icon?.getAttribute('viewBox')).toBe('0 0 16 16');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.querySelectorAll('path')).toHaveLength(1);
    expect(icon?.querySelector('path')?.getAttribute('d')).toBeTruthy();
  });

  test('[R-36] draws the Create group icon with a dashed outline', () => {
    const menu = createGroupMenu(vi.fn());
    const outline = menu.querySelector('button svg path');

    expect(outline?.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  test('[R-36] forwards the create request', () => {
    const onCreate = vi.fn();
    const menu = createGroupMenu(onCreate);
    document.body.append(menu);
    const button = menu.querySelector('button');
    if (!(button instanceof HTMLButtonElement)) throw new Error('No group button');

    button.click();

    expect(onCreate).toHaveBeenCalledOnce();
  });
});
