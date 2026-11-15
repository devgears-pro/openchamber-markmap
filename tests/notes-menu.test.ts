import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createNotesMenu } from '../src/ui/notes-menu';

describe('notes menu', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  test('[R-26] offers a labelled Edit notes control', () => {
    const menu = createNotesMenu(vi.fn());
    document.body.append(menu);
    const button = menu.querySelector('button');
    if (!(button instanceof HTMLButtonElement)) throw new Error('No notes button');

    expect(menu.getAttribute('role')).toBe('group');
    expect(menu.getAttribute('aria-label')).toBe('Notes');
    expect(button.getAttribute('aria-label')).toBe('Edit notes');
    expect(button.title).toBe('Edit notes');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  test('[R-26] forwards the edit request', () => {
    const onEdit = vi.fn();
    const menu = createNotesMenu(onEdit);
    document.body.append(menu);
    const button = menu.querySelector('button');
    if (!(button instanceof HTMLButtonElement)) throw new Error('No notes button');

    button.click();

    expect(onEdit).toHaveBeenCalledOnce();
  });
});
