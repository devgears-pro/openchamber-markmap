import { readFile, writeFile } from 'node:fs/promises';
import { minify } from 'terser';

for (const file of ['editor/main.js', 'chat/main.js']) {
  const source = await readFile(file, 'utf8');
  const result = await minify(source, {
    compress: true,
    mangle: true,
    format: { comments: false },
  });
  await writeFile(file, result.code ?? '');
}
