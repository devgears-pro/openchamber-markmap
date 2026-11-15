# Change lifecycle

This repository uses a small, deterministic loop: requirement, failing test, minimal implementation, verification, documented evidence.

## Principles

- One behavior, one requirement, one failing test.
- The same source and lockfile produce the same bundle.
- The committed bundle is part of the source of truth.
- Every check runs locally and in CI with the same command.
- Docs are public. Use placeholders and synthetic examples; no local paths, usernames, sessions, or personal data.

## Change types

| Type    | First artifact                           | Required proof                         |
| ------- | ---------------------------------------- | -------------------------------------- |
| Feature | Requirement ID in `docs/requirements.md` | Failing test with `[R-xx]`, then green |
| Bug     | Issue with reproduction steps            | Failing regression test, then green    |
| Chore   | No behavior change                       | Existing checks stay green             |
| Docs    | No behavior change                       | Markdownlint                           |

## Steps

1. **Define the requirement.** Add or reuse an ID in `docs/requirements.md`. State the observable behavior, not the implementation.
2. **Write the failing test.** Put `[R-xx]` in the test name. Run the smallest test command and keep the red output for the report.
3. **Implement the minimum.** Change only what the test needs. Keep the Markmap packages responsible for parsing, layout, and drawing.
4. **Refactor with the test green.** Remove duplication and dead code. Do not add comments.
5. **Run the gate.** `bun run verify` must pass. It includes typecheck, lint, requirement traceability, build, stale-bundle check, reproducible build check, and 100% coverage.
6. **Run acceptance when rendering changes.** `bun run test:acceptance` drives a real browser and the real Markmap packages.
7. **Rebuild the artifact.** `bun run build` updates `editor/main.js`; commit it with the source.
8. **Update traceability.** Keep `docs/requirements.md` aligned with the tests.
9. **Report evidence.** Use the chat report below.

## Chat report

After a task or bug fix, the chat reply links the work and its proof:

- The issue, when there is one, and the pull request.
- The cause for a bug, or the reason for a task.
- The test command, the red output, and the green output. Screenshots for visual changes.
- The OpenChamber install link for the branch with the change: `https://github.com/mmospanenko/openchamber-markmap#<branch>` when it is not `dev`, otherwise `https://github.com/mmospanenko/openchamber-markmap#dev`. Always include it, even when the worktree folder is also available.
- For a visual change, a comment on the issue with a screenshot or a short GIF. Release notes are built from those comments; see `docs/process/releases.md`.

## Worktrees and sync

All work happens in `.worktrees/<name>`, never in the main checkout; agents run in parallel.

When the work is done, push the worktree branch and open a PR into `dev`. Merge through GitHub after CI. Do not commit or merge directly into `dev`.

The fork follows the same rule with its integration branch `feat/editable-model`.

## Fork changes

The vendored fork is a separate repository. Get approval for the exact behavior, keep the change minimal, and add tests. Run `pnpm verify` in the fork and confirm the changed files have no uncovered lines. Commit and push before copying `dist` and rebuilding the bundle.

## Completion

After the PR merges, post the closing proof on the issue and close it. A merged PR with an open issue is unfinished work.

## Gates

| Gate             | Command                      | Blocks merge |
| ---------------- | ---------------------------- | ------------ |
| Types            | `bun run typecheck`          | yes          |
| Code style       | `bun run lint:code`          | yes          |
| Formatting       | `bun run lint:format`        | yes          |
| Docs             | `bun run lint:docs`          | yes          |
| Dead code        | `bun run check:dead-code`    | yes          |
| Requirements     | `bun run check:requirements` | yes          |
| Bundle freshness | `bun run check:bundle-fresh` | yes          |
| Reproducibility  | `bun run check:reproducible` | yes          |
| Coverage         | `bun run test:coverage`      | yes          |
| Acceptance       | `bun run test:acceptance`    | UI changes   |

`bun run verify` runs the merge-blocking set in order. CI runs the same command, then `bunx openchamber-guest-check`.

## Determinism

- `packageManager` pins Bun; `bun.lock` is committed.
- CI installs with `bun install --frozen-lockfile`.
- The build has no timestamps, random values, or network access.
- `check:reproducible` builds twice and compares SHA-256.
- `check:bundle-fresh` fails when `editor/main.js` is stale.
- Snapshot versions derive only from file content.

## Privacy

- Never commit a real user document, tokens, or generated reports.
- Dev and test data must be synthetic.
- Do not add logging of file contents.
- Do not add network access or external assets.

## Definition of done

- Requirement and test are mapped.
- `bun run verify` is green.
- Acceptance is green when rendering changed.
- `editor/main.js` is rebuilt and committed.
- Docs and traceability are updated.
- README screenshots are uploaded to GitHub for visible UI changes.
- Release steps are in [`releases.md`](releases.md).
- The commit message describes the behavior, not the implementation.
