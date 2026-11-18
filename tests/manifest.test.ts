import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { matchesFileEditorPattern } from '@openchamber/sdk';
import { parseManifestJson } from '@openchamber/sdk/schemas';
import { describe, expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '..');

describe('extension manifest', () => {
  const result = parseManifestJson(readFileSync(resolve(root, 'package.json'), 'utf8'));

  test('[R-01] parses with the host schema', () => {
    expect(result.ok).toBe(true);
  });

  test('[R-01] declares the Markmap file editor for the chosen suffixes', () => {
    if (!result.ok) throw new Error(result.message);
    const editors = result.manifest.contributes.fileEditors ?? [];
    expect(result.manifest.contributes.panel.name).toBe('Markmap');
    expect(editors).toHaveLength(1);
    expect(editors[0]?.id).toBe('markmap');
    expect(editors[0]?.title).toBe('Markmap');
    expect(editors[0]?.match).toEqual([
      '*.markmap.md',
      '*-markmap.md',
      '*.mm.md',
      '*-mm.md',
      '*.mindmap.md',
      '*-mindmap.md',
    ]);
    expect(editors[0]?.entry).toBe('editor/index.html');
  });

  test('[R-01] matches the intended file names and leaves other Markdown alone', () => {
    if (!result.ok) throw new Error(result.message);
    const patterns = result.manifest.contributes.fileEditors?.[0]?.match ?? [];
    const matches = (name: string): boolean =>
      patterns.some((pattern) => matchesFileEditorPattern(name, pattern));

    for (const name of [
      'notes.markmap.md',
      'notes-markmap.md',
      'notes.mm.md',
      'notes-mm.md',
      'notes.mindmap.md',
      'notes-mindmap.md',
    ]) {
      expect(matches(name)).toBe(true);
    }
    expect(matches('NOTES.MARKMAP.MD')).toBe(true);
    for (const name of ['notes.md', 'notes.other.md', 'README.md', 'notes.mm.txt']) {
      expect(matches(name)).toBe(false);
    }
  });

  test('[R-01] ships the declared entry and icon', () => {
    if (!result.ok) throw new Error(result.message);
    const editors = result.manifest.contributes.fileEditors ?? [];
    const entry = editors[0]?.entry;
    if (entry === undefined) throw new Error('No editor entry');
    expect(() => readFileSync(resolve(root, entry))).not.toThrow();
    expect(() => readFileSync(resolve(root, 'icon.svg'))).not.toThrow();
  });

  test('[R-01] requires a current OpenChamber', () => {
    if (!result.ok) throw new Error(result.message);
    expect(result.manifest.engines?.openchamber).toBe('>=2.7.1');
  });

  test('[R-23] declares the Mindmap chat block', () => {
    if (!result.ok) throw new Error(result.message);
    const blocks = result.manifest.contributes.blocks ?? [];
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.name).toBe('Mindmap');
    expect(blocks[0]?.description).toContain('Markmap');
    expect(blocks[0]?.description.length).toBeLessThanOrEqual(120);
    expect(blocks[0]?.args).toEqual(['markdown']);
    expect(blocks[0]?.entry).toBe('chat/index.html');
    expect(blocks[0]?.height).toBe(480);
    expect(blocks[0]?.answers).toBeUndefined();
  });

  test('[R-23] ships the chat block entry', () => {
    if (!result.ok) throw new Error(result.message);
    const entry = result.manifest.contributes.blocks?.[0]?.entry;
    if (entry === undefined) throw new Error('No chat block entry');
    expect(() => readFileSync(resolve(root, entry))).not.toThrow();
  });
});
