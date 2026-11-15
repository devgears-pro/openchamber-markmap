import { MarkmapEditor, createEditView } from '@markmap/edit-dom';
import { labelText, parseDocument } from '@markmap/model';
import { createToolbar } from '@markmap/toolbar';
import { Markmap, resolveViewOptions, type ViewOptions } from '@markmap/view';

import { createClipboard } from './clipboard';
import { applyMarker } from './markers';
import { mapGestures, wheelZoomDelta } from './gestures';
import { layoutFor, type MarkmapLayout } from './layouts';

export type MarkmapColorScheme = 'light' | 'dark';

export type MarkmapSourceChange = {
  source: string;
  selection: number;
};

export type MarkmapView = {
  readonly layout: MarkmapLayout;
  readonly toolbar: HTMLDivElement;
  setLayout: (layout: MarkmapLayout) => void;
  setColorScheme: (colorScheme: MarkmapColorScheme) => void;
  addMarker: (glyph: string) => void;
  commit: () => void;
  snapshotForSave: () => string | null;
  destroy: () => void;
};

export type MarkmapMount = {
  surface: HTMLElement;
  svg: SVGSVGElement;
  markdown: string;
  colorScheme: MarkmapColorScheme;
  editable: boolean;
  onSource: (change: MarkmapSourceChange) => void;
  onError: (message: string) => void;
  onOpenUrl: (url: string) => void;
};

export type MarkmapResult = { ok: true; view: MarkmapView } | { ok: false; message: string };

export type MarkmapFactory = (mount: MarkmapMount) => MarkmapResult;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const HTTP_URL = /^https?:\/\//iu;

const linkOf = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest('a');
  if (anchor === null) return null;
  const href = anchor.getAttribute('href') ?? '';
  return HTTP_URL.test(href) ? href : null;
};

type ResolvedView = {
  options: ViewOptions;
  warnings: string[];
  layout: MarkmapLayout;
};

const layoutNameOf = (layout: ViewOptions['layout']): MarkmapLayout => {
  if (layout === layoutFor('tree')) return 'tree';
  if (layout === layoutFor('org-chart')) return 'org-chart';
  return 'two-sided';
};

const optionsFor = (
  colorScheme: MarkmapColorScheme,
  frontmatter: Record<string, unknown>,
): ResolvedView => {
  const base: ViewOptions = {
    duration: 0,
    fitPadding: 24,
    fitMaxScale: 1,
    layout: layoutFor('two-sided'),
  };
  const resolved = resolveViewOptions(base, frontmatter['markmap']);
  return {
    options: { ...resolved.options, colorScheme, gestures: mapGestures },
    warnings: resolved.warnings,
    layout: layoutNameOf(resolved.options.layout),
  };
};

export const createMarkmapView: MarkmapFactory = (mount) => {
  let markmap: Markmap | null = null;
  let editor: MarkmapEditor | null = null;
  let toolbar: ReturnType<typeof createToolbar> | null = null;
  let clipboard: { destroy: () => void } | null = null;

  try {
    const source = mount.markdown;
    const parsed = parseDocument(source);
    const resolved = optionsFor(mount.colorScheme, parsed.frontmatter);
    for (const warning of resolved.warnings) mount.onError(warning);
    markmap = Markmap.create(mount.svg, parsed.tree, resolved.options);
    const instance = markmap;
    let layoutName = resolved.layout;
    instance.zoomBehavior.wheelDelta(wheelZoomDelta);
    toolbar = createToolbar(instance);

    if (mount.editable) {
      const created = new MarkmapEditor({
        source,
        view: createEditView(instance),
        container: mount.surface,
        placeholder: '\u200B',
        onChange: (change) => {
          mount.onSource({
            source: change.source,
            selection: change.selection,
          });
        },
        onError: (error) => {
          mount.onError(error.message);
        },
      });
      editor = created;
      created.focus();
      clipboard = createClipboard({
        container: mount.surface,
        editor: created,
        onNotice: mount.onError,
      });
    }

    const handleLink = (event: MouseEvent): void => {
      const href = linkOf(event.target);
      if (href === null) return;
      event.preventDefault();
      event.stopPropagation();
      mount.onOpenUrl(href);
    };
    mount.svg.addEventListener('click', handleLink, true);

    const view: MarkmapView = {
      get layout() {
        return layoutName;
      },
      toolbar: toolbar.element,
      setLayout: (layout) => {
        editor?.commit();
        instance.setOptions({ ...instance.options, layout: layoutFor(layout) });
        instance.fit();
        layoutName = layout;
      },
      setColorScheme: (colorScheme) => {
        instance.setOptions({ ...instance.options, colorScheme });
      },
      addMarker: (glyph) => {
        if (editor === null) return;
        editor.commit();
        const id = editor.selected;
        if (id === null) return;
        const node = editor.document.nodes.get(id);
        if (node === undefined) return;
        const label = labelText(editor.document, node);
        const next = applyMarker(label, glyph);
        if (next === label) return;
        editor.setLabel(id, next);
        editor.focus();
      },
      commit: () => {
        editor?.commit();
      },
      snapshotForSave: () => editor?.commitForSnapshot() ?? null,
      destroy: () => {
        mount.svg.removeEventListener('click', handleLink, true);
        clipboard?.destroy();
        clipboard = null;
        editor?.destroy();
        editor = null;
        toolbar?.destroy();
        toolbar = null;
        instance.destroy();
        markmap = null;
        mount.svg.replaceChildren();
      },
    };
    return { ok: true, view };
  } catch (error) {
    clipboard?.destroy();
    editor?.destroy();
    toolbar?.destroy();
    markmap?.destroy();
    mount.svg.replaceChildren();
    return { ok: false, message: messageOf(error) };
  }
};
