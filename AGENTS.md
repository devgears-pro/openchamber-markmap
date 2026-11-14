# Agent guide

OpenChamber file editor that renders Markmap Markdown. English is the repository language for code, tests, docs, commits, and test names. Chat replies follow the user's language.

## Commands

```bash
bun install
bun run dev
bun run typecheck
bun run lint
bun run check:requirements
bun run test
bun run test:coverage
bun run test:acceptance
bun run build
bun run verify
bunx openchamber-guest-check
```

`bun run verify` is the merge gate. It runs typecheck, lint, requirement traceability, build, stale-bundle check, reproducible build check, and the 100% coverage gate.

## Architecture

- `src/main.ts` — `connectHost()` and mount.
- `src/app.ts` — host wiring, editable source sidebar, save tracking, snapshot, theme updates, lifecycle.
- `src/markmap/view.ts` — the only module that imports Markmap. It parses Markdown, applies frontmatter options, creates the view and toolbar, and destroys them.
- `src/ui/styles.ts` — the injected stylesheet, host tokens only.
- `editor/` — installable package: `index.html` and the built `main.js`.
- `tests/` — Vitest unit and DOM tests plus Playwright acceptance tests.
- `scripts/` — requirement traceability and reproducible-build checks.

The host owns the file. The editor receives text through `onFileOpen`, returns the current Markdown through `onFileSnapshot`, and reports dirty state through `reportFileChange`. Markdown is edited in a plain textarea; there is no node editor, custom parser, layout engine, or palette in this repository.

## Non-negotiables

- Keep the extension Markmap-only. Do not add a custom Markdown parser, node editor, or serializer.
- Keep `contributes.fileEditors.match` narrow. The six suffixes in `package.json` are the product decision; never claim `*.md`.
- `onFileSnapshot` returns the current Markdown or the original bytes and a content-derived version. An unchanged text file round-trips byte-for-byte.
- Report edits with `createFileSaveTracker`: `observe` on input, `markSaved` on `onFileSaved`.
- A binary file or a Markmap failure must call `reportFileUnsupported()` so OpenChamber can show the source view.
- Use `@markmap/parse`, `@markmap/view`, and `@markmap/toolbar`; do not fork their behavior.
- The host theme wins over `markmap.colorScheme` from frontmatter. Keep the map readable in both modes.
- The textarea is the only editing surface. Read-only files must not accept input.
- A node click focuses the textarea and selects the node's `position` range from the parsed tree. Positions are absolute offsets that include the frontmatter.
- Destroy the Markmap view, toolbar, and DOM on file change and dispose.
- Do not add network access, external assets, `any`, type assertions, or non-null assertions in `src/`.
- Do not write comments in code. Tests and docs carry the explanation.
- Every requirement ID in `docs/requirements.md` must appear as `[R-xx]` in at least one test name. Every test file needs at least one ID.
- `editor/main.js` is committed. Rebuild it and keep the stale-bundle check green.
- Do not commit user documents, real business data, tokens, or generated reports. The dev sample is synthetic.

## Workflow

1. Read `docs/requirements.md` and pick or add a requirement ID.
2. Write a failing test with `[R-xx]` in its name.
3. Implement the smallest change that makes it pass.
4. Run `bun run verify`, then `bun run test:acceptance` when rendering or layout changed.
5. Rebuild `editor/main.js` and commit it with the source change.
6. Update docs and the requirement traceability table when behavior changes.

Bugs follow the same path, with the regression test first. See `docs/process/bugs.md`.

## Markmap facts

- `parse(markdown)` returns `{ root, frontmatter }`. YAML frontmatter is stripped from the tree.
- Apply `frontmatter.markmap` with `resolveViewOptions(base, input)`. The result includes warnings for unknown keys.
- `Markmap.create(svg, root, options)` already fits the view. The argument order is target, root, options.
- `mm.setTree(root, options)` updates data. `mm.destroy()` releases the view and leaves the `<svg>` element in place.
- The `<svg>` needs a non-zero CSS box and no `viewBox`.
- The toolbar must live in the same document as the map so it can use the map's `--mm-*` tokens.
- `colorScheme` accepts `light`, `dark`, or `auto`. Pass the host mode explicitly; `auto` follows the OS, not OpenChamber.
- Paragraphs become notes in a popover; headings and list items become branches.

## Reference

- OpenChamber SDK: `@openchamber/sdk` 2.7.1. Local reference checkout: `/Users/id/Projects/oss/openchamber`.
- Markmap: <https://markmap.js.org/> and <https://github.com/markmap/markmap>.
- Requirement tree: `docs/requirements.md`.
- Process: `docs/process/sdlc.md`, `docs/process/testing.md`, `docs/process/bugs.md`.
