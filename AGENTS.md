# Agent guide

Markmap for OpenChamber is an OpenChamber file editor that renders and edits Markmap Markdown as an editable mind map. It is an adaptation of the open-source Markmap library. English is the repository language for code, tests, docs, commits, test names, issues, milestones, release notes, and PR titles. Chat replies follow the user's language.

## Start

Read these before changing code, in this order:

1. `AGENTS.md`, `README.md`, and `docs/requirements.md` for the rules, the product, and the contract.
2. `docs/process/sdlc.md`, `docs/process/testing.md`, `docs/process/bugs.md`, and `docs/process/releases.md` for the workflow.
3. `package.json` for scripts and the OpenChamber manifest.
4. The issue or task, all its comments, the linked decision, and the pull request when they exist. `gh issue view <n> --comments` and `gh pr view <n> --comments` show the full thread.
5. The code and tests in the area you change.
6. `vendor/markmap/README.md` and the fork branch when the change reaches the fork.

Read the full issue and comments, not only the title. If a file, issue, or decision is missing, say what is missing before you act.

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
bun run screenshots
bun run build
bun run verify
bunx openchamber-guest-check
```

`bun run verify` is the merge gate. It runs typecheck, lint, requirement traceability, build, stale-bundle check, reproducible build check, and the 100% coverage gate.

## Architecture

- `src/main.ts`: `connectHost()` and mount.
- `src/app.ts`: host wiring, save tracking, snapshot, theme updates, lifecycle.
- `src/markmap/view.ts`: the only module that imports Markmap. It parses Markdown with `parseDocument`, creates the view, toolbar, and keyboard editor, and destroys them.
- `src/ui/styles.ts`: the injected stylesheet, host tokens only.
- `vendor/markmap/`: vendored `core`, `parse`, `model`, `edit`, and `edit-dom` packages from the editable fork. Their source branch is in `vendor/markmap/README.md`.
- `editor/`: installable package: `index.html` and the built `main.js`.
- `dev/`: Vite harness, synthetic samples, and host theme tokens for screenshots.
- `tmp/`: generated screenshots from `bun run screenshots`; do not commit.
- `tests/`: Vitest unit and DOM tests plus Playwright acceptance tests.
- `scripts/`: requirement traceability and reproducible-build checks.

The host owns the file. The editor receives text through `onFileOpen`, returns the current Markdown through `onFileSnapshot`, and reports dirty state through `reportFileChange`. Nodes are edited directly on the map; there is no Markdown sidebar, custom parser, layout engine, serializer, or palette in `src/`.

## Non-negotiables

- Keep extensions in the fork; `src/` is host wiring and UI.
- Clipboard behavior is DOM `copy`, `cut`, and `paste` events plus a hidden textarea sink; the fork's `insertBlock` carries a block of Markdown. Do not add `navigator.clipboard` or a host clipboard read.
- Files stay readable Markdown; any convention is documented, validator-checked, and rendered by the fork.
- Keep `contributes.fileEditors.match` narrow. The six suffixes in `package.json` are the product decision; never claim `*.md`.
- `onFileSnapshot` returns the current Markdown or the original bytes and a content-derived version. It includes an in-progress label without exiting edit mode or moving focus, so typing can continue after autosave. An unchanged text file round-trips byte-for-byte.
- Report edits with `createFileSaveTracker`: `observe` on source change, `markSaved` on `onFileSaved`.
- A binary file or a Markmap failure must call `reportFileUnsupported()` so OpenChamber can show the source view.
- Use the vendored `@markmap/model`, `@markmap/edit`, and `@markmap/edit-dom`, plus the published `@markmap/view` and `@markmap/toolbar`. Do not copy their logic into `src/`.
- The host theme wins over `markmap.colorScheme` from frontmatter. Keep the map readable in both modes.
- The map is the only editing surface. Read-only files render without `MarkmapEditor`.
- Unmodified wheel events pan by screen pixels, coalesced once per animation frame; line/page deltas use 40/800, and Shift maps vertical to horizontal. Cmd/Ctrl + wheel zooms with clamped deltas. The custom gesture layer is in `src/markmap/gestures.ts`.
- A node click selects the node, draws the selection frame, highlights its SVG group, and focuses the editor surface. Enter and Tab act on the selection.
- An empty editable document accepts a first heading. Typing on an empty selected node enters editing with the first character; a non-empty selected node remains selection-only. The editor writes the heading marker only when a label is committed; an empty file stays byte-for-byte unchanged until then. A read-only empty file stays blank.
- New nodes use a zero-width placeholder, passed as `placeholder: '\u200B'`. A truly empty nested list item is dropped by the parser.
- Destroy the editor, Markmap view, toolbar, listeners, and DOM on file change and dispose.
- Do not add `any`, type assertions, non-null assertions, `@ts-*` comments, or inline `eslint-disable` comments anywhere. `as const` is allowed; every other `as` is not. ESLint runs the strict type-aware preset over `src`, `tests`, `dev`, `scripts`, and the config files.
- Do not write comments in code. Tests and docs carry the explanation.
- `editor/main.js` is committed. Rebuild it and keep the stale-bundle check green.

## Workflow

1. Read `docs/requirements.md` and pick or add a requirement ID.
2. Write a failing test with `[R-xx]` in its name.
3. Implement the smallest change that makes it pass.
4. Run `bun run verify`, then `bun run test:acceptance` when rendering or layout changed.
5. Follow the presentation rule in `docs/process/releases.md` when the change is visual.
6. Rebuild `editor/main.js` and commit it with the source change.
7. Update docs and the requirement traceability table when behavior changes.
8. Post the chat report and complete the issue as defined in `docs/process/sdlc.md`.

Bugs follow the same path, with the regression test first. Every bug has an issue with reproduction proof. See `docs/process/bugs.md`.

## Cleanup

Before the final reply:

- Remove what this task created: temporary files, screenshots, fixtures, test output, local branches, and worktrees.
- Keep the working tree clean.
- Leave files, branches, and worktrees owned by other people or sessions.
- If something must stay, list it in the chat report with its path and purpose.

## Branches and releases

Feature and fix PRs target `dev`; only a release promotion merges into `main`. Release Please owns the version, tag, and draft release; do not edit `package.json` by hand. See `docs/process/releases.md`.

Worktrees, PR sync, fork changes, and issue closure follow `docs/process/sdlc.md`.

## Markmap facts

- `parseDocument(markdown)` from `@markmap/model` returns `{ document, tree, frontmatter }`. The tree carries `source.label` and `source.block` ranges used by the editor.
- `new MarkmapEditor({ source, view: createEditView(mm), container, onChange, onError })` adds selection, keyboard, overlay editing, and history over a live `Markmap`. It exposes `selectedBlock()`, `insertBlock(text)`, `insertLabel(text)`, and `deleteSelected()` for host clipboard actions; `selectedBlock()` synthesizes a title root as a level-one heading plus its child blocks, and `insertBlock` re-levels headings and list indents to the child depth and converts a heading subtree to list items under a list item.
- Apply `frontmatter.markmap` with `resolveViewOptions(base, input)`. The result includes warnings for unknown keys.
- `Markmap.create(svg, root, options)` already fits the view. The extension caps `fitMaxScale` at 1, so a small map opens at 100% and a large one is fitted; frontmatter can override the cap. The argument order is target, root, options.
- `mm.setOptions({ ...mm.options, colorScheme })` redraws without replacing the tree or editor history.
- The `<svg>` needs a non-zero CSS box and no `viewBox`.
- The toolbar must live in the same document as the map so it can use the map's `--mm-*` tokens.
- `colorScheme` accepts `light`, `dark`, or `auto`. Pass the host mode explicitly; `auto` follows the OS, not OpenChamber.
- Paragraphs become notes in a sanitized popover; headings and list items become branches. The view exposes no notes editing API.
- `@markmap/render` provides `tree`, `two-sided`, and `org-chart`; frontmatter key `markmap.layout` selects one. The view passes no custom layout resolver today.
- `colorDepth` replaced the legacy `colorFreezeLevel` from Markmap 0.18.

## Reference

- OpenChamber SDK: `@openchamber/sdk`. An OpenChamber source checkout is useful for reference but is not part of this repository.
- Markmap: <https://markmap.js.org/> and <https://github.com/markmap/markmap>.
- Editable fork: <https://github.com/mmospanenko/markmap/tree/feat/editable-model>.
- Requirement tree: `docs/requirements.md`.
- Process: `docs/process/sdlc.md`, `docs/process/testing.md`, `docs/process/bugs.md`, `docs/process/releases.md`.
- Screenshots: `tmp/`, generated by `tests/screenshots/docs.spec.ts` from synthetic `dev/showcase.md`; upload them to GitHub, do not commit them.
