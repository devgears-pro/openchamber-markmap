import { MarkmapEditor, createEditView } from '@markmap/edit-dom';
import { labelText, parseDocument } from '@markmap/model';
import type { DrawGroup } from '@markmap/render';
import { createToolbar } from '@markmap/toolbar';
import { Markmap } from '@markmap/view';
import { select } from 'd3-selection';

import { createClipboard } from './clipboard';
import { messageOf } from './errors';
import { applyMarker } from './markers';
import { wheelZoomDelta } from './gestures';
import { layoutFor, type MarkmapLayout } from './layouts';
import { optionsFor, type MarkmapColorScheme } from './options';
import { createToolbarItems } from './toolbar-items';
import { placeAtFullScale } from './zoom';

export type { MarkmapColorScheme } from './options';

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
  editNotes: () => void;
  createGroup: () => void;
  resetView: () => void;
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
  onDraft: (change: MarkmapSourceChange) => void;
  onError: (message: string) => void;
  onOpenUrl: (url: string) => void;
};

export type MarkmapResult = { ok: true; view: MarkmapView } | { ok: false; message: string };

export type MarkmapFactory = (mount: MarkmapMount) => MarkmapResult;

const HTTP_URL = /^https?:\/\//iu;

const linkOf = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest('a');
  if (anchor === null) return null;
  const href = anchor.getAttribute('href') ?? '';
  return HTTP_URL.test(href) ? href : null;
};

const groupsOf = (instance: Markmap): readonly DrawGroup[] | undefined => {
  const result = instance.result;
  if (result === undefined) return undefined;
  if (!('state' in result)) return undefined;
  return result.state.groups;
};

export const createMarkmapView: MarkmapFactory = (mount) => {
  let markmap: Markmap | null = null;
  let editor: MarkmapEditor | null = null;
  let toolbar: ReturnType<typeof createToolbar> | null = null;
  let clipboard: { destroy: () => void } | null = null;
  let placement: (() => void) | null = null;

  try {
    const source = mount.markdown;
    const parsed = parseDocument(source);
    const resolved = optionsFor(mount.colorScheme, parsed.frontmatter);
    for (const warning of resolved.warnings) mount.onError(warning);
    markmap = Markmap.create(mount.svg, parsed.tree, resolved.options);
    const instance = markmap;
    let layoutName = resolved.layout;

    const syncGroupElements = (): void => {
      const groups = groupsOf(instance);
      if (groups === undefined) return;
      groups.forEach((group, index) => {
        const el = instance.element.querySelector(`g[data-key="group:${group.id}"]`);
        if (el !== null) {
          el.setAttribute('data-group-id', group.id);
          el.setAttribute('data-group-index', String(index));
        }
      });
    };
    syncGroupElements();
    instance.on('render', syncGroupElements);

    const groupScreenRect = (
      id: string | number,
    ): { x: number; y: number; width: number; height: number } | undefined => {
      const groups = groupsOf(instance);
      if (groups === undefined) return undefined;
      const group = groups.find((g, i) => i === id || g.id === id);
      if (group === undefined) return undefined;
      const svgRect = instance.element.getBoundingClientRect();
      const t = instance.transform;
      return {
        x: svgRect.x + t.applyX(group.rect.x),
        y: svgRect.y + t.applyY(group.rect.y),
        width: group.rect.width * t.k,
        height: group.rect.height * t.k,
      };
    };
    Reflect.set(instance, 'groupScreenRect', groupScreenRect);

    const originalHitAt = instance.hitAt.bind(instance);
    const hitAtWithGroups = (
      x: number,
      y: number,
    ): ReturnType<typeof originalHitAt> | { kind: 'group'; groupId: string } => {
      const hit = originalHitAt(x, y);
      if (hit !== undefined) return hit;
      const groups = groupsOf(instance);
      if (groups === undefined) return undefined;
      for (const group of [...groups].reverse()) {
        const top = group.rect.y - (group.label === null ? 0 : 24);
        const bottom = group.rect.y + group.rect.height;
        const left = group.rect.x;
        const right = group.rect.x + group.rect.width;
        if (x >= left && x <= right && y >= top && y <= bottom) {
          return { kind: 'group', groupId: group.id };
        }
      }
      return undefined;
    };
    Reflect.set(instance, 'hitAt', hitAtWithGroups);
    const panBy = (dx: number, dy: number): void => {
      const { k } = instance.transform;
      instance.zoomBehavior.transform(
        select(instance.element),
        instance.transform.translate(dx / k, dy / k),
      );
    };
    const placementView = {
      get element() {
        return instance.element;
      },
      get transform() {
        return instance.transform;
      },
      get result() {
        return instance.result;
      },
      focusNode: (id: string, options?: { scale?: number; animate?: boolean }) =>
        instance.focusNode(id, options),
      screenRect: (id: string) => instance.screenRect(id),
      panBy,
    };
    placement = placeAtFullScale(placementView, parsed.tree.id, {
      layout: layoutName,
      root: true,
    }).cancel;
    instance.zoomBehavior.wheelDelta(wheelZoomDelta);
    const resetView = (): void => {
      const selected = editor?.selected ?? parsed.tree.id;
      const placed = placeAtFullScale(placementView, selected, {
        layout: layoutName,
        root: selected === parsed.tree.id,
      });
      if (!placed.placed) {
        placeAtFullScale(placementView, parsed.tree.id, { layout: layoutName, root: true });
      }
      editor?.focus();
    };
    toolbar = createToolbar(instance, { items: createToolbarItems(resetView) });

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
        onDraftChange: (change) => {
          mount.onDraft({
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
      editNotes: () => {
        editor?.editNotes();
      },
      createGroup: () => {
        editor?.createGroup();
      },
      resetView,
      commit: () => {
        editor?.commit();
      },
      snapshotForSave: () => editor?.snapshot() ?? null,
      destroy: () => {
        placement?.();
        placement = null;
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
    placement?.();
    placement = null;
    clipboard?.destroy();
    editor?.destroy();
    toolbar?.destroy();
    markmap?.destroy();
    mount.svg.replaceChildren();
    return { ok: false, message: messageOf(error) };
  }
};
