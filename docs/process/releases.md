# Release process

This page is the contract for versions, branches, tags, release notes, and promotions.

## Branches

`main` is released code. `dev` is the integration branch and publishes `X.Y.Z-dev.N` previews. Feature and fix PRs target `dev`; only a release promotion merges into `main`. Install URLs are in the README.

A merge into `dev` is not a release. `dev` is tested by hand. A stable release promotes a tested `dev` to `main`.

## Versioning

- `package.json` is the only version source.
- `dev` gets `<next minor>-dev.<commit count>` on every push. It is a preview, not a release.
- `main` gets its version from Release Please. A tag is `v` + the version.
- Before `1.0.0`, a breaking change bumps the minor version. Do not edit the version by hand.

## Release notes

- Release history lives in GitHub Releases. No changelog file is committed.
- A visual feature closes with a presentation comment on its issue: what changed, why it matters, how to see it, screenshots, and the `R-xx` ID.
- Release Please creates a **draft** release. Build its body from the presentation comments and one milestone demo: a short screencast across the release features, or the screenshots on the issues or new ones. Put the demo and brief highlights first, then features, improvements, fixes, breaking changes, and upgrade. Link the demo and each presentation.
- Release data, screenshots, GIFs, and recordings live on GitHub. Do not commit release notes, per-release pages, or per-release images.
- A static change needs one 1200 × 800 dark screenshot. A motion or interaction change needs a short GIF. Attach it to the issue and link it from the body. Synthetic content only. Recording is in [`testing.md`](testing.md).

## Stable release

1. Make sure `dev` is green and tested, and every visual feature has a presentation comment.
2. Refresh the roadmap issue, README, docs, and README screenshots from the release presentations. Prepare the release notes and milestone demo.
3. Open a PR from `dev` into `main` and merge it with a **merge commit, not squash**.
4. Release Please opens the release PR. Review the version; CI must be green.
5. Merge the release PR. Release Please creates the tag and a **draft** release.
6. Edit the draft body, then publish with `gh release edit <tag> --draft=false`.
7. Install from the tag in a clean profile and confirm the update.
8. Close the release issue after the tag install is verified.
9. Do not merge `main` back into `dev`.

## Hotfix

1. Branch from `main`, for example `fix/broken-link`.
2. Add the failing regression test, then the fix; PR into `main`.
3. Merge the PR. Release Please opens a patch release PR; merge it to create the tag and the draft release.
4. Edit the draft release body from the fix's presentation, publish it, and merge `main` into `dev` so the fix is in the next preview.

Use the hotfix path only when `dev` has unreleased work that cannot ship. Otherwise fix on `dev` and promote normally.

## Checks

- The release PR changes only `package.json` and `.release-please-manifest.json`.
- After publishing, check the tag install, the update, and the release page.
