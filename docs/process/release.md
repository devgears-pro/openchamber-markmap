# Release and directory submission

This checklist covers a user-facing release and a listing in the OpenChamber extension directory. A release is not ready until every item is checked against the live repository.

## Before the release

1. Update behavior only through a requirement and a failing test. See [`sdlc.md`](sdlc.md).
2. Bump `version` in `package.json` when an installed copy should update. A Git install compares this version.
3. Run `bun install` if dependencies changed and commit `bun.lock`.
4. Run `bun run verify`. It must be green.
5. Run `bun run test:acceptance` when rendering, layout, or gestures changed.
6. Run `bun run screenshots` when the visible UI changed and commit the updated images in `docs/images/`.
7. Review the screenshots for light and dark themes. They must use synthetic content only.
8. Run `bunx openchamber-guest-check`. It must report that the package is ready.
9. Rebuild `editor/main.js` and commit it with the source change.
10. Push and wait for both CI jobs: `verify` and `acceptance`.

## Repository check

- The repository is public. The directory links to it, and a private repository cannot be installed by anyone else.
- The GitHub description matches the current product. It must not mention removed features.
- Topics include `openchamber`, `openchamber-extension`, `markmap`, `mindmap`, and `markdown`.
- `README.md` opens with the product sentence and a current screenshot, then covers install, use cases, keyboard, file names, privacy, and development.
- `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `docs/licenses/` are present.
- The latest commit is the one CI tested. `git status` is clean.

## Directory listing

The OpenChamber extension directory is manual and curated at <https://openchamber.dev/extensions/>. Send the repository through the **Send your extension** link on that page. Use the copy in [`../listing.md`](../listing.md) and fill the four fields it lists:

- extension name `Markmap`;
- repository URL;
- category `Preview & files`;
- a short "what it does" sentence.

Do not submit while the repository is private. Do not describe a feature that the current version does not have.

## After publication

1. Install from the Git URL in a clean OpenChamber profile, not the development folder.
2. Open a synthetic `.markmap.md` file and check selection, editing, save, theme switching, and read-only rendering.
3. Confirm the extension card shows the expected version.
4. Test one update: bump the version, push, and use **Check for updates** in Settings → Extensions.
5. Keep the issue or directory thread updated with the install result and screenshots.
