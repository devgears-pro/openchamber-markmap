# Requirements

The tree is the contract for this extension. Every requirement has an ID, and every ID appears in at least one automated test name. `bun run check:requirements` fails when an ID is missing, unknown, or unused.

## Product

### R-01 Manifest

The package declares one `contributes.fileEditors` entry with id `markmap`, title `Markmap`, the six supported file-name patterns, a text entry, and a valid icon. It parses with the OpenChamber manifest schema.

### R-02 Render

A matching text file opens as an interactive Markmap. The renderer receives the file text unchanged, mounts the Markmap toolbar, and shows the map in the stage. Rendering uses `@markmap/parse`, `@markmap/view`, and `@markmap/toolbar`; this repository contains no custom Markdown parser or layout.

### R-03 Source sidebar

The original Markdown is shown read-only beside the map. The sidebar has an accessible name, scrolls independently, and hides for binary input.

### R-04 Theme

The map uses the host theme mode (`light` or `dark`), not a color scheme from file frontmatter. A host theme change redraws the existing view without recreating it.

### R-05 Snapshot fidelity

`onFileSnapshot` returns the original text or bytes and a stable version. Opening a file and saving it without edits cannot change its content.

### R-06 Unsupported fallback

Binary input and Markmap failures report the file as unsupported so OpenChamber can switch to the source view. The snapshot still returns the original content.

### R-07 Lifecycle

The previous view is destroyed when another file opens and when the editor disposes. The Markmap instance, toolbar, listeners, and DOM are released.

## Engineering

### R-08 Bundle

`editor/index.html` loads one classic script. `editor/main.js` is a self-contained IIFE without top-level module syntax and stays under the bundle budget.

### R-09 Deterministic output

The same source and lockfile produce the same bundle. Snapshot versions depend only on content. `bun run check:reproducible` builds twice and compares the bytes.

### R-10 Accessibility

The map exposes an image role and a name, the source sidebar exposes its name, and the Markmap toolbar keeps labelled controls.

## Traceability

| Requirement | Tests                                                         |
| ----------- | ------------------------------------------------------------- |
| R-01        | `tests/manifest.test.ts`                                      |
| R-02        | `tests/app.test.ts`, `tests/markmap-view.test.ts`, acceptance |
| R-03        | `tests/app.test.ts`, `tests/styles.test.ts`, acceptance       |
| R-04        | `tests/app.test.ts`                                           |
| R-05        | `tests/app.test.ts`                                           |
| R-06        | `tests/app.test.ts`                                           |
| R-07        | `tests/app.test.ts`, `tests/markmap-view.test.ts`             |
| R-08        | `tests/bundle.test.ts`                                        |
| R-09        | `tests/app.test.ts`, `scripts/check-reproducible.ts`          |
| R-10        | `tests/app.test.ts`, acceptance                               |
