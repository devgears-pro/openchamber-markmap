# Testing

## Levels

| Level        | Tool                                 | What it proves                                                                                                |
| ------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Types        | `tsc --noEmit`                       | The code satisfies strict TypeScript, including tests and scripts.                                            |
| Unit         | Vitest                               | The adapter maps Markmap APIs, options, updates, and cleanup correctly.                                       |
| DOM          | Vitest + happy-dom                   | The host contract, node selection, theme, snapshot, and fallback behavior.                                    |
| Contract     | Vitest                               | `package.json` parses with the OpenChamber manifest schema.                                                   |
| Bundle       | Vitest                               | The entry is one classic script and the IIFE stays within budget.                                             |
| Acceptance   | Playwright                           | The real renderer draws a map, mounts its toolbar, and the keyboard editor inserts, edits, and removes nodes. |
| Static       | ESLint, Prettier, markdownlint, Knip | Style, formatting, docs, and dead code.                                                                       |
| Reproducible | `check:reproducible`                 | Two builds from the same tree produce identical bytes.                                                        |

## Commands

```bash
bun run test             # Vitest
bun run test:coverage    # Vitest with the 100% gate
bun run test:acceptance  # Playwright, real browser, real Markmap
bun run verify           # all merge-blocking checks
```

## Coverage

`vitest.config.ts` requires 100% statements, branches, functions, and lines for `src/`, except `src/main.ts`. The bootstrap is a three-line host connection and cannot be exercised without the OpenChamber frame; its behavior is covered by the acceptance path.

Coverage is not a substitute for assertions. A test that calls code without checking observable behavior does not count as proof.

## Requirement traceability

Every requirement ID from `docs/requirements.md` appears in at least one test name as `[R-xx]`. Every test file has at least one ID. `bun run check:requirements` enforces both directions and fails on unknown IDs.

When a requirement changes:

1. Update the requirement text.
2. Update or add a failing test with the ID.
3. Implement the change.
4. Update the traceability table.

## Test design

- Arrange, act, assert. One observable behavior per test.
- Prefer real DOM behavior over implementation details.
- Mock only the Markmap boundary in unit tests; acceptance covers the real library.
- No network, timers, locale, timezone, or random values in tests.
- Use the synthetic `dev/sample.md` and inline test strings. Never use a real user document.
- A regression test must fail for the reported reason before the fix.

## Acceptance

Playwright starts the Vite harness and opens `/dev/`. It asserts on the rendered SVG, the Markmap toolbar, node selection, keyboard edits, arrow navigation, folding, undo and redo, theme state, read-only rendering, new empty file editing, editor errors, wheel gestures, and accessible names. Screenshots are optional evidence for a report; the gate uses DOM assertions, not pixel diffs.

## What not to do

- Do not lower coverage thresholds to merge a change.
- Do not add `v8 ignore` comments or exclude files without a written reason.
- Do not assert on generated bundle text beyond the IIFE and budget checks.
- Do not replace the real Markmap adapter with a permanent mock in production code.
