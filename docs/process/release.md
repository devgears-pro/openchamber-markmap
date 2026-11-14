# Directory submission

The version, tag, and changelog process is in [`releases.md`](releases.md). This page covers the OpenChamber extension directory and the checks after a release is published.

## Before submitting

- The repository is public and has a tagged release. A private repository or an untagged branch cannot be installed by other people.
- `bun run verify` and `bun run test:acceptance` are green on `main`.
- The GitHub description matches the released product; topics include `openchamber`, `openchamber-extension`, `markmap`, `mindmap`, and `markdown`.
- `README.md` opens with the product sentence and a current screenshot, then covers install, file names, keyboard, privacy, and development.
- `docs/images/` was regenerated from synthetic content for the current UI.
- `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `docs/licenses/` are present.
- `git status` is clean and the commit is the one CI tested.

## Directory listing

The OpenChamber extension directory is manual and curated at <https://openchamber.dev/extensions/>. Send the repository to <feedback@openchamber.dev> with the subject **OpenChamber extension for the directory**. Use the copy in [`../listing.md`](../listing.md) and fill the four fields it lists:

- extension name `Markmap for OpenChamber`;
- repository URL;
- category `Preview & files`;
- a short "what it does" sentence.

Do not submit while the repository is private. Do not describe a feature that the released version does not have.

## After publication

1. Install from the plain Git URL in a clean OpenChamber profile, not the development folder.
2. Open a synthetic `.markmap.md` file and check selection, editing, save, theme switching, read-only rendering, links, and markers.
3. Confirm the extension card shows the released version.
4. Install the pinned tag URL `#vX.Y.Z` and confirm the same version.
5. Keep the issue or directory thread updated with the install result and screenshots.
