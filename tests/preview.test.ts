import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest';

import type { ViewOptions } from '@markmap/view';

import { layoutFor } from '../src/markmap/layouts';

const mocks = vi.hoisted(() => ({
  parseDocument: vi.fn(),
  create: vi.fn(),
  resolveViewOptions: vi.fn(),
}));

vi.mock('@markmap/model', () => ({ parseDocument: mocks.parseDocument }));
vi.mock('@markmap/view', () => ({
  Markmap: { create: mocks.create },
  resolveViewOptions: mocks.resolveViewOptions,
}));

const { createMarkmapPreview } = await import('../src/markmap/preview');

type FakeMarkmap = {
  options: ViewOptions;
  setOptions: Mock<(next: ViewOptions) => void>;
  destroy: Mock<() => void>;
};

type Setup = {
  svg: SVGSVGElement;
  markmap: FakeMarkmap;
  onError: ReturnType<typeof vi.fn<(message: string) => void>>;
  options: ViewOptions;
};

const setup = (): Setup => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const options: ViewOptions = { colorScheme: 'dark', layout: layoutFor('two-sided') };
  const markmap: FakeMarkmap = {
    options,
    setOptions: vi.fn<(next: ViewOptions) => void>((next) => {
      markmap.options = next;
    }),
    destroy: vi.fn(),
  };
  const onError = vi.fn<(message: string) => void>();
  mocks.parseDocument.mockReturnValue({ tree: { id: 'root' }, frontmatter: {}, document: {} });
  mocks.resolveViewOptions.mockReturnValue({ options, warnings: [] });
  mocks.create.mockReturnValue(markmap);
  return { svg, markmap, onError, options };
};

describe('chat preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('[R-24] draws the parsed tree with the resolved options', () => {
    const { svg, onError } = setup();

    const result = createMarkmapPreview({
      svg,
      markdown: '# Root',
      colorScheme: 'dark',
      onError,
    });

    expect(result.ok).toBe(true);
    expect(mocks.parseDocument).toHaveBeenCalledWith('# Root');
    expect(mocks.create).toHaveBeenCalledWith(
      svg,
      { id: 'root' },
      expect.objectContaining({ colorScheme: 'dark', layout: layoutFor('two-sided') }),
    );
  });

  test('[R-37] passes graph and identities to the view renderer', () => {
    const { svg, onError } = setup();
    const graphData = { edges: [{ from: 'a', to: 'b', label: 'link' }], groups: [], block: null };
    const identities = new Map([
      ['a', 'node-a'],
      ['b', 'node-b'],
    ]);
    mocks.parseDocument.mockReturnValue({
      tree: { id: 'root' },
      frontmatter: {},
      document: { graph: graphData, identities },
    });

    createMarkmapPreview({ svg, markdown: '# Root', colorScheme: 'dark', onError });

    expect(mocks.create).toHaveBeenCalledWith(
      svg,
      { id: 'root' },
      expect.objectContaining({ graph: graphData, identities }),
    );
  });

  test('[R-24] reports ignored frontmatter values', () => {
    const { svg, onError } = setup();
    mocks.resolveViewOptions.mockReturnValue({
      options: { colorScheme: 'dark' },
      warnings: ['Unknown key "map"'],
    });

    createMarkmapPreview({ svg, markdown: '# Root', colorScheme: 'dark', onError });

    expect(onError).toHaveBeenCalledWith('Unknown key "map"');
  });

  test('[R-24] redraws the map with another theme mode', () => {
    const { svg, markmap, onError } = setup();
    const result = createMarkmapPreview({ svg, markdown: '# Root', colorScheme: 'dark', onError });
    if (!result.ok) throw new Error(result.message);

    result.preview.setColorScheme('light');

    expect(markmap.setOptions).toHaveBeenCalledWith({
      colorScheme: 'light',
      layout: layoutFor('two-sided'),
    });
  });

  test('[R-24] releases the view when the block goes away', () => {
    const { svg, markmap, onError } = setup();
    svg.append(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
    const result = createMarkmapPreview({ svg, markdown: '# Root', colorScheme: 'dark', onError });
    if (!result.ok) throw new Error(result.message);

    result.preview.destroy();

    expect(markmap.destroy).toHaveBeenCalledOnce();
    expect(svg.childElementCount).toBe(0);
  });

  test('[R-24] reports a failure instead of a blank frame', () => {
    const { svg, onError } = setup();
    svg.append(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
    mocks.create.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    const result = createMarkmapPreview({ svg, markdown: '# Root', colorScheme: 'dark', onError });

    expect(result).toEqual({ ok: false, message: 'boom' });
    expect(svg.childElementCount).toBe(0);
  });

  test('[R-24] reports a thrown value that is not an error', () => {
    const { svg, onError } = setup();
    const failure: unknown = 'boom';
    mocks.create.mockImplementationOnce(() => {
      throw failure;
    });

    const result = createMarkmapPreview({ svg, markdown: '# Root', colorScheme: 'dark', onError });

    expect(result).toEqual({ ok: false, message: 'boom' });
  });
});
