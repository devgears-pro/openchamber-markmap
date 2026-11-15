# Requirements

The tree is the contract for this extension. Every requirement has an ID, and every ID appears in at least one automated test name. `bun run check:requirements` fails when an ID is missing, unknown, or unused.

## Product

### R-01 Manifest

The package declares one `contributes.fileEditors` entry with display name `Markmap`, id `markmap`, editor title `Markmap`, the six supported file-name patterns, a text entry, and a valid icon. It parses with the OpenChamber manifest schema.

### R-02 Render

A matching text file opens as an interactive Markmap. The renderer receives the file text unchanged, mounts the Markmap toolbar, and shows the map in the stage. A small map opens at 100% instead of being magnified; a map larger than the viewport is fitted to it, and `markmap.fitMaxScale` in frontmatter can override the cap. Rendering uses the vendored `@markmap/model` and `@markmap/edit-dom` over `@markmap/view` and `@markmap/toolbar`; `src/` contains no custom Markdown parser, layout, or serializer. Extensions to parsing, layout, and rendering live in the vendored fork.

### R-03 Node selection

A matching file opens with the root selected. A left click selects a node, draws a frame around it, highlights its SVG group, and focuses the editor surface so Enter and Tab act on that node. The focused surface draws no browser focus ring; the selection frame is the only focus mark.

### R-04 Theme

The map uses the host theme mode (`light` or `dark`), not a color scheme from file frontmatter. A host theme change redraws the existing view without recreating it.

### R-05 Snapshot fidelity

`onFileSnapshot` returns the current Markdown or the original bytes and a content-derived version. An in-progress node label is committed first, so a save during editing cannot lose text. Saving unchanged text returns the same bytes as the opened file, and a read-only file cannot be changed.

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

The map exposes an image role and a name, and the Markmap toolbar keeps labelled controls.

### R-11 Keyboard editing

Enter inserts a sibling, Tab a child, Shift+Tab outdents, Delete removes the selected subtree, F2 or Space edits the label, and Escape cancels. New nodes start with an empty label; a zero-width marker keeps them in the parsed tree. Edits change only the affected Markdown ranges. Each successful command reports `{ dirty: true, edited: true }`, becomes the next snapshot, and a saved version clears the dirty flag.

### R-12 Read-only files

A file marked read-only renders the map without the node editor. Its snapshot stays byte-for-byte equal to the opened file.

### R-13 Editor errors

An invalid command, such as a line break in a heading label, keeps the document unchanged and shows a non-blocking notice. The notice clears on the next successful edit.

### R-14 Wheel navigation

An unmodified wheel or trackpad gesture pans the map without changing its scale. Line and page deltas are normalized, Shift maps vertical wheel input to horizontal, and a wheel burst is applied once per animation frame. A wheel with Cmd or Ctrl zooms around the pointer with clamped deltas.

### R-15 Keyboard navigation and history

Arrow keys move the selection between related nodes. Typing a printable character opens the label field with that character appended to the selected label. Cmd/Ctrl+Z undoes an edit, Shift+Cmd/Ctrl+Z redoes it, and Cmd/Ctrl+/ folds the selected subtree.

### R-16 New files

An empty text file that matches a Markmap suffix opens with an editable first node. Typing a label creates a heading, so the first save produces valid Markmap Markdown without losing frontmatter. A read-only empty file stays blank and exposes no editor field.

### R-17 External links

Clicking an http(s) link in a node asks the host to open it and never navigates the editor frame. Non-http links are ignored. The editor asks for no new host capability.

### R-18 Node markers

An editable map offers a marker menu grouped by status, priority, progress, and flags. Choosing a marker replaces an existing leading marker on the selected node and preserves the rest of the label. Read-only maps show no marker menu. Markers are plain Unicode characters in the Markdown source.

## Traceability

| Requirement | Tests                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| R-01        | `tests/manifest.test.ts`                                                                                            |
| R-02        | `tests/app.test.ts`, `tests/markmap-view.test.ts`, acceptance                                                       |
| R-03        | `tests/markmap-view.test.ts`, acceptance                                                                            |
| R-04        | `tests/app.test.ts`, acceptance                                                                                     |
| R-05        | `tests/app.test.ts`, `tests/markmap-view.test.ts`                                                                   |
| R-06        | `tests/app.test.ts`                                                                                                 |
| R-07        | `tests/app.test.ts`, `tests/markmap-view.test.ts`                                                                   |
| R-08        | `tests/bundle.test.ts`                                                                                              |
| R-09        | `tests/app.test.ts`, `scripts/check-reproducible.ts`                                                                |
| R-10        | acceptance                                                                                                          |
| R-11        | `tests/app.test.ts`, `tests/markmap-view.test.ts`, acceptance                                                       |
| R-12        | `tests/app.test.ts`, `tests/markmap-view.test.ts`, acceptance                                                       |
| R-13        | `tests/app.test.ts`, `tests/markmap-view.test.ts`, acceptance                                                       |
| R-14        | `tests/gestures.test.ts`, acceptance                                                                                |
| R-15        | acceptance                                                                                                          |
| R-16        | `tests/markmap-view.test.ts`, acceptance                                                                            |
| R-17        | `tests/markmap-view.test.ts`, `tests/app.test.ts`                                                                   |
| R-18        | `tests/markers.test.ts`, `tests/marker-menu.test.ts`, `tests/app.test.ts`, `tests/markmap-view.test.ts`, acceptance |
