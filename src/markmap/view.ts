import { MarkmapEditor, createEditView } from '@markmap/edit-dom';
import { parseDocument } from '@markmap/model';
import { createToolbar } from '@markmap/toolbar';
import { Markmap, resolveViewOptions, type ViewOptions } from '@markmap/view';

export type MarkmapColorScheme = 'light' | 'dark';

export type MarkmapSourceChange = {
  source: string;
  selection: number;
};

export type MarkmapView = {
  readonly toolbar: HTMLDivElement;
  setColorScheme: (colorScheme: MarkmapColorScheme) => void;
  commit: () => void;
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
};

export type MarkmapResult = { ok: true; view: MarkmapView } | { ok: false; message: string };

export type MarkmapFactory = (mount: MarkmapMount) => MarkmapResult;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const optionsFor = (
  colorScheme: MarkmapColorScheme,
  frontmatter: Record<string, unknown>,
): ViewOptions => ({
  ...resolveViewOptions({ duration: 0, fitPadding: 24 }, frontmatter.markmap).options,
  colorScheme,
});

export const createMarkmapView: MarkmapFactory = (mount) => {
  let markmap: Markmap | null = null;
  let editor: MarkmapEditor | null = null;
  let toolbar: ReturnType<typeof createToolbar> | null = null;

  try {
    const parsed = parseDocument(mount.markdown);
    markmap = Markmap.create(
      mount.svg,
      parsed.tree,
      optionsFor(mount.colorScheme, parsed.frontmatter),
    );
    const instance = markmap;
    toolbar = createToolbar(instance);

    if (mount.editable) {
      editor = new MarkmapEditor({
        source: mount.markdown,
        view: createEditView(instance),
        container: mount.surface,
        onChange: (change) =>
          mount.onSource({
            source: change.source,
            selection: change.selection,
          }),
        onError: (error) => mount.onError(error.message),
      });
      editor.focus();
    }

    const view: MarkmapView = {
      toolbar: toolbar.element,
      setColorScheme: (colorScheme) => {
        instance.setOptions({ ...instance.options, colorScheme });
      },
      commit: () => {
        editor?.commit();
      },
      destroy: () => {
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
    editor?.destroy();
    toolbar?.destroy();
    markmap?.destroy();
    mount.svg.replaceChildren();
    return { ok: false, message: messageOf(error) };
  }
};
