# Vendored Markmap fork

These packages come from the Markmap fork:

- Source: <https://github.com/mmospanenko/markmap>
- Branch: `feat/editable-model`

The fork adds `@markmap/model`, `@markmap/edit`, and `@markmap/edit-dom`, extends `@markmap/parse` and the `@markmap/core` types with source ranges, scales the overlay field with the map zoom, draws a selection frame, supports zero-width empty labels, sizes, centers, and frames the edit field from its text, reveals newly inserted nodes, commits an in-progress label before a host snapshot, pastes a Markdown block as a child with heading levels and list indents re-leveled, converts a heading subtree to list items under a list item, copies a title root as a heading with its child blocks, and edits notes in one `markmap-note` fenced block under the node with legacy paragraph migration. The renderer, view, and toolbar are unchanged and stay on the published packages.

Vendored packages:

- `core`: types with `source` ranges, including notes.
- `parse`: parser that emits `source.label`, `source.block`, and note ranges.
- `model`: editable document projection with note ranges and validator.
- `edit`: source-preserving commands, including `setNotes`.
- `edit-dom`: selection, keyboard, overlay field, notes panel, and history.

Only `dist` is copied. Run `pnpm verify` in the fork before copying `dist`. Do not copy a partial build. Then copy `dist` again when the fork changes. The vendored `package.json` stays on the published `@markmap/view`.

The vendored packages are MIT licensed. See [`LICENSE`](LICENSE).
