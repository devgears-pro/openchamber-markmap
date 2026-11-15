import { parseDocument, type Document } from '@markmap/model';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createClipboard, type ClipboardEditor } from '../src/markmap/clipboard';

const SOURCE = '# Root\n\n- Links\n  note\n\n- Two\n';

type Harness = {
  container: HTMLDivElement;
  map: Document;
  notices: string[];
  calls: {
    blocks: string[];
    labels: string[];
    deletes: number;
    focus: number;
  };
  editing: { value: boolean };
  selected: { value: string | null };
  sink: HTMLTextAreaElement;
  destroy: () => void;
};

const idOf = (map: Document, label: string): string => {
  for (const id of map.order) {
    const node = map.nodes.get(id);
    if (node?.label && map.source.slice(node.label.start, node.label.end).startsWith(label)) {
      return id;
    }
  }
  throw new Error(`No node ${label}`);
};

const setup = (source = SOURCE): Harness => {
  const map = parseDocument(source).document;
  const container = document.createElement('div');
  container.tabIndex = 0;
  document.body.append(container);
  const notices: string[] = [];
  const calls = { blocks: [] as string[], labels: [] as string[], deletes: 0, focus: 0 };
  const editing = { value: false };
  const selected = { value: map.root };
  const editor: ClipboardEditor = {
    get isEditing() {
      return editing.value;
    },
    get source() {
      return map.source;
    },
    get selected() {
      return selected.value;
    },
    get document() {
      return map;
    },
    focus: () => {
      calls.focus += 1;
    },
    insertBlock: (text) => {
      calls.blocks.push(text);
      return true;
    },
    insertLabel: (text) => {
      calls.labels.push(text);
      return true;
    },
    deleteSelected: () => {
      calls.deletes += 1;
      return true;
    },
  };
  const clipboard = createClipboard({
    container,
    editor,
    onNotice: (message) => notices.push(message),
  });
  const sink = container.querySelector<HTMLTextAreaElement>('textarea.mm-clipboard-sink');
  if (sink === null) throw new Error('No clipboard sink');
  container.focus();
  return {
    container,
    map,
    notices,
    calls,
    editing,
    selected,
    sink,
    destroy: clipboard.destroy,
  };
};

const event = (type: string, text?: string): ClipboardEvent => {
  const data = new DataTransfer();
  if (text !== undefined) data.setData('text/plain', text);
  return new ClipboardEvent(type, { clipboardData: data, bubbles: true, cancelable: true });
};

const key = (target: EventTarget, value: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const pressed = new KeyboardEvent('keydown', {
    key: value,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(pressed);
  return pressed;
};

const paste = (harness: Harness, text?: string): ClipboardEvent => {
  key(harness.container, 'v', { metaKey: true });
  const pasted = event('paste', text);
  harness.sink.dispatchEvent(pasted);
  return pasted;
};

let harness: Harness | null = null;

beforeEach(() => {
  document.body.replaceChildren();
  harness = null;
});

afterEach(() => {
  harness?.destroy();
});

describe('clipboard', () => {
  test('[R-21] pastes external text as one child label', () => {
    harness = setup();
    harness.selected.value = idOf(harness.map, 'Links');

    paste(harness, '  External\n\n note  ');

    expect(harness.calls.labels).toEqual(['External note']);
    expect(harness.calls.blocks).toEqual([]);
    expect(harness.calls.focus).toBe(1);
  });

  test('[R-21] copies the selected subtree with its notes', () => {
    harness = setup();
    harness.selected.value = idOf(harness.map, 'Links');
    const copied = event('copy');

    harness.container.dispatchEvent(copied);

    expect(copied.clipboardData?.getData('text/plain')).toBe('- Links\n  note');
    expect(harness.notices).toEqual([]);
  });

  test('[R-21] copies the root and refuses to cut it', () => {
    harness = setup();
    const cut = event('cut');

    harness.container.dispatchEvent(cut);

    expect(cut.clipboardData?.getData('text/plain')).toBe(SOURCE);
    expect(harness.calls.deletes).toBe(0);
    expect(harness.notices).toEqual(['The root cannot be cut, so it stays in the map.']);
  });

  test('[R-21] cuts a subtree with one delete', () => {
    harness = setup();
    harness.selected.value = idOf(harness.map, 'Links');
    const cut = event('cut');

    harness.container.dispatchEvent(cut);

    expect(cut.clipboardData?.getData('text/plain')).toBe('- Links\n  note');
    expect(harness.calls.deletes).toBe(1);
    expect(harness.calls.focus).toBe(1);
  });

  test('[R-21] shows a notice when the selected node has no block', () => {
    harness = setup('');
    const copied = event('copy');

    harness.container.dispatchEvent(copied);

    expect(copied.clipboardData?.getData('text/plain')).toBe('');
    expect(harness.notices).toEqual(['This node has nothing to copy.']);
  });

  test('[R-21] shows a notice when no node is selected', () => {
    harness = setup();
    harness.selected.value = null;
    const copied = event('copy');

    harness.container.dispatchEvent(copied);

    expect(harness.notices).toEqual(['This node has nothing to copy.']);
  });

  test('[R-21] leaves native clipboard alone while editing', () => {
    harness = setup();
    harness.editing.value = true;
    const copied = event('copy');
    const cut = event('cut');

    harness.container.dispatchEvent(copied);
    harness.container.dispatchEvent(cut);

    expect(copied.clipboardData?.getData('text/plain')).toBe('');
    expect(harness.calls.deletes).toBe(0);
    expect(harness.notices).toEqual([]);
  });

  test('[R-21] ignores copy when the map is not focused', () => {
    harness = setup();
    harness.container.blur();
    const copied = event('copy');

    harness.container.dispatchEvent(copied);

    expect(copied.clipboardData?.getData('text/plain')).toBe('');
    expect(harness.notices).toEqual([]);
  });

  test('[R-21] copies without a clipboard data object', () => {
    harness = setup();
    harness.selected.value = idOf(harness.map, 'Links');
    const copied = new ClipboardEvent('copy', { bubbles: true, cancelable: true });

    harness.container.dispatchEvent(copied);
    paste(harness, '- Links\n  note\r\n');

    expect(harness.calls.blocks).toEqual(['- Links\n  note']);
  });

  test('[R-21] pastes an in-map copy as a block', () => {
    harness = setup();
    harness.selected.value = idOf(harness.map, 'Links');
    harness.container.dispatchEvent(event('copy'));

    paste(harness, '- Links\r\n  note\r\n');

    expect(harness.calls.blocks).toEqual(['- Links\n  note']);
    expect(harness.calls.labels).toEqual([]);
  });

  test('[R-21] shows a notice for an empty clipboard', () => {
    harness = setup();

    paste(harness, '   ');

    expect(harness.notices).toEqual(['The clipboard is empty.']);
    expect(harness.calls.blocks).toEqual([]);
    expect(harness.calls.labels).toEqual([]);
    expect(harness.calls.focus).toBe(1);
  });

  test('[R-21] shows a notice when the paste event has no data', () => {
    harness = setup();
    const pasted = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    key(harness.container, 'v', { ctrlKey: true });

    harness.sink.dispatchEvent(pasted);

    expect(harness.notices).toEqual(['The clipboard is empty.']);
  });

  test('[R-21] does not take the paste shortcut for other keys', () => {
    harness = setup();
    const prevented = new KeyboardEvent('keydown', {
      key: 'v',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    prevented.preventDefault();
    harness.container.dispatchEvent(prevented);
    key(harness.container, 'v', { metaKey: true, isComposing: true });
    key(harness.container, 'v');
    key(harness.container, 'v', { metaKey: true, altKey: true });
    key(harness.container, 'x', { metaKey: true });

    expect(document.activeElement).toBe(harness.container);
  });

  test('[R-21] keeps the paste shortcut out of the label field', () => {
    harness = setup();
    harness.editing.value = true;

    key(harness.container, 'v', { metaKey: true });

    expect(document.activeElement).toBe(harness.container);
  });

  test('[R-21] leaves the sink on Escape', () => {
    harness = setup();
    harness.sink.focus();
    key(harness.sink, 'a');
    expect(document.activeElement).toBe(harness.sink);

    const escaped = key(harness.sink, 'Escape');

    expect(escaped.defaultPrevented).toBe(true);
    expect(harness.calls.focus).toBe(1);
  });

  test('[R-21] removes the sink and listeners on destroy', () => {
    harness = setup();
    harness.destroy();
    harness = null;
    const copied = event('copy');

    document.dispatchEvent(copied);

    expect(copied.clipboardData?.getData('text/plain')).toBe('');
  });
});
