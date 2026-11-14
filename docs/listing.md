# Directory listing copy

The OpenChamber directory is curated by email. Use these four fields when sending the repository through **Send your extension** on <https://openchamber.dev/extensions/>.

## Extension name

Markmap

## Repository URL

<https://github.com/mmospanenko/openchamber-markmap>

## Category

Preview & files

## What it does

Edit Markmap Markdown as a mind map directly in Files: select a node, press Enter or Tab, type, and save. The Markdown file stays the source, with no separate Markdown pane.

## Extra context for the reviewer

- This is a `contributes.fileEditors` package, not a rail panel. It claims only six mind-map suffixes and leaves `*.md` untouched.
- It requests no capabilities and makes no network requests.
- It bundles the built editor at `editor/main.js`; no build step runs at install time.
- The README contains light, dark, and in-place editing screenshots generated from synthetic content.
- Requirements: OpenChamber 2.7.1 or newer, desktop or web.
