# Use Markmap for OpenChamber

For a first map, see the [README quick start](../README.md#quick-start).

## Installation

In OpenChamber 2.7.1 or newer, open **Settings → Extensions** and add a Git URL:

- Stable: `https://github.com/devgears-pro/openchamber-markmap`
- Development preview: `https://github.com/devgears-pro/openchamber-markmap#dev`
- Pinned release: `https://github.com/devgears-pro/openchamber-markmap#vX.Y.Z`, with `vX.Y.Z` replaced by a [release tag](https://github.com/devgears-pro/openchamber-markmap/releases).

The installs share an extension ID. Remove the current install before switching. Use **Check for updates** to find a new version for a Git install. Local folder installs do not update automatically. Remove any other Markmap editor that claims the same file names.

## Supported files

OpenChamber opens these file-name patterns with Markmap:

- `*.markmap.md`
- `*-markmap.md`
- `*.mm.md`
- `*-mm.md`
- `*.mindmap.md`
- `*-mindmap.md`

Other Markdown files, including a plain `*.md`, stay in OpenChamber's source editor.

## Markdown map and graph data

Headings and list items become map branches. Paragraphs become notes on a node.

The toolbar can switch between `tree`, `two-sided`, and `org-chart` layouts. A file without `markmap.layout` opens as a two-sided map. In an editable map, choosing a layout saves `markmap.layout` in frontmatter. The default theme is `soft`. Set `markmap.theme` to `classic`, `cards`, `minimal`, or `soft` to choose a theme. Other Markmap frontmatter options, including `foldLevel` and `colorDepth`, remain available.

### Node identities, relationships, and groups

Add a trailing HTML comment to a heading or list-item line to give that node a stable identity:

```markdown
- Design <!-- ^d1 -->
```

An identity is one to three case-sensitive letters or digits. Keep it as the last token on the node line. A graph reference must use the identity. The root has the implicit identity `root`.

One root-level graph comment can store relationships and named groups:

```markdown
# Launch plan

## Build

- Design <!-- ^d1 -->
- Test <!-- ^t1 -->

<!-- markmap: graph
edges:
  - from: d1
    to: t1
    label: informs
groups:
  - roots: [d1, t1]
    label: Delivery
-->
```

`edges` connects identities with optional labels. Each entry in `groups` encloses one or more non-overlapping subtrees. Omit the graph block when the map has no relationships or groups.

The convention validator flags malformed, duplicate, or dangling graph data without blocking rendering or rewriting the file. The editor keeps graph references consistent when nodes are renamed, moved, copied, or deleted.

### Create and edit graph controls

In an editable map, select a node and drag its connection handle to another node to create a directed relationship. Click an arrow to select it. Press **Enter** to edit its label. Press **Delete** or **Backspace** to remove it. Relationship paths prefer clear routes around visible nodes and adapt to layout changes and folding.

Choose **Create group** to draw a boundary around the selected subtree or selected contiguous siblings. Click its border or label to select it. Press **Enter** or double-click to edit the label. Delete a selected boundary to remove the group while keeping its nodes.

A saved group boundary and a temporary sibling selection are separate controls. Use Cmd/Ctrl-click to toggle a sibling or Shift-click to select a sibling range.

## Editing and keyboard shortcuts

| Action                                      | Input                          |
| ------------------------------------------- | ------------------------------ |
| Select a node                               | Click                          |
| Edit a label                                | Space or double-click          |
| Add a sibling                               | Enter in selection mode        |
| Commit a label                              | Enter while editing            |
| Add a child                                 | Tab in selection mode          |
| Commit and add a child                      | Tab while editing              |
| Outdent                                     | Shift+Tab                      |
| Select or clear a sibling                   | Cmd/Ctrl-click                 |
| Select a sibling range                      | Shift-click                    |
| Move a branch or selected siblings          | Drag a node                    |
| Move selected siblings                      | Cmd/Ctrl+Shift+Up or Down      |
| Make a node a child of its previous sibling | Cmd/Ctrl+Shift+Left            |
| Move a node after its parent                | Cmd/Ctrl+Shift+Right           |
| Delete a subtree or selected siblings       | Delete or Backspace            |
| Copy, cut, or paste the primary node        | Cmd/Ctrl+C, X, or V            |
| Fold or unfold a subtree                    | Cmd/Ctrl+/                     |
| Undo or redo                                | Cmd/Ctrl+Z or Shift+Cmd/Ctrl+Z |
| Cancel editing                              | Escape                         |
| Pan the map                                 | Scroll or trackpad             |
| Zoom around the pointer                     | Cmd/Ctrl+scroll                |

After committing a label, the node stays selected. Press **Enter** again to add a sibling. Shift+Enter inserts a line break in a list item. The editor keeps the file as Markdown and preserves untouched source.

The toolbar switches layouts, sets markers, opens notes, and fits or resets the view. In an editable map, changing the layout saves `markmap.layout` in frontmatter; in a read-only map, it updates the view only.

## Notes and markers

The note dot opens a rendered note. Choose **Edit notes** to edit it as Markdown. A note is stored in a `markmap-note` fenced block under its node. Older paragraph notes remain readable and convert to a block when edited.

The marker menu adds status, priority, progress, and flag markers to a node label. Markers stay in the Markdown source as plain Unicode text. GFM checkboxes still render.

## Mindmaps in chat

The extension contributes a `Mindmap` block that takes a complete Markmap document in its `markdown` argument:

````markdown
```openui-lang
root = Stack([plan])
plan = Mindmap("# Release\n## Product\n- Editor\n## Delivery\n- Docs")
```
````

The block renders a fitted, read-only map with the host theme. It supports pan and zoom inside its frame, but has no editing controls or file access. Open a matching file in Files to edit its Markdown.

## Privacy

The host passes the extension only the file opened in Files. The extension has no file-system permissions, settings, or telemetry, and it makes no network requests.
