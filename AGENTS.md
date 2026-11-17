# Agent guide

Markmap for OpenChamber is an OpenChamber file editor that renders and edits Markmap Markdown as an editable mind map. It is an adaptation of the open-source Markmap library. English is the repository language for code, tests, docs, commits, test names, issues, milestones, release notes, and PR titles. Chat replies follow the user's language.

## Start

Read the process first, before anything else: `docs/process/sdlc.md`, `docs/process/testing.md`, `docs/process/bugs.md`, and `docs/process/releases.md`. They own the workflow; this file owns the rules and facts no process page carries.

Then read, in this order:

1. `README.md` and `docs/requirements.md` for the product and the contract.
2. `package.json` for scripts and the OpenChamber manifest.
3. The issue or task, all its comments, the linked decision, and the pull request when they exist. `gh issue view <n> --comments` and `gh pr view <n> --comments` show the full thread.
4. The code and tests in the area you change.
5. `vendor/markmap/README.md` and the fork branch when the change reaches the fork.

Read the full issue and comments, not only the title. If a file, issue, or decision is missing, say what is missing before you act.

Keep docs minimal and single-owner: `AGENTS.md` carries agent-specific rules and pointers; product contracts and workflows live in their canonical `docs/` files and are linked, not repeated.

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
bun run benchmark
bun run screenshots
bun run build
bun run verify
bunx openchamber-guest-check
```

`bun run verify` is the merge gate; [`docs/process/sdlc.md`](docs/process/sdlc.md) lists the gates.

## Architecture

- `src/main.ts`: `connectHost()` and mount.
- `src/app.ts`: host wiring, save tracking, snapshot, theme updates, lifecycle.
- `src/chat/block.ts`: host wiring for the read-only chat block: the `onBlock` call, theme updates, notice, and teardown.
- `src/markmap/view.ts`: the only editor module that creates the editable Markmap instance, toolbar, and editor. It parses Markdown with `parseDocument` and destroys them on file change and dispose.
- `src/markmap/preview.ts`: the read-only Markmap for the chat block; shares the view options with the editor.
- `src/markmap/`: the options, layouts, gestures, zoom, clipboard, markers, toolbar items, and errors used by the editor and preview.
- `src/ui/`: the layout, marker, and notes menus, and the toolbar icons.
- `src/ui/styles.ts`, `src/chat/styles.ts`: injected stylesheets, host tokens only.
- `vendor/markmap/`: vendored `core`, `parse`, `model`, `edit`, `edit-dom`, and `render` packages from the editable fork. Their source branch is in `vendor/markmap/README.md`.
- `editor/`: installable editor entry: `index.html` and the built `main.js`.
- `chat/`: installable chat block entry: `index.html` and the built `main.js`.
- `dev/`: Vite harness, synthetic samples, and host theme tokens for screenshots.
- `tmp/`: generated screenshots from `bun run screenshots`; do not commit.
- `tests/`: Vitest unit and DOM tests plus Playwright acceptance tests.
- `benchmarks/`: the standalone Playwright performance benchmark; it reports p50 and p95 and is not a CI gate.
- `scripts/`: requirement traceability and reproducible-build checks.

The host owns the file. The editor receives text through `onFileOpen`, returns the current Markdown through `onFileSnapshot`, and reports dirty state through `reportFileChange`. Nodes are edited directly on the map; there is no Markdown sidebar, custom parser, layout engine, serializer, or palette in `src/`.

## Non-negotiables

- Keep extensions in the fork; `src/` is host wiring and UI.
- Clipboard behavior is DOM `copy`, `cut`, and `paste` events plus a hidden textarea sink; the fork's `insertBlock` carries a block of Markdown. Do not add `navigator.clipboard` or a host clipboard read.
- Files stay readable Markdown; any convention is documented, validator-checked, and rendered by the fork.
- Keep `contributes.fileEditors.match` narrow. The six suffixes in `package.json` are the product decision; never claim `*.md`.
- An open label reports each valid draft as the saveable text before the first snapshot, so a clean file becomes dirty while the field keeps focus; the committed document still arrives through `onSource`. Notes keep the snapshot-driven path: they do not report drafts, and a note is committed when the host requests a snapshot. `onFileSnapshot` returns the current Markdown or the original bytes and a content-derived version without exiting edit mode or moving focus. An unchanged text file round-trips byte-for-byte.
- Report edits with `createFileSaveTracker`: `observe` on source change, `markSaved` on `onFileSaved`.
- A binary file or a Markmap failure must call `reportFileUnsupported()` so OpenChamber can show the source view.
- Use the vendored `@markmap/model`, `@markmap/render`, `@markmap/edit`, `@markmap/edit-dom`, and `@markmap/view`, plus the published `@markmap/toolbar`. Do not copy their logic into `src/`.
- The host theme wins over `markmap.colorScheme` from frontmatter. Keep the map readable in both modes.
- The map is the only editing surface. Read-only files render without `MarkmapEditor`. Notes use the fork's panel and one `markmap-note` fenced block under the node; the dot popover stays read-only.
- Unmodified wheel events pan by screen pixels, coalesced once per animation frame; line/page deltas use 40/800, and Shift maps vertical to horizontal. Cmd/Ctrl + wheel zooms with clamped deltas. The custom gesture layer is in `src/markmap/gestures.ts`.
- A node click selects the node, draws the selection frame, highlights its SVG group, and focuses the editor surface. Enter and Tab act on the selection.
- A node drag lives in the fork: a 4 px press lifts a clone of the subtree, one line or one frame shows the drop, and the drop runs one `move` command and one history entry. Escape and empty space cancel. No touch drag, no HTML5 drag and drop, no coordinates in the file.
- The root comes from the file. A lone top-level heading at H1-H6 is the root in place even when frontmatter has a `title`; the title is the fallback root only when no such heading exists. A synthetic root without a top-level H1 or a title root without a heading child inserts one H1 above the body with every original block as a child; a source root and a title root with any heading child refuse that insertion with a notice. New branches use heading markers only at H1 and H2: a child of an H1 root or heading becomes H2, a child of an H2-H6 heading becomes a list item, an H1 or H2 sibling stays a heading at the same level, and an H3-H6 sibling becomes a list item under the same parent heading. Existing H3-H6 headings stay readable and editable in place. An empty editable document accepts a first heading: typing on an empty selected node enters editing with the first character, a non-empty selected node remains selection-only, and the heading marker is written when a label is committed, while an autosave snapshot can already include the draft heading without ending the session. An empty file stays byte-for-byte unchanged until a draft or commit writes it, and a read-only empty file stays blank.
- New nodes use a zero-width placeholder, passed as `placeholder: '\u200B'`. A truly empty nested list item is dropped by the parser.
- Destroy the editor, Markmap view, toolbar, listeners, and DOM on file change and dispose.
- Do not add `any`, type assertions, non-null assertions, `@ts-*` comments, or inline `eslint-disable` comments anywhere. `as const` is allowed; every other `as` is not. ESLint runs the strict type-aware preset over `src`, `tests`, `dev`, `scripts`, and the config files.
- Do not write comments in code. Tests and docs carry the explanation.
- `editor/main.js` and `chat/main.js` are committed. Rebuild both and keep the stale-bundle check green.
- The chat block is read-only. It parses the `markdown` argument and draws a fitted map; it never edits, saves, answers, or reads a file.

## Cleanup

Before the final reply:

- Remove what this task created: temporary files, screenshots, fixtures, test output, local branches, and worktrees.
- Keep the working tree clean.
- Leave files, branches, and worktrees owned by other people or sessions.
- If something must stay, list it in the chat report with its path and purpose.

## Markmap facts

- `parseDocument(markdown)` from `@markmap/model` returns `{ document, tree, frontmatter }`. The tree carries `source.label` and `source.block` ranges used by the editor.
- `new MarkmapEditor({ source, view: createEditView(mm), container, onChange, onDraftChange, onError })` adds selection, keyboard, overlay editing, and history over a live `Markmap`. `onDraftChange` carries the saveable label draft and `onChange` the committed document; `snapshot()` reads a label draft without emitting, while a note snapshot commits the note. It exposes `selectedBlock()`, `insertBlock(text)`, `insertLabel(text)`, and `deleteSelected()` for host clipboard actions; `selectedBlock()` synthesizes a title root as a level-one heading plus its child blocks and keeps notes above a promoted root; `insertBlock` reattaches those intro notes to a pasted promoted root, re-levels headings and list indents to the child depth, and converts a heading subtree to list items under a list item.
- Apply `frontmatter.markmap` with `resolveViewOptions(base, input)`. The result includes warnings for unknown keys.
- `Markmap.create(svg, root, options)` fits the view. A file map then moves to 100% within the map's scale limits: a drawing that fits is centered, a larger two-sided map centers the root, a larger tree starts at the left, and a larger org chart at the top. The chat block stays fitted. The extension caps `fitMaxScale` at 1, so Fit does not magnify past 100% unless frontmatter overrides the cap. The argument order is target, root, options.
- The map toolbar's Reset view does the same for the root, or centers the selected node, and returns focus to the editor. A read-only map uses the root. Fit still shows the whole map.
- `mm.setOptions({ ...mm.options, colorScheme })` redraws without replacing the tree or editor history.
- The `<svg>` needs a non-zero CSS box and no `viewBox`.
- The toolbar must live in the same document as the map so it can use the map's `--mm-*` tokens.
- `colorScheme` accepts `light`, `dark`, or `auto`. Pass the host mode explicitly; `auto` follows the OS, not OpenChamber.
- A `markmap-note` fenced block under a node is an isolated Markdown note; a paragraph renders as a legacy note. Headings and list items become branches. The view exposes no notes editing API; the fork's `@markmap/edit-dom` owns the notes panel.
- `@markmap/render` provides `tree`, `two-sided`, and `org-chart`; frontmatter key `markmap.layout` selects one. The view passes no custom layout resolver today.
- `colorDepth` replaced the legacy `colorFreezeLevel` from Markmap 0.18.
- The vendored `soft` theme is the default when frontmatter has no theme. It resolves per-node font, fill, and padding before text measurement, and the editor overlay reads the same resolved label style. Explicit `theme`, `color`, and `colorDepth` values still win.

## Reference

- OpenChamber SDK: `@openchamber/sdk`. An OpenChamber source checkout is useful for reference but is not part of this repository.
- Markmap: <https://markmap.js.org/> and <https://github.com/markmap/markmap>.
- Editable fork: <https://github.com/mmospanenko/markmap/tree/dev>.
- Requirement tree: `docs/requirements.md`.
- Screenshots: `tmp/`, generated by `tests/screenshots/docs.spec.ts` from synthetic `dev/showcase.md`; upload them to GitHub, do not commit them.
