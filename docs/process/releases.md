# Release process

This page is the contract for versions, branches, tags, and changelogs. The directory submission is in [`release.md`](release.md).

## Branches

| Branch   | Purpose              | Version       | Install                                                     |
| -------- | -------------------- | ------------- | ----------------------------------------------------------- |
| `main`   | Released code        | `X.Y.Z`       | `https://github.com/mmospanenko/openchamber-markmap`        |
| `dev`    | Integration, preview | `X.Y.Z-dev.N` | `https://github.com/mmospanenko/openchamber-markmap#dev`    |
| `feat/*` | One feature          | none          | not for installation                                        |
| `fix/*`  | One fix              | none          | not for installation                                        |
| `vX.Y.Z` | A released version   | `X.Y.Z`       | `https://github.com/mmospanenko/openchamber-markmap#vX.Y.Z` |

`main` stays the default branch. A Git install without a fragment follows `main`; the `#dev` fragment follows the preview branch; a `#vX.Y.Z` fragment pins a tag.

## Versioning

- Semantic Versioning. Before `1.0.0`, a breaking change bumps the minor version; `release-please-config.json` sets `bump-minor-pre-major`.
- `package.json` is the only version source. A Git install compares the `version` field; OpenChamber does not look at commit hashes.
- `dev` gets a preview version from CI on every push: `<next minor>-dev.<commit count>`. The version is only a cache-buster; it is not a release and gets no tag.
- `main` gets its version from Release Please. Do not edit the version by hand.
- A tag is always `v` + the `package.json` version. Tags are created on `main` only.

## Changelog

- `CHANGELOG.md` follows Keep a Changelog.
- Release Please generates the changelog and the GitHub Release notes from Conventional Commits on `main`. Do not edit the generated sections by hand.
- PR titles are the changelog: use `feat:`, `fix:`, `perf:`, `docs:`, `refactor:`, `test:`, or `chore:`. A breaking change is `feat!:` or `fix!:` with a `BREAKING CHANGE:` footer.
- The `0.3.1` section is the baseline. Earlier releases are in the commit history.
- The changelog and release notes are user-facing. Describe behavior, not implementation.

## Day-to-day development

1. Branch from `dev`.
2. Add a requirement and a failing test. See [`sdlc.md`](sdlc.md).
3. Open a PR into `dev` with a Conventional Commit title.
4. CI runs `verify`, `acceptance`, and the guest check.
5. Merge the PR. The **Dev preview version** workflow writes the next `-dev.N` to `package.json` and pushes it to `dev`.
6. `#dev` shows an update for the new version.

The preview version commit is `chore(dev): preview X.Y.Z-dev.N [skip ci]`. It changes only `package.json`; the bundle is unaffected.

## Stable release

1. Make sure `dev` is green and the preview has been tested.
2. Open a PR from `dev` into `main` and merge it with a **merge commit, not squash**. Release Please reads the commits on `main`; a squash merge would hide the feature and fix entries. This is the only promotion step.
3. The **Release** workflow runs Release Please on `main`. It opens or updates a PR titled `chore(main): release X.Y.Z`.
4. Review the version and the generated changelog in that PR. CI must be green.
5. Merge the release PR. Release Please creates the `vX.Y.Z` tag and the GitHub Release.
6. Install from `#vX.Y.Z` in a clean profile and confirm the update from the previous version.
7. Do not merge `main` back into `dev`; the next `dev` push computes a preview from the new tag.

There is no fixed release calendar. Cut a stable release when `dev` has a coherent set of changes, and immediately for a regression.

## Install URLs

Stable:

```text
https://github.com/mmospanenko/openchamber-markmap
```

Preview:

```text
https://github.com/mmospanenko/openchamber-markmap#dev
```

Pinned:

```text
https://github.com/mmospanenko/openchamber-markmap#v0.4.0
```

The preview and the stable install share the extension id `markmap`, so they cannot be installed side by side. Installing `#dev` replaces the stable card; removing it and installing the plain URL returns to stable. The preview may break.

## First-time setup

These steps are done once in the repository settings.

1. Create the baseline tag on the last released commit: `git tag -a v0.3.1 -m "v0.3.1"` and push it. Release Please needs a starting tag.
2. Push `dev`. The preview is installable from `#dev`.
3. The **Release** workflow must live on `main` to run there. It arrives with the first promotion PR; after that merge it is active.
4. Give the workflows write access: **Settings → Actions → General → Workflow permissions → Read and write permissions**, or keep the explicit `permissions` blocks in the two workflows and allow write in the repository policy.
5. Protect `main` with a ruleset that requires a pull request and the `verify` and `acceptance` checks, and blocks force pushes. Release Please only opens a PR; it does not push to `main`.
6. Protect `dev` with a ruleset that requires a pull request and the same checks. Add the **GitHub Actions** app as a bypass actor so the preview version commit can be pushed. Without the bypass, leave `dev` unprotected or the version workflow fails.
7. Optionally protect `v*` tags so only the release workflow can create them.

## Hotfix

1. Branch from `main`, for example `fix/broken-link`.
2. Add the failing regression test, then the fix; PR into `main`.
3. Merge the PR. Release Please opens a patch release PR; merge it to create the tag and release.
4. Merge `main` into `dev` so the fix is in the next preview.

Use the hotfix path only when `dev` has unreleased work that cannot ship. Otherwise fix on `dev` and promote normally.

## Verification

- `bun run verify` is the merge gate.
- `bun run test:acceptance` is required for rendering or layout changes.
- The release PR changes only `package.json` and `CHANGELOG.md`; no bundle rebuild is needed.
- After a stable release, check the tag install, the previous-version update, and the extension card version.
