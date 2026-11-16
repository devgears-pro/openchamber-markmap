# Markmap for OpenChamber

[![CI](https://github.com/mmospanenko/openchamber-markmap/actions/workflows/ci.yml/badge.svg)](https://github.com/mmospanenko/openchamber-markmap/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An OpenChamber file editor for Markmap Markdown. Open a `.markmap.md` file in Files and the outline becomes a mind map you can edit in place. Click a node, press Enter or Tab, type. The Markdown file stays the source of truth for Git, agents, and every other editor.

This is an adaptation of the open-source Markmap library, not an official Markmap project. Markmap renders the diagram, layout, view, toolbar, and themes. The editable fork adds the model, commands, and overlay editor that make the diagram editable in OpenChamber.

Roadmap: [what each release adds](https://github.com/mmospanenko/openchamber-markmap/issues/3). Releases: [all versions](https://github.com/mmospanenko/openchamber-markmap/releases).

![The Markmap editor in the dark theme](https://github.com/user-attachments/assets/c7a2fe0d-6e82-44c1-81c7-a9cba9f24e79)

## What you get

- **Edit on the map.** The map is the editing surface. There is no second Markdown pane and no separate model to keep in sync.
- **Keyboard first.** In selection mode, Enter adds a sibling and Tab a child. While editing, Enter commits and exits; the next Enter adds a sibling. Tab commits and adds a child. Space or a double click opens editing. Arrow keys move the selection without folding; typing on a non-empty selected node does nothing, while typing on an empty node starts editing.
- **Real Markmap.** Rendering, layout, folding, notes, the toolbar, and the viewport come from Markmap. The extension owns only the editing layer and the host contract.
- **Canvas navigation.** The map opens at 100% by default; a larger map is fitted to the window, and `fitMaxScale` in frontmatter can change the cap. Scroll or a trackpad surface pans the map; Cmd/Ctrl + scroll zooms around the pointer. Pan speed stays constant at every zoom level, and a wheel burst is applied once per frame.
- **Markdown fidelity.** An edit changes only the Markdown range it touches. Frontmatter, inline Markdown, untouched branches, and line endings survive. New nodes start with an empty label and stay in the tree through a zero-width marker.
- **New files.** An empty matching file opens in an editable state. Type the first label and save; it becomes a heading, and existing frontmatter is preserved.
- **Markers.** A toolbar menu adds status, priority, progress, and flag markers to a node label. GFM checkboxes still render, and every marker stays readable in the Markdown source.
- **Copy and paste.** Cmd/Ctrl+C and X take the selected subtree with its notes and markers, and Cmd/Ctrl+V puts a copy back as the last child of the selection. Headings renumber and list items reindent to the new depth.
- **Move a branch.** Drag a node to a new parent or a new place among its siblings. The subtree lifts with the pointer, a line or frame shows where it lands, and the map re-lays out once on drop. Escape cancels, undo is one step, and Cmd/Ctrl+Shift+arrow keys move a branch without the mouse.
- **Notes.** The note dot opens the rendered note. The Edit notes button opens a Markdown panel, and a note is one `markmap-note` fenced block under the node, so lists and headings stay inside it. Paragraph notes from other tools convert to a block on the first edit.
- **Theme aware.** The map follows the OpenChamber light or dark theme. Markmap options in frontmatter, such as `theme`, `layout`, `foldLevel`, and `colorDepth`, still apply.
- **Safe fallback.** Read-only files render without the editor. Binary input and Markmap failures send the file to OpenChamber's source view, and the original content stays intact.
- **Links stay safe.** Clicking an http(s) link in a node asks OpenChamber to open it in the browser. The editor frame never navigates away.

## Mind maps in chat

The extension also adds a `Mindmap` component to OpenChamber's UI block language. While it is active, an agent can put a whole Markmap document in a reply and the chat draws it as a read-only map:

````markdown
```openui-lang
root = Stack([plan])
plan = Mindmap("# Release 0.6\n## Editor\n- Layout switcher\n## Chat\n- Mind map block")
```
````

The map is fitted into a 480 px frame, follows the host light or dark theme, and pans and zooms inside its own frame. It has no toolbar, no editing, and no file access; open a Markmap file to change one. Only an assistant reply on screen draws the block, and VS Code loads no extensions, so there it stays source.

## Use cases

**Plans that live with the code.** Keep a release, architecture, or migration map next to the repository as `plan.markmap.md`. Humans edit it visually; agents read and write the same Markdown with their normal file tools.

**Working sessions.** Edit branches while a discussion is live: rename a workstream, add a child, delete a rejected branch. The map keeps the context visible.

**Agent handoff.** Ask an agent to produce a Markmap file for a plan or investigation, then open it in Files to review, restructure, and correct it without leaving OpenChamber.

**Existing Markmap notes.** Markmap files from other tools open without conversion. Frontmatter and inline formatting are preserved, so the file remains usable outside OpenChamber.

**Outline review.** Fit the map, fold finished branches, and navigate with the keyboard when a document grows past a screen. The source view is one toggle away for exact text edits.

**Read-only maps.** OpenChamber opens a read-only file as a map without editing.

## Screenshots

| Light theme                                                                                                                                                     | Editing a label in place                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <img src="https://github.com/user-attachments/assets/42a29687-19a5-431a-aa3b-a4d735547ed4" alt="Markmap editor in the light theme with a selected Design node"> | <img src="https://github.com/user-attachments/assets/5556c59f-088a-46d3-96b0-d3746d47cee0" alt="Editing the Private beta node label in an overlay field"> |

## Install

Requirements: an OpenChamber release with file editors, on desktop or web. File editors are not loaded in VS Code or the mobile app.

1. Open **Settings → Extensions**.
2. Paste the Git URL or the install link into the folder, ZIP, or URL field and choose **Add**.
3. There are no capabilities to approve; the host hands the editor one file at a time.

Stable: [https://github.com/mmospanenko/openchamber-markmap](openchamber://extensions/install?url=https%3A%2F%2Fgithub.com%2Fmmospanenko%2Fopenchamber-markmap)

Preview: [https://github.com/mmospanenko/openchamber-markmap#dev](openchamber://extensions/install?url=https%3A%2F%2Fgithub.com%2Fmmospanenko%2Fopenchamber-markmap%23dev)

Pinned release: [https://github.com/mmospanenko/openchamber-markmap#vX.Y.Z](openchamber://extensions/install?url=https%3A%2F%2Fgithub.com%2Fmmospanenko%2Fopenchamber-markmap%23vX.Y.Z)

Replace `X.Y.Z` with a tag from the Releases page.

The preview follows the `dev` branch. CI bumps its `version` on every push, so **Check for updates** sees it, and it may break. It replaces the stable install because both use the same extension id; remove it and add the plain URL to return to stable. A pinned tag stays on that tag.

A folder install runs from the folder you added and does not update itself.

A Git install updates when `version` in `package.json` changes. Open **Settings → Extensions** and choose **Update** on the card.

Remove or disable an older mind-map extension that claims the same file names before installing this one.

## File names

OpenChamber matches editors by file name. This package claims only these suffixes:

- `*.markmap.md`
- `*-markmap.md`
- `*.mm.md`
- `*-mm.md`
- `*.mindmap.md`
- `*-mindmap.md`

A normal `*.md` file stays in OpenChamber's source editor.

## Keyboard and gestures

| Action                               | Input                              |
| ------------------------------------ | ---------------------------------- |
| Select a node                        | Click it                           |
| Edit the label                       | Space or a double click            |
| Edit an empty node                   | Type a printable key               |
| Add a sibling                        | Enter in selection mode            |
| Commit and exit editing              | Enter while editing                |
| Add a child                          | Tab in selection mode              |
| Commit and add a child               | Tab while editing                  |
| Outdent                              | Shift+Tab                          |
| Delete a subtree                     | Delete or Backspace                |
| Copy a subtree                       | Cmd/Ctrl + C                       |
| Cut a subtree                        | Cmd/Ctrl + X                       |
| Paste as a child                     | Cmd/Ctrl + V                       |
| Move the selection                   | Arrow keys                         |
| Move a branch by mouse               | Drag a node                        |
| Move among siblings                  | Cmd/Ctrl + Shift + Up or Down      |
| Make a child of the previous sibling | Cmd/Ctrl + Shift + Left            |
| Move after the parent                | Cmd/Ctrl + Shift + Right           |
| Fold or unfold a subtree             | Cmd/Ctrl + /                       |
| Undo or redo                         | Cmd/Ctrl + Z, Shift + Cmd/Ctrl + Z |
| Cancel editing                       | Escape                             |
| Pan                                  | Scroll or a trackpad surface       |
| Zoom around the pointer              | Cmd/Ctrl + scroll                  |
| Fit, zoom in, zoom out               | Markmap toolbar                    |
| Switch layout                        | Layout buttons in the toolbar      |

After Enter commits a label, the node stays selected; press Enter again to insert a sibling. Autosave snapshots include the current label without closing its field, so typing can continue afterward. Shift+Enter inserts a line break in a list item. Backspace or Delete in the empty field of a newly inserted node removes that node and selects the node before it; undo restores it. A heading label cannot contain a line break; the editor keeps the document unchanged and shows a notice.

Dragging a node lifts its subtree. The top or bottom quarter of another node places it before or after, the middle makes it the last child, and a gap between branches targets that gap. A folded target opens after a short hover, and the map pans near the edge. Dropping on empty space or pressing Escape returns the branch. The file stays plain Markdown, headings and list items change level as needed, and a move is one undo step.

Paste puts a copy last under the selected node. Headings renumber to the child depth and list items reindent; a heading pasted under a list item becomes a list item with its descendants. A level beyond six leaves the file unchanged with a notice. A root that comes from frontmatter `title` copies as a heading with every child block. Text copied outside the map becomes one child label with line breaks collapsed. Copy, cut, and paste use DOM clipboard events in the editor frame, so they need no host clipboard permission. Native copy and paste inside an open label field stay unchanged.

## Markdown format

The file is ordinary Markmap Markdown. Headings and list items become branches, and paragraphs become notes on a node.

```markdown
---
markmap:
  colorDepth: 2
---

# Release

## Product

- Editor
- **Command palette**

## Launch

- Private beta
- Docs
```

`markmap.layout` accepts `tree`, `two-sided`, or `org-chart`. A file without the key opens as a two-sided map. The toolbar layout buttons switch the live view; the switch is not written to the file, so add `markmap.layout` to keep it.

## How it works

The package declares one `contributes.fileEditors` entry. OpenChamber keeps the file, sends the text to the editor, and asks for a snapshot when it saves.

The editor is a single classic IIFE built from `src/` and committed as `editor/main.js`. It uses the published `@markmap/view` and `@markmap/toolbar` plus the public editable fork of `@markmap/model`, `@markmap/edit`, and `@markmap/edit-dom` in [`vendor/markmap`](vendor/markmap/README.md). `src/` contains no custom Markdown parser, layout engine, or serializer. Extensions to parsing, layout, and rendering live in the vendored fork.

## Privacy

- The extension makes no network requests and loads no external assets.
- It does not read other files, sessions, or project data. OpenChamber passes it the open file.
- It stores no file contents and has no settings or telemetry.
- The file changes only through the host's save path: `reportFileChange`, `onFileSnapshot`, and `onFileSaved`.

## Development

```bash
bun install
bun run dev
bun run verify
bun run test:acceptance
bun run screenshots
```

`bun run dev` starts the Vite harness at `/dev/`. Append `?map=showcase&theme=light` to open the screenshot map in the light theme.

`bun run verify` runs typecheck, lint, requirement traceability, build, stale-bundle check, reproducible build check, and the 100% coverage gate. Acceptance tests use Playwright against the real Markmap renderer. `bun run screenshots` writes the images to `tmp/` from the same harness and synthetic data.

`editor/main.js` is committed. Run `bun run build` after changing `src/` and keep `bun run check:bundle-fresh` green.

## Quality workflow

The process is documented in:

- [`docs/process/sdlc.md`](docs/process/sdlc.md) (change lifecycle and gates).
- [`docs/process/testing.md`](docs/process/testing.md) (test levels and coverage).
- [`docs/process/bugs.md`](docs/process/bugs.md) (failing test first).
- [`docs/process/releases.md`](docs/process/releases.md) (branches, versions, tags, and release notes).
- [`docs/requirements.md`](docs/requirements.md) (requirement tree and traceability).

## Credits

Markmap is created by Gerald and contributors and is available under the MIT license at <https://github.com/markmap/markmap> and <https://markmap.js.org/>.

The editable fork is public at <https://github.com/mmospanenko/markmap/tree/feat/editable-model>. It adds `@markmap/model`, `@markmap/edit`, and `@markmap/edit-dom` for source-preserving editing. The renderer, layout, view, toolbar, and themes start from upstream Markmap; the fork carries the extensions this editor adds.

## License

MIT. See [`LICENSE`](LICENSE). Third-party notices are in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
