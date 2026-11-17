import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const script = join(root, 'scripts', 'check-conventions.ts');

describe('R-38 convention diagnostics', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'conventions-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('[R-38] CLI validator succeeds on valid markmap files', () => {
    const validFile = join(tempDir, 'valid.markmap.md');
    writeFileSync(
      validFile,
      '# Root\n\n- Topic A <!-- ^a -->\n- Topic B <!-- ^b -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: b\n-->\n',
    );
    const result = spawnSync('bun', [script, validFile], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1 files validated, all clean.');
  });

  test('[R-38] CLI validator fails and reports E_IDENTITY issues', () => {
    const invalidFile = join(tempDir, 'invalid.markmap.md');
    writeFileSync(invalidFile, '# Root\n\n- Topic A <!-- ^a -->\n- Topic B <!-- ^a -->\n');
    const result = spawnSync('bun', [script, invalidFile], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('E_IDENTITY');
    expect(result.stderr).toContain(invalidFile);
  });

  test('[R-38] CLI validator fails and reports E_GRAPH issues', () => {
    const selfLoopFile = join(tempDir, 'self-loop.markmap.md');
    writeFileSync(
      selfLoopFile,
      '# Root\n\n- Node A <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: a\n-->\n',
    );
    const result = spawnSync('bun', [script, selfLoopFile], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('E_GRAPH');
    expect(result.stderr).toContain('connect "a" to itself');
  });

  test('[R-38] CLI validator runs across repository dev files by default', () => {
    const result = spawnSync('bun', [script], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('all clean');
  });
});
