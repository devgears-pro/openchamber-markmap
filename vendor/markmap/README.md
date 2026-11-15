# Vendored Markmap fork

These packages come from the local Markmap fork:

- Source: <https://github.com/mmospanenko/markmap>
- Branch: `feat/editable-model`
- Base: Markmap `v1.1.1`

The fork adds `@markmap/model`, `@markmap/edit`, and `@markmap/edit-dom`, extends `@markmap/parse` and the `@markmap/core` types with source ranges, scales the overlay field with the map zoom, draws a selection frame, supports zero-width empty labels, sizes, centers, and frames the edit field from its text, reveals newly inserted nodes, and commits an in-progress label before a host snapshot. The renderer, view, and toolbar are unchanged and stay on the published `1.1.1` packages.

Vendored packages:

- `core` — types with `source` ranges.
- `parse` — parser that emits `source.label` and `source.block`.
- `model` — editable document projection and validator.
- `edit` — source-preserving commands.
- `edit-dom` — selection, keyboard, overlay field, and history.

Only `dist` is copied. Build the fork first with `pnpm verify` or `pnpm build`, then copy `dist` again when the fork changes. The vendored `package.json` stays on the published `@markmap/view`.

The vendored packages are MIT licensed. See [`LICENSE`](LICENSE).
