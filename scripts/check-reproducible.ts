import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const bundle = join(root, 'editor', 'main.js');

const build = (): void => {
  const result = spawnSync('bun', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, SOURCE_DATE_EPOCH: '0' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const digest = (): string => createHash('sha256').update(readFileSync(bundle)).digest('hex');

build();
const first = digest();
build();
const second = digest();

if (first !== second) {
  console.error(`Bundle is not reproducible: ${first} != ${second}`);
  process.exit(1);
}

console.log(`Reproducible bundle: ${second}`);
