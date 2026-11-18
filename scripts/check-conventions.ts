import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { parseDocument, validateConventions } from '@markmap/model';

const root = resolve(import.meta.dirname, '..');

const isMarkmapFile = (name: string): boolean =>
  name.endsWith('.markmap.md') ||
  name.endsWith('-markmap.md') ||
  name.endsWith('.mm.md') ||
  name.endsWith('-mm.md') ||
  name.endsWith('.mindmap.md') ||
  name.endsWith('-mindmap.md');

const shouldSkipDir = (name: string): boolean =>
  name === 'node_modules' ||
  name === '.worktrees' ||
  name === 'vendor' ||
  name === 'tmp' ||
  name === '.git' ||
  name === '.agents' ||
  name === 'tests';

const collectFiles = (target: string): string[] => {
  const stat = statSync(target);
  if (!stat.isDirectory()) return [target];
  const entries = readdirSync(target, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(target, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) {
        files.push(...collectFiles(full));
      }
    } else if (
      isMarkmapFile(entry.name) ||
      (target.endsWith('dev') && extname(entry.name) === '.md')
    ) {
      files.push(full);
    }
  }
  return files;
};

const lineAt = (text: string, offset: number): number => {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
};

const args = process.argv.slice(2);
const targets = args.length > 0 ? args : [root];
const files = targets.flatMap((target) => collectFiles(resolve(root, target)));

let totalIssues = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const doc = parseDocument(text).document;
  const issues = validateConventions(doc);
  if (issues.length > 0) {
    totalIssues += issues.length;
    const rel = relative(root, file);
    for (const issue of issues) {
      const line = issue.range !== undefined ? `:${lineAt(text, issue.range.start)}` : '';
      console.error(`${rel}${line}: [${issue.code}] ${issue.message}`);
    }
  }
}

if (totalIssues > 0) {
  console.error(`Conventions: found ${totalIssues} issue(s) across ${files.length} file(s).`);
  process.exit(1);
}

console.log(`Conventions: ${files.length} files validated, all clean.`);
