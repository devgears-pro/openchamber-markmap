# Requirements

The tree is the contract for this extension. Every requirement has an ID, and every ID appears in at least one automated test name. `bun run check:requirements` fails when an ID is missing, unknown, or unused.

## Experience principles

These principles guide new requirements; the numbered requirements below define observable behavior and its proof.

- **Flow:** Keep map interaction visually clear, predictable, and responsive, with immediate feedback and no unnecessary interruption.
- **Intuition:** Make selection, editing, navigation, and cancellation behave consistently with their visible state.
- **Responsiveness:** Keep common actions fast on small and 1,000-node maps, and measure them with repeatable scenario benchmarks.
- **Readable source:** Keep files easy for people and language models to understand through conventional Markdown and documented extensions.

## Product

### R-01 Manifest

The package declares one `contributes.fileEditors` entry with display name `Markmap`, id `markmap`, editor title `Markmap`, the six supported file-name patterns, a text entry, and a valid icon. It parses with the OpenChamber manifest schema.

### R-02 Render

A matching text file opens as an interactive Markmap. The renderer receives the file text unchanged, mounts the Markmap toolbar, and shows the map in the stage. It honors `markmap.layout` for `tree`, `two-sided`, and `org-chart`, opens a file without the key as `two-sided`, and falls back to `two-sided` with a non-blocking notice for an unknown value. The map opens at 100% within the map's scale limits. A drawing that fits the viewport at that scale is centered as a whole. A larger drawing keeps the root in view according to the layout: centered for `two-sided`, at the left for `tree`, and at the top for `org-chart`. The Fit control scales the whole map into the viewport and stays capped at 100% by default; `markmap.fitMaxScale` in frontmatter can change that cap. Rendering uses the vendored `@markmap/model`, `@markmap/render` and `@markmap/edit-dom` over `@markmap/view` and `@markmap/toolbar`; `src/` contains no custom Markdown parser, layout, or serializer. Extensions to parsing, layout, and rendering live in the vendored fork.

### R-03 Node selection

A matching file opens with the root selected. A left click selects a node, draws a frame around it, highlights its SVG group, and focuses the editor surface so Enter and Tab act on that node. A left click on the empty canvas clears the selection, its SVG highlight, and its frame, and moves DOM focus out of the editor surface; a later click on a node selects it again and restores focus to the surface. The frame follows the node's screen rectangle, not the edit field, including for an empty first-level topic. The focused surface draws no browser focus ring; the selection frame is the only focus mark.

### R-35 Sibling multi-selection

An editable map lets a user select sibling nodes and move or delete them as a group. The first plain-clicked node is the anchor and primary; Cmd/Ctrl-click toggles a sibling without changing it, and Shift-click selects the inclusive sibling range from the anchor. A plain click selects one node and makes it the new anchor and primary, so a plain click on a node with another parent starts a new single-node selection. Selection does not change Markdown or dirty state. Dragging a selected node or using Cmd/Ctrl+Shift+Up/Down moves the selected subtrees as one contiguous block, preserving their relative order; the moved siblings stay selected with the first moved node as the anchor. After a group move or delete, undo and redo restore the selection of the restored state, and undo of a group delete selects the deleted siblings again. Delete/Backspace removes the selected siblings and their subtrees, then selects the previous sibling, the parent when it has a source label or block, otherwise the next surviving sibling or the document end. Group move and delete are atomic, each producing one dirty change and one undo step. Read-only maps expose no multi-selection. Copy, cut, paste, markers, notes, and toolbar actions remain primary-node only; group clipboard actions are out of scope.

### R-36 Group boundary rendering and editing

When a document defines groups in its graph metadata, the editor renders a bounding box around all visible nodes in the group's subtree(s) in an underlay pass behind nodes and lines with theme tokens `--mm-group-border` and `--mm-group-fill`. Group boundaries adapt to tree, two-sided, and org-chart layouts, display the group label above the top boundary, and are concealed when any root or ancestor is folded. The editor provides a toolbar action to create a group boundary for the selected subtree or selected contiguous siblings, minting node identities and serializing graph metadata atomically. A group boundary can be selected by clicking its perimeter or label; pressing Delete or Backspace on a selected boundary deletes the group without deleting the nodes, and cleans up unreferenced markers. Pressing Enter or double-clicking the boundary opens an inline overlay to edit the group label in place.
Group boundaries and the Create group toolbar icon use dashed outlines.

### R-04 Theme

The map uses the host theme mode (`light` or `dark`), not a color scheme from file frontmatter. A host theme change redraws the existing view without recreating it.

### R-05 Snapshot fidelity

`onFileSnapshot` returns the current Markdown or the original bytes and a content-derived version. An in-progress node label or note is included in the snapshot without exiting edit mode or moving focus, so typing can continue after autosave. Saving unchanged text returns the same bytes as the opened file, and a read-only file cannot be changed.

### R-06 Unsupported fallback

Binary input and Markmap failures report the file as unsupported so OpenChamber can switch to the source view. The snapshot still returns the original content.

### R-07 Lifecycle

The previous view is destroyed when another file opens and when the editor disposes. The Markmap instance, toolbar, listeners, and DOM are released.

## Engineering

### R-08 Bundle

`editor/index.html` loads one classic script. `editor/main.js` is a self-contained IIFE without top-level module syntax and stays under the bundle budget.

### R-25 Chat bundle

`chat/index.html` loads one classic script. `chat/main.js` is a self-contained IIFE without top-level module syntax and stays under the bundle budget.

### R-09 Deterministic output

The same source and lockfile produce the same bundle. Snapshot versions depend only on content. `bun run check:reproducible` builds twice and compares the bytes.

### R-10 Accessibility

The map exposes an image role and a name, and the Markmap toolbar keeps labelled controls.

### R-11 Keyboard editing

From selection mode, Enter inserts a sibling and Tab a child. While editing, Enter commits and exits to selection; Tab commits and inserts a child. Shift+Tab outdents, Delete removes the selected subtree, Space or a double click edits the label, and Escape cancels. New nodes start with an empty label; a zero-width marker keeps them in the parsed tree. New branches use heading markers only at H1 and H2: a child of an H1 root or heading becomes H2, a child of an H2-H6 heading becomes a list item, an H1 or H2 sibling stays a heading at the same level, and an H3-H6 sibling becomes a list item under the same parent heading; existing H3-H6 headings stay editable in place. Backspace or Delete in the open empty field of a new node removes that node and selects the node before it; undo restores it. The edit field keeps its anchor and the map reflows while the label grows, so typing does not slide the text or cover its child branches. Edits change only the affected Markdown ranges. Each successful command reports `{ dirty: true, edited: true }`, becomes the next snapshot, and a saved version clears the dirty flag.

### R-12 Read-only files

A file marked read-only renders the map without the node editor or the notes panel. Its note dot opens the sanitized rendered popover. Its snapshot stays byte-for-byte equal to the opened file.

### R-13 Editor errors

An invalid command, such as a line break in a heading label, keeps the document unchanged and shows a non-blocking notice. A file whose only top-level node is a heading uses it as a source-heading root and edits it in place; otherwise a title root with any heading child refuses root creation with a notice. The notice clears on the next successful edit.

### R-14 Wheel navigation

An unmodified wheel or trackpad gesture pans the map without changing its scale. Line and page deltas are normalized, Shift maps vertical wheel input to horizontal, and a wheel burst is applied once per animation frame. A wheel with Cmd or Ctrl zooms around the pointer with clamped deltas.

### R-15 Keyboard navigation and history

Arrow keys move the selection between related nodes without folding. Cmd/Ctrl+Z while editing resets a changed draft to the label the session started with before it undoes committed history; a second press undoes the previous edit. Shift+Cmd/Ctrl+Z redoes it, and Cmd/Ctrl+/ folds the selected subtree. A completed label session creates at most one undo entry.

### R-16 New files

An empty text file that matches a Markmap suffix opens with an editable first node. Typing a label creates a heading, so the first save produces valid Markmap Markdown without losing frontmatter. A read-only empty file stays blank and exposes no editor field.

### R-17 External links

Clicking an http(s) link in a node asks the host to open it and never navigates the editor frame. Non-http links are ignored. The editor asks for no new host capability.

### R-18 Node markers

An editable or read-only map renders node markers as vector SVG icons instead of monochrome text glyphs. Progress markers provide vector pie-chart states for 0%, 25%, 50%, 75%, and 100%. Priority markers render colored badges for levels 1 through 7. Status markers render vector done, in-progress, blocked, and risk icons. Flags render colored flag markers. Markers in the Markdown source remain standard Unicode characters for dry-Markdown portability.

Clicking a marker icon on an editable node opens an anchored marker picker popover next to the node. The popover presents categorised icons and a remove action that clears the leading marker. Choosing an icon replaces or sets the leading marker and commits the change. Clicking outside or pressing Escape closes the popover without changes. Read-only maps render vector markers but open no picker. The toolbar marker control opens the same popover for the selected node. Clicking a list task checkbox directly toggles its state between checked and unchecked.

### R-19 Selection and editing modes

A focused node stays in selection mode until the user explicitly edits it. Printable keys do nothing on a non-empty node. Typing a printable key on a selected empty node opens the label field with that character inserted. Space or a double click opens the label field, Escape leaves editing and keeps the node selected, and F2 is not bound. Enter while editing commits the label and returns to selection without inserting a node; the next Enter in selection mode inserts a sibling and opens its field. Tab while editing commits the label and inserts a child. Arrow keys navigate without folding: Left selects the parent, Right unfolds or selects the first child. The editor container carries `mm-editor-mode-select` or `mm-editor-mode-edit`.

### R-20 Autosave preserves editing

While a label field is open, each valid draft is reported as the saveable text, so a clean file becomes dirty and autosave can start before the first snapshot. A label snapshot is a pure read: it returns the last reported draft without committing the session, closing the panel, changing its focus, or leaving edit mode, and a note snapshot still commits the open note. The field keeps its caret, and the user can continue typing after autosave. Cancelling, hiding, or switching away from a label session reports the baseline when it differs from the last live text, and an unchanged session reports nothing.

### R-21 Clipboard

An editable map copies the selected node with its whole subtree, notes, and markers as its exact Markdown block, and cuts it with one delete history entry. A root that comes from frontmatter `title` or a synthetic root copies the title as a level-one heading followed by every child block, without frontmatter. Paste inserts an in-map copy as the last child of the selection, renumbers headings and reindents list items to the child depth, and selects the pasted root. A heading subtree pasted under a list item becomes a list subtree: heading nodes become list items, existing list items keep their markers, and notes and continuation lines re-indent. An impossible heading level or a block with several top-level nodes leaves the file unchanged and shows a notice. Plain text from outside becomes one child label with line breaks collapsed. DOM copy, cut, and paste events drive the behavior, and a hidden editable sink receives paste, so the editor asks for no new host capability and keeps native clipboard behavior inside an open label field. An empty clipboard, a cut of the root, or a node without a block shows a notice.

### R-22 Layout switcher

An editable or read-only map shows labelled layout buttons for `tree`, `two-sided`, and `org-chart`. The active button reflects the current layout. The group is keyboard operable.

In an editable map, choosing a different layout updates or adds `markmap.layout` in frontmatter, preserving existing frontmatter fields, comments, blank lines, BOM, line endings, and Markdown body. The switch reports a dirty change, becomes an undo step, keeps node selection and folded state, and fits the view. Clicking the currently active layout is a no-op. If frontmatter cannot be safely updated, the document and layout remain unchanged and a notice is shown. Any active label or note edit is committed before applying the layout change. Undo and redo restore source text, active layout, and toolbar button state together.

In a read-only map, choosing a layout updates only the visible view, leaving the file, snapshot, and dirty state unchanged. An untouched file without a layout key remains unchanged.

### R-26 Notes editing

An editable map opens a notes panel for the selected node from a labelled Edit notes control. The note is one `markmap-note` fenced block under the node, and its content is isolated Markdown, so headings, lists, tables, code, and HTML inside it stay inside the note. The panel is a plain Markdown textarea with bold, italic, inline code, link, quote, and code block actions. Cmd/Ctrl+Enter or a click outside commits, Escape cancels, and a commit is one history entry. A host snapshot includes the in-progress text and commits the note without closing the panel or moving focus; notes do not start dirty-driven autosave before that request. A node without a note gets the block on the first commit. Clearing the text removes the block and its dot. Legacy paragraph notes migrate to one block on the first edit. The block indents under a list item, inserts before the first child of a title root, and keeps frontmatter, children, markers, and line endings unchanged. The note dot opens the sanitized rendered popover in editable and read-only maps. A read-only map shows no Edit notes control. An opaque node or a node with an empty label shows a notice and opens no panel. A file whose notes are not edited stays byte-for-byte identical.

### R-27 Theme and toolbar visuals

The notes panel, its formatting controls, and the full map toolbar use the host light or dark theme tokens. The notes panel remains legible in both themes and never falls back to a white surface in dark mode. Toolbar icons for map controls, layouts, markers, notes, and note formatting use consistent outline SVGs. The layout symbols are one family of smooth curved branch diagrams whose direction conveys the layout: one-sided branches for tree, mirrored branches for two-sided, and top-to-bottom branches for org chart. The top map toolbar renders 16 px icons with 1.5 px round strokes in 28 px hit targets, uses a muted inactive color, and keeps grouped controls apart with spacing and a rule. Accessible names, keyboard behavior, and actions remain unchanged; no icon dependency is added.

### R-30 Pointer move

An editable map moves a branch by dragging a node. A press that moves 4 px starts a drag; a shorter press stays a click. The node and its whole subtree lift and follow the pointer while the map keeps its layout, and the map re-lays out once on drop. The top quarter of a target inserts before it, the bottom quarter after it, and the middle makes the branch the last child. A gap between branches targets that gap. One indicator shows at a time: a 2 px accent line for order and a rounded accent frame for a child drop. The node itself, its descendants, the root and nodes without an editable structure show no indicator, and the release snaps back. A folded target expands after 400 ms, and a cancelled drag restores the fold. Within 60 px of the stage edge the map auto-pans. Escape, a pointer cancel or a release over empty space cancels. After a drop the moved node stays selected and in view. A move is one history entry, and undo restores the exact bytes and the fold state. A read-only map has no drag. Touch pointers stay with the map gestures.

### R-31 Keyboard move

Cmd/Ctrl+Shift+Up and Down move the selected node among its siblings, Left makes it the last child of the previous sibling, and Right moves it after its parent. The pointer path's move command, notices, history and level changes apply. A boundary move changes nothing, an impossible move shows a notice and leaves the file unchanged, and a read-only map has no move keys.

### R-32 Soft tree

Maps without an explicit `markmap.theme` use a depth-based soft tree: the root is a dark filled rounded block with larger white semibold text, first-level topics are pale branch-tinted rounded blocks with medium text, and deeper nodes are smaller regular neutral labels with a thin branch-colored underline and no block. Each first-level branch gets one muted color shared by its descendants by default; `color` and `colorDepth` still apply. The default first-level palette is distinct and balanced, keeps the brown tone as one accent rather than the dominant color, and stays legible in light and dark modes. An explicit frontmatter `color`, `colorDepth`, or theme keeps its values. Root-to-first-level edges taper smoothly, deeper edges use a long flat start and arrival and stay thin. The default soft layout uses 14 px between siblings and 110 px between levels; frontmatter `siblingGap` and `levelGap` override them. Padding and spacing keep labels inside their blocks without clipping or overlap. An empty first-level node keeps its topic padding, including 14 px horizontally. Its edit field keeps a 40-unit minimum in map coordinates, stays centered on the visible topic block, and may be wider than it; the zero-width placeholder does not shift either, and the selection frame stays on the node's screen rectangle rather than the edit field. The editor, read-only maps, and chat block share the theme and follow the host light or dark mode. An explicit frontmatter theme is unchanged. While a label is edited, the overlay field uses the selected node's resolved font family, size, weight, line height, text fill, padding, and alignment at every zoom, with no jump when editing starts or the label grows. Markdown bytes stay unchanged.

### R-33 View reset

A file map offers a labelled Reset view control in the map toolbar. It sets the scale to 100% within the map's scale limits. For the selected node it centers the node; for the root, or in a read-only map, it returns to the open view: a drawing that fits is centered, and a larger drawing keeps the root in view according to the layout. The control does not change the selection or the document itself; an open note is committed by the click outside its panel, as with any toolbar action. It works in every layout, returns focus to the map, and is keyboard operable. Fit remains a separate control that scales the whole map into the viewport.

### R-23 Chat block manifest

The package declares one `contributes.blocks` entry named `Mindmap`. Its description names Markmap, and the one argument is `markdown`. The entry is the chat page, the default height is 480 px, and the block declares no `answers`. It parses with the OpenChamber manifest schema.

### R-24 Chat render

An active extension draws a `Mindmap(markdown: string)` call from an assistant reply as a read-only Markmap in its sandboxed frame. The argument is the whole map source. The map is fitted with the editor options and follows the host light or dark mode; a host theme change redraws it without recreating the view. The frame exposes an image role and a name. An empty or missing argument draws an empty map. A Markmap failure shows a notice instead of a blank frame, and a frontmatter warning shows the same notice while the map stays. A later call replaces the drawn map, and dispose releases the preview, listeners, and DOM.

### R-28 Heading root

A file whose only top-level node is a heading uses that heading as the root at any level from H1 to H6, even when a non-empty frontmatter `title` exists. A leading list or any other top-level block before the heading prevents promotion. The title stays in frontmatter but does not control the map root. Without a single top-level heading, the title is the root. The heading keeps its marker, level, source ranges, children, and notes, so it is edited in place. New branches use heading markers only at H1 and H2: a child of an H1 root or heading becomes H2, a child of an H2-H6 heading becomes a list item under it, an H1 or H2 sibling stays a heading at the same level, and an H3-H6 sibling becomes a list item under the same parent heading. Existing H3-H6 headings stay readable and editable in place without migration. A note above the promoted heading stays with the root when the node is edited or copied, and a pasted copy keeps those intro notes on the pasted root. Opening the file or snapshotting an unchanged file never rewrites its bytes.

### R-29 Root creation

Naming an editable synthetic root with no top-level H1, or a title root with no heading child, inserts one H1 before the body; the previous top-level blocks become its children, and the original bytes and branch structure are preserved. The title stays in frontmatter and the new body H1 becomes the map root. The new H1 sits on the first non-blank body line, keeps any leading blank lines, is separated from the following content by one blank line, and preserves the file line ending. The insertion is one undo entry and appears in an autosave snapshot without closing the field. A source-heading root and a title root with any heading child refuse the change with a notice and leave the source unchanged. Opening an empty file creates no heading; typing a label is what adds it.

### R-34 Node identity and graph metadata

A node line may end with a hidden identity marker `<!-- ^id -->`, where `id` is one to three case-sensitive alphanumeric characters. The marker comment must stay on one line. The root identity is `root`: a source-heading root must not declare a marker, and a title or synthetic root has no node line. A marker is valid only as the final token on a heading or list-item line; markers inside a label, after further inline text, in notes, fences, frontmatter, standalone lines, or repeated on one line are rejected. Node identities are unique, and a marked node must be referenced by an edge endpoint or a group root. At most one root-level hidden `<!-- markmap: graph ... -->` block carries directed edges with `from`, `to`, and an optional `label`, and groups with a non-empty `roots` array and an optional `label`. A graph with no edges or groups stores no block. The block is never a note, and a document with malformed, duplicate, dangling, or unsafe graph metadata reports validator issues without changing the map or the document bytes. Groups enclose each root's subtree and must not overlap or repeat roots. Copying a subtree does not clone or remap the document graph block or its references, so an edge or group that references `root` is not copied; it mints fresh identities only for copied internal graph references, remaps them, and omits a partially copied group. Copying the whole document root as a standalone map keeps the original graph block intact exactly once. Deleting a subtree removes affected edges and group roots, drops markers that are no longer referenced, and removes empty groups in the same edit. New identities are generated with injected randomness from the one-to-three character space and refuse when that space is exhausted. Untouched Markdown stays byte-for-byte identical.

### R-37 Relationship arrows

Directed graph edges render as dashed cubic Bezier curves connecting source and target nodes with solid directional arrowheads at the target anchor and centered text labels on elevated backgrounds. Anchor sides adapt to the relative geometry of the connected nodes. A clear route stays short and smooth; when blocked, routing considers alternate contact points on both endpoint outlines and avoids visible unrelated nodes where possible. If crossings are unavoidable, it minimizes the number of unrelated nodes crossed, then the distance traveled over them. Routes adapt to layout and visible branches without changing Markdown. When either the source or target node is collapsed or hidden within a folded subtree, the relationship curve and its label are hidden. Selecting an arrow highlights the relationship path and arrowhead, including when the pointer lands in a dash gap. An interactive connection handle on the selected node allows dragging a dashed preview curve to another node to create a directed edge, minting node identities when needed and opening an inline input field for the edge label. In tree and two-sided layouts the handle sits above or below the selected node, clear of its fold control; in org-chart it remains beside the node. The preview begins at the handle. Selecting an arrow and pressing Enter opens an inline editor for its label; committing an empty label removes the label while keeping the edge. Pressing Delete or Backspace removes the selected edge and purges orphaned node identity markers. An untouched document stays byte-for-byte unchanged.

### R-38 Convention diagnostics

A standalone CLI script validates Markmap files for convention issues defined by R-34 and exits non-zero when any file has issues. The merge gate includes convention validation. The editor shows a non-blocking host toast when convention issues are detected in an opened file or introduced by an edit. Convention errors never break the rendered tree, corrupt document bytes, or block editing; invalid conventions are preserved safely without interfering with normal editing.

## Traceability

| Requirement | Tests                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| R-01        | `tests/manifest.test.ts`                                                                                                  |
| R-02        | `tests/app.test.ts`, `tests/markmap-view.test.ts`, `tests/options.test.ts`, `tests/zoom.test.ts`, acceptance              |
| R-03        | `tests/markmap-view.test.ts`, acceptance                                                                                  |
| R-04        | `tests/app.test.ts`, acceptance                                                                                           |
| R-05        | `tests/app.test.ts`, `tests/markmap-view.test.ts`                                                                         |
| R-06        | `tests/app.test.ts`                                                                                                       |
| R-07        | `tests/main.test.ts`, `tests/app.test.ts`, `tests/markmap-view.test.ts`                                                   |
| R-08        | `tests/bundle.test.ts`                                                                                                    |
| R-09        | `tests/app.test.ts`, `scripts/check-reproducible.ts`                                                                      |
| R-10        | acceptance                                                                                                                |
| R-11        | `tests/app.test.ts`, `tests/markmap-view.test.ts`, acceptance                                                             |
| R-12        | `tests/app.test.ts`, `tests/markmap-view.test.ts`, acceptance                                                             |
| R-13        | `tests/app.test.ts`, `tests/markmap-view.test.ts`, acceptance                                                             |
| R-14        | `tests/gestures.test.ts`, acceptance                                                                                      |
| R-15        | acceptance                                                                                                                |
| R-16        | `tests/markmap-view.test.ts`, acceptance                                                                                  |
| R-17        | `tests/markmap-view.test.ts`, `tests/app.test.ts`                                                                         |
| R-18        | `tests/markers.test.ts`, `tests/marker-menu.test.ts`, `tests/app.test.ts`, `tests/markmap-view.test.ts`, acceptance       |
| R-19        | acceptance                                                                                                                |
| R-20        | `tests/app.test.ts`, `tests/markmap-view.test.ts`, acceptance                                                             |
| R-21        | `tests/clipboard.test.ts`, `tests/markmap-view.test.ts`, acceptance                                                       |
| R-22        | `tests/layout-menu.test.ts`, `tests/app.test.ts`, acceptance                                                              |
| R-23        | `tests/manifest.test.ts`                                                                                                  |
| R-24        | `tests/chat.test.ts`, `tests/chat-main.test.ts`, `tests/preview.test.ts`, acceptance                                      |
| R-25        | `tests/bundle.test.ts`                                                                                                    |
| R-26        | `tests/notes-menu.test.ts`, `tests/app.test.ts`, `tests/markmap-view.test.ts`, `tests/clipboard.test.ts`, acceptance      |
| R-27        | `tests/toolbar.test.ts`, `tests/layout-menu.test.ts`, `tests/marker-menu.test.ts`, `tests/notes-menu.test.ts`, acceptance |
| R-28        | `tests/acceptance/markmap.spec.ts`                                                                                        |
| R-29        | `tests/acceptance/markmap.spec.ts`                                                                                        |
| R-30        | `tests/acceptance/markmap.spec.ts`                                                                                        |
| R-31        | `tests/acceptance/markmap.spec.ts`                                                                                        |
| R-32        | `tests/options.test.ts`, `tests/acceptance/theme.spec.ts`                                                                 |
| R-33        | `tests/zoom.test.ts`, `tests/markmap-view.test.ts`, acceptance                                                            |
| R-34        | `tests/graph.test.ts`, acceptance                                                                                         |
| R-35        | `tests/acceptance/markmap.spec.ts`                                                                                        |
| R-36        | `tests/group-menu.test.ts`, `tests/graph.test.ts`, `tests/markmap-view.test.ts`, `tests/app.test.ts`, acceptance          |
| R-37        | `tests/relationship-arrows.test.ts`, acceptance                                                                           |
| R-38        | `tests/conventions.test.ts`, `tests/app.test.ts`, `tests/markmap-view.test.ts`                                            |
