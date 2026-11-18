import type { Document, EditNode } from '@markmap/model';

export type ClipboardEditor = {
  readonly isEditing: boolean;
  readonly isEditingNotes: boolean;
  readonly selected: string | null;
  readonly document: Document;
  focus: () => void;
  selectedBlock: () => string | null;
  insertBlock: (text: string) => boolean;
  insertLabel: (text: string) => boolean;
  deleteSelected: () => boolean;
};

type ClipboardMount = {
  container: HTMLElement;
  editor: ClipboardEditor;
  onNotice: (message: string) => void;
};

const SINK_CLASS = 'mm-clipboard-sink';
const EMPTY_NOTICE = 'The clipboard is empty.';
const COPY_NOTICE = 'This node has nothing to copy.';
const COPY_FAILED_NOTICE = 'This node could not be copied.';
const ROOT_CUT_NOTICE = 'The root cannot be cut, so it stays in the map.';

let copied = '';

const comparable = (text: string): string => text.replace(/\r\n?/gu, '\n').trim();

const isPaste = (event: KeyboardEvent): boolean => {
  if (event.defaultPrevented || event.isComposing) return false;
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return false;
  return event.key.toLowerCase() === 'v';
};

export const createClipboard = ({
  container,
  editor,
  onNotice,
}: ClipboardMount): { destroy: () => void } => {
  const doc = container.ownerDocument;
  const sink = doc.createElement('textarea');
  sink.className = SINK_CLASS;
  sink.tabIndex = -1;
  sink.setAttribute('aria-hidden', 'true');
  sink.setAttribute('autocomplete', 'off');
  container.append(sink);

  const selectedNode = (): EditNode | undefined => {
    const id = editor.selected;
    return id === null ? undefined : editor.document.nodes.get(id);
  };

  const focused = (): boolean => doc.activeElement === container;

  const copy = (event: ClipboardEvent, cut: boolean): void => {
    if (editor.isEditing || editor.isEditingNotes || !focused()) return;
    let text: string | null;
    try {
      text = editor.selectedBlock();
    } catch {
      onNotice(COPY_FAILED_NOTICE);
      return;
    }
    if (text === null) {
      onNotice(COPY_NOTICE);
      return;
    }
    event.clipboardData?.setData('text/plain', text);
    event.preventDefault();
    copied = text;
    if (!cut) return;
    const node = selectedNode();
    if (!node?.capabilities.delete) {
      onNotice(ROOT_CUT_NOTICE);
      return;
    }
    editor.deleteSelected();
    editor.focus();
  };

  const handleCopy = (event: ClipboardEvent): void => {
    copy(event, false);
  };

  const handleCut = (event: ClipboardEvent): void => {
    copy(event, true);
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!isPaste(event) || editor.isEditing || editor.isEditingNotes) return;
    sink.focus({ preventScroll: true });
  };

  const handlePaste = (event: ClipboardEvent): void => {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    sink.value = '';
    if (text.trim() === '') {
      onNotice(EMPTY_NOTICE);
      editor.focus();
      return;
    }
    if (copied !== '' && comparable(text) === comparable(copied)) {
      editor.insertBlock(copied);
    } else {
      editor.insertLabel(text.trim().replace(/\s+/gu, ' '));
    }
    editor.focus();
  };

  const handleSinkKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    editor.focus();
  };

  doc.addEventListener('copy', handleCopy);
  doc.addEventListener('cut', handleCut);
  container.addEventListener('keydown', handleKeyDown, true);
  sink.addEventListener('paste', handlePaste);
  sink.addEventListener('keydown', handleSinkKeyDown);

  return {
    destroy: () => {
      doc.removeEventListener('copy', handleCopy);
      doc.removeEventListener('cut', handleCut);
      container.removeEventListener('keydown', handleKeyDown, true);
      sink.removeEventListener('paste', handlePaste);
      sink.removeEventListener('keydown', handleSinkKeyDown);
      sink.remove();
    },
  };
};
