# OpenChamber Markmap

An OpenChamber extension that opens Markmap Markdown files as an editable mind map in the Files view. Nodes are edited directly on the map with XMind-style keys; there is no Markdown sidebar.

The extension is a `contributes.fileEditors` package. It uses the vendored Markmap v1.1.1 fork for the editable model and keyboard layer, plus [`@markmap/view`](https://www.npmjs.com/package/@markmap/view) and [`@markmap/toolbar`](https://www.npmjs.com/package/@markmap/toolbar). The repository contains no custom Markdown parser, layout engine, or serializer.

## File patterns

OpenChamber matches editors by file name. This package claims only these suffixes:

- `*.markmap.md`
- `*-markmap.md`
- `*.mm.md`
- `*-mm.md`
- `*.mindmap.md`
- `*-mindmap.md`

A normal `*.md` file stays in OpenChamber's source editor.

## Install

Add this folder in **Settings → Extensions → Add**:

```text
/Users/you/Projects/openchamber-markmap
```

Or install from Git in the app:

```text
openchamber://extensions/install?url=https%3A%2F%2Fgithub.com%2Fmmospanenko%2Fopenchamber-markmap
```

The folder must contain `package.json` and `editor/index.html`. The tracked `editor/main.js` is the built classic script.

## Behavior

- The file opens as a Markmap with zoom, pan, fold, and fit controls from the library.
- Click a node to select it. A frame marks the selection. Enter adds a sibling, Tab adds a child, Shift+Tab outdents, F2 or Space edits the label, Delete removes the subtree, and Escape cancels.
- New nodes start with an empty label. A zero-width marker keeps the node in Markdown, because a truly empty nested list item is dropped by the parser.
- Edits change only the affected Markdown ranges. Frontmatter, formatting, inline Markdown, and line endings survive.
- The map follows the OpenChamber light or dark theme. A `markmap.colorScheme` value in frontmatter does not override the host theme.
- Markmap options under `markmap:` in YAML frontmatter, such as `theme`, `layout`, and `foldLevel`, are applied through `resolveViewOptions`.
- Saving returns the current Markdown. An unchanged file returns the original text; binary input returns its original bytes.
- The host autosaves through `reportFileChange` and `onFileSaved`.
- Read-only files render without the node editor.
- Binary input and Markmap failures send the file to OpenChamber's source view.

## Development

```bash
bun install
bun run dev
bun run verify
bun run test:acceptance
```

`bun run dev` starts the Vite harness at `/dev/` with `dev/sample.md`.

`bun run verify` runs typecheck, lint, requirement traceability, build, stale-bundle check, reproducible build check, and the 100% coverage gate. Acceptance tests use Playwright against the real Markmap renderer.

`editor/main.js` is committed. Run `bun run build` after changing `src/` and keep `bun run check:bundle-fresh` green.

The editable Markmap packages are vendored from the fork in `vendor/markmap`; see [`vendor/markmap/README.md`](vendor/markmap/README.md).

## Quality workflow

The process is documented in:

- [`docs/process/sdlc.md`](docs/process/sdlc.md) — change lifecycle and gates.
- [`docs/process/testing.md`](docs/process/testing.md) — test levels and coverage.
- [`docs/process/bugs.md`](docs/process/bugs.md) — failing test first.
- [`docs/requirements.md`](docs/requirements.md) — requirement tree and traceability.

Every behavior change starts with a requirement and a test. Every bug starts with a failing regression test. `bun run verify` is the local merge gate; CI runs the same commands.

## License

MIT. See [`LICENSE`](LICENSE).
