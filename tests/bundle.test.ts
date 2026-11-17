import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Script } from 'node:vm';

import { describe, expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const bundleBudget = 750_000;

describe('built editor', () => {
  test('[R-08] loads one classic script', () => {
    const html = readFileSync(resolve(root, 'editor/index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\b[^>]*>/giu)];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.[0]).toContain('src="main.js"');
    expect(scripts[0]?.[0]).not.toContain('type=');
  });

  test('[R-08] builds an IIFE without module syntax', () => {
    const source = readFileSync(resolve(root, 'editor/main.js'), 'utf8');
    expect(source.length).toBeGreaterThan(1000);
    expect(source.length).toBeLessThan(bundleBudget);
    expect(() => new Script(source)).not.toThrow();
    expect(source).not.toMatch(/^\s*(?:import|export)\s/mu);
  });

  test('[R-25] loads one classic script in the chat entry', () => {
    const html = readFileSync(resolve(root, 'chat/index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\b[^>]*>/giu)];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.[0]).toContain('src="main.js"');
    expect(scripts[0]?.[0]).not.toContain('type=');
  });

  test('[R-25] builds the chat bundle as an IIFE without module syntax', () => {
    const source = readFileSync(resolve(root, 'chat/main.js'), 'utf8');
    expect(source.length).toBeGreaterThan(1000);
    expect(source.length).toBeLessThan(bundleBudget);
    expect(() => new Script(source)).not.toThrow();
    expect(source).not.toMatch(/^\s*(?:import|export)\s/mu);
  });
});
