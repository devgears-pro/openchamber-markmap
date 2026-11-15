## What changed

## Requirement

- [ ] Requirement ID is in `docs/requirements.md`.
- [ ] The test name contains `[R-xx]`.
- [ ] For a bug, the failing regression test was posted before the fix.

## Release

- [ ] The PR title is a Conventional Commit (`feat:`, `fix:`, `docs:`, `chore:`).
- [ ] The target branch is `dev` for a feature or fix, and `main` only for a release promotion.
- [ ] A promotion PR is merged with a merge commit, not squash, so Release Please sees the feature and fix commits.
- [ ] The `package.json` version was not edited by hand; Release Please and the dev workflow own it.

## Verification

- [ ] `bun run verify`
- [ ] `bun run test:acceptance` for rendering changes
- [ ] `editor/main.js` is rebuilt and committed
- [ ] The closing presentation is on the issue for a visual change
- [ ] No real user data, secrets, or generated reports are committed
