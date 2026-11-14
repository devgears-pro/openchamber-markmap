import { beforeEach, describe, expect, test } from 'vitest';

import { ensureStyles, STYLE_ID } from '../src/ui/styles';

describe('markmap styles', () => {
  beforeEach(() => {
    document.head.replaceChildren();
  });

  test('[R-03] adds the style once', () => {
    ensureStyles(document);
    ensureStyles(document);

    expect(document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1);
  });
});
