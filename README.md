# Markmap for OpenChamber

**Work on the map. Keep the plan in Markdown.**

A mind map editor for OpenChamber. Move branches, group related work, and draw dependencies right on the map. Edits go back to the same Markdown file, so you can review changes in Git or hand the plan to an agent.

[**Get started**](#quick-start) · [See releases](https://github.com/devgears-pro/openchamber-markmap/releases)

![A project map with a dashed group boundary and a relationship arrow curving around a node](https://github.com/user-attachments/assets/7ae36c13-57ae-4ec5-a9c5-471f2b944f71)

## Quick start

1. In OpenChamber, open **Settings → Extensions**. Paste `https://github.com/devgears-pro/openchamber-markmap` into the URL field and choose **Add**.
2. Save this as `launch.markmap.md` and open it in **Files**.

```markdown
# Launch plan

## Build

- Design the flow
- Test the editor

## Ship

- Write the release notes
```

Double-click a topic to edit it, or select it and press **Space**. With a topic selected, **Enter** adds a sibling and **Tab** adds a child.

Requires OpenChamber 2.7.1 or newer. For pinned versions and development previews, see the [installation guide](docs/user-guide.md#installation).

## From outline to project map

- **Shape the plan.** Drag a branch, move several siblings together, or switch to a tree, two-sided map, or org chart. Keep details in notes instead of stretching topic labels.
- **Show what depends on what.** Draw a named frame around related work and connect topics with dashed arrows that find a route around other nodes when there is room.
- **See the plan in chat.** Ask an assistant to show a `Mindmap` in a reply. Pan and zoom the read-only map there, or open a Markdown file in Files when it is time to edit.

[User guide](docs/user-guide.md) · [Roadmap](https://github.com/devgears-pro/openchamber-markmap/issues/3) · [Contributing](docs/process/sdlc.md) · [MIT license](LICENSE)

An independent extension built on [Markmap](https://markmap.js.org/). See the [third-party notices](THIRD_PARTY_NOTICES.md).
