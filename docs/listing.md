# Directory listing copy

The OpenChamber directory is curated by email. Send the repository to <feedback@openchamber.dev> with the subject **OpenChamber extension for the directory**, using these four fields.

## Extension name

Markmap for OpenChamber

## Repository URL

<https://github.com/mmospanenko/openchamber-markmap>

## Category

Preview & files

## What it does

An adaptation of the open-source Markmap library for OpenChamber. Edit Markmap Markdown as a mind map directly in Files: select a node, press Enter or Tab, type, and save. The Markdown file stays the source, with no separate Markdown pane.

## Extra context for the reviewer

- This is an adaptation of the open-source Markmap library, not an official Markmap project. The editable fork is public at <https://github.com/mmospanenko/markmap/tree/feat/editable-model>.
- This is a `contributes.fileEditors` package, not a rail panel. It claims only six mind-map suffixes and leaves `*.md` untouched.
- It requests no capabilities and makes no network requests.
- It bundles the built editor at `editor/main.js`; no build step runs at install time.
- The README contains light, dark, and in-place editing screenshots generated from synthetic content.
- Requirements: OpenChamber 2.7.1 or newer, desktop or web.
