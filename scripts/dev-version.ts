import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const tags = execFileSync('git', ['tag', '--list', 'v*', '--sort=-v:refname'], {
  encoding: 'utf8',
})
  .split('\n')
  .map((tag) => tag.trim())
  .filter((tag) => /^v\d+\.\d+\.\d+$/u.test(tag));
const latest = tags[0] ?? 'v0.0.0';
const [major = 0, minor = 0] = latest
  .slice(1)
  .split('.')
  .map((part) => Number(part));
const base = `${String(major)}.${String(minor + 1)}.0`;
const count = execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim();
const version = `${base}-dev.${count}`;
const path = 'package.json';
const raw = readFileSync(path, 'utf8');

if (!raw.includes(`"version": "${version}"`)) {
  const next = raw.replace(/"version":\s*"[^"]+"/u, `"version": "${version}"`);
  if (next === raw) throw new Error('package.json has no version field');
  writeFileSync(path, next);
}

console.log(version);
