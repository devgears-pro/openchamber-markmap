# Vendored Markmap fork

These packages come from the Markmap fork:

- Source: <https://github.com/mmospanenko/markmap>
- Branch: `dev`, commit `edbfa70`

The fork adds `@markmap/model`, `@markmap/edit`, and `@markmap/edit-dom`, extends `@markmap/parse` and the `@markmap/core` types with source ranges, scales the overlay field with the map zoom, draws a selection frame, supports zero-width empty labels, sizes, centers, and frames the edit field from its text, reveals newly inserted nodes, reports each valid label draft through `onDraftChange` before the first snapshot, keeps `onChange` for committed edits, and publishes the baseline when a label session is cancelled, lost or switched without a duplicate event. A label snapshot is a pure read: it returns the last saveable draft without emitting or committing, while a note snapshot still commits the open note; notes do not emit `onDraftChange` and stay on the snapshot-driven path. Label previews are drawn at most once per animation frame, and a commit reuses the validated preview result and skips a tree render the view already shows. The fork records a completed label session as one undo entry, counts content nodes separately from a synthetic or title root, promotes a lone top-level heading at H1-H6 to the root even when a non-empty frontmatter `title` exists, uses the title as the fallback root label only when no promotion happens, allows root creation for a synthetic root without a top-level H1 and for a title root without heading children, exposes the root policy and the `createRootHeading` command, caps new branches at H2: a child of an H1 root or heading becomes H2, a child of an H2-H6 heading and a sibling of an H3-H6 heading become list items, while H1 and H2 siblings keep their heading level and existing H3-H6 headings stay editable in place, separates a created H1 from the following body with one blank line, preserves whitespace-only input when it creates that heading, moves a node and its subtree by pointer or keyboard, pastes a Markdown block as a child with heading levels and list indents re-leveled, pastes a copied promoted root with its intro notes attached only when the prefix is exactly those notes, rejects any other prefix without changing the document, converts a heading subtree to list items under a list item, copies a title or promoted root as a heading with its notes and child blocks, and edits notes in one `markmap-note` fenced block under the node with legacy paragraph migration. Review fixes keep BOM offsets aligned before transformer plugins run, support Setext roots and an empty ATX heading with CRLF, report every draft version so the host save tracker can distinguish a newer draft from an older saved version, and treat a command whose source is unchanged as a no-op with no history entry, no committed change, and no redo loss. The view and toolbar stay on the published packages; the renderer is vendored with the soft theme changes.

The vendored render package adds the soft tree theme, per-node label metrics, and tapered root edges. The renderer, view, toolbar, and built-in themes otherwise start from upstream.

Vendored packages:

- `core`: types with `source` ranges, notes, and resolved label styles.
- `parse`: parser that promotes a lone H1-H6 heading, reports title presence and body start, and emits `source.label`, `source.block`, and note ranges.
- `model`: editable document projection with root policy, content node count, note ranges, and validator.
- `edit`: source-preserving commands, including `move`, `setNotes`, and `createRootHeading`.
- `edit-dom`: selection, keyboard, pointer move, overlay field, notes panel, draft-change channel, snapshots, and history.
- `render`: the soft theme, per-node label metrics, tapered root edges, and the upstream layouts and themes.

Migration from the earlier fork drop:

- `commitForSnapshot` is `snapshot`.
- `insertFirst` is `createRootHeading`.
- `buildFromTree` requires a `DocumentMeta` argument.
- Wire `onChange` for committed documents and `onDraftChange` for label drafts.

Only `dist` is copied. Run `pnpm verify` in the fork before copying `dist`. Do not copy a partial build. Then copy `dist` again when the fork changes. The vendored `package.json` stays on the published `@markmap/view`.

The vendored packages are MIT licensed. See [`LICENSE`](LICENSE).
