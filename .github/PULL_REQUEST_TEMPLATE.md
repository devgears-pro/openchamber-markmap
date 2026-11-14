## What changed

## Requirement

- [ ] Requirement ID is in `docs/requirements.md`.
- [ ] The test name contains `[R-xx]`.
- [ ] For a bug, the failing regression test was posted before the fix.

## Release

- [ ] The PR title is a Conventional Commit (`feat:`, `fix:`, `docs:`, `chore:`), and it drives the changelog.
- [ ] The target branch is `dev` for a feature or fix, and `main` only for a release promotion.
- [ ] A promotion PR is merged with a merge commit, not squash, so Release Please sees the feature and fix commits.
- [ ] `CHANGELOG.md` and the `package.json` version were not edited by hand; Release Please and the dev workflow own them.

## Verification

- [ ] `bun run verify`
- [ ] `bun run test:acceptance` for rendering changes
- [ ] `editor/main.js` is rebuilt and committed
- [ ] Screenshots are attached for visual changes
- [ ] No real user data, secrets, or generated reports are committed
