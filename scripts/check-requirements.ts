import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const testsRoot = join(root, 'tests');
const requirementsFile = join(root, 'docs', 'requirements.md');

const walk = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)],
  );

const requirementIds = new Set(
  [...readFileSync(requirementsFile, 'utf8').matchAll(/\bR-\d{2}\b/gu)].map((match) => match[0]),
);

const testFiles = walk(testsRoot).filter((file) => /\.(?:test|spec)\.ts$/u.test(file));
const byFile = new Map<string, Set<string>>();

for (const file of testFiles) {
  const text = readFileSync(file, 'utf8');
  const ids = new Set<string>();
  for (const match of text.matchAll(/\[(R-\d{2})\]/gu)) {
    const id = match[1];
    if (id !== undefined) ids.add(id);
  }
  byFile.set(file, ids);
}

const referenced = new Set([...byFile.values()].flatMap((ids) => [...ids]));
const missing = [...requirementIds].filter((id) => !referenced.has(id));
const unknown = [...referenced].filter((id) => !requirementIds.has(id));
const untagged = [...byFile.entries()]
  .filter(([, ids]) => ids.size === 0)
  .map(([file]) => relative(root, file));

if (missing.length > 0 || unknown.length > 0 || untagged.length > 0) {
  if (missing.length > 0) console.error(`Requirements without tests: ${missing.join(', ')}`);
  if (unknown.length > 0)
    console.error(`Tests reference unknown requirements: ${unknown.join(', ')}`);
  if (untagged.length > 0)
    console.error(`Test files without a requirement: ${untagged.join(', ')}`);
  process.exit(1);
}

console.log(`Requirements: ${requirementIds.size} mapped across ${testFiles.length} test files.`);
