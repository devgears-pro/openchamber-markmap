# Change lifecycle

This repository uses a small, deterministic loop: requirement, failing test, minimal implementation, verification, review, documented evidence.

## Principles

- One behavior, one requirement, one failing test.
- The same source and lockfile produce the same bundle.
- The committed bundle is part of the source of truth.
- Every check runs locally and in CI with the same command.
- Docs are public. Use placeholders and synthetic examples; no local paths, usernames, sessions, or personal data.

## Planning

A feature or task is a GitHub issue from the feature template: a story (`As a ROLE, I want OUTCOME, so that REASON`), acceptance criteria, the `R-xx` it adds or changes, and scope. Acceptance criteria are testable statements, one per line.

A story joins one version milestone when it is planned, grouped by theme rather than date. A new feature joins the milestone whose theme fits; do not renumber or shift versions. Release mechanics are in [`releases.md`](releases.md). The roadmap is [issue #3](https://github.com/mmospanenko/openchamber-markmap/issues/3): one row per release, the release themes, and the 1.0 criteria. Do not mirror milestones or criteria in the repository.

The issue owns the outcome; [`requirements.md`](../requirements.md) owns the behavior; tests own the proof. Do not restate the requirement in the issue.

## Decision records

Most choices need no record. Write an ADR only when there were real options and the choice matters later. Discuss it with the user first, then add `docs/adr/NNNN-short-title.md`, starting at `0001`, link it from the issue, and commit it with the change it explains.

Keep it to the decision in the title, why, the options, and the trade-offs:

```md
# <Decision>

## Why

## Options

## Trade-offs
```

Do not restate the requirement or walk through the code. Do not rewrite an accepted ADR; add a new one and link both. The decision map in [issue #2](https://github.com/mmospanenko/openchamber-markmap/issues/2) links the records.

## Change types

| Type    | First artifact                                             | Required proof                         |
| ------- | ---------------------------------------------------------- | -------------------------------------- |
| Feature | Story issue and a requirement ID in `docs/requirements.md` | Failing test with `[R-xx]`, then green |
| Bug     | Issue with reproduction steps                              | Failing regression test, then green    |
| Chore   | No behavior change                                         | Existing checks stay green             |
| Docs    | No behavior change                                         | Markdownlint                           |

## Steps

1. **Define the requirement.** Add or reuse an ID in `docs/requirements.md`. State the observable behavior, not the implementation.
2. **Write the failing test.** Put `[R-xx]` in the test name. Run the smallest test command and keep the red output for the report.
3. **Implement the minimum.** Change only what the test needs. Keep the Markmap packages responsible for parsing, layout, and drawing.
4. **Refactor with the test green.** Remove duplication and dead code. Do not add comments.
5. **Run the gate.** `bun run verify` must pass. It includes typecheck, lint, requirement traceability, build, stale-bundle check, reproducible build check, and 100% coverage.
6. **Run acceptance when rendering changes.** `bun run test:acceptance` drives a real browser and the real Markmap packages.
7. **Rebuild the artifact.** `bun run build` updates `editor/main.js` and `chat/main.js`; commit both with the source.
8. **Update traceability.** Keep `docs/requirements.md` aligned with the tests.
9. **Review before the PR.** Start two fresh subagents: a core review of the code, and a design review of the solution and its architecture against the original story and its decision. Give both the story, the ADR when one exists, and the code. Address findings before opening the PR.
10. **Report evidence.** Use the chat report below.

## Chat report

After a task or bug fix, the chat reply links the work and its proof:

- The issue, when there is one, and the pull request.
- The cause for a bug, or the reason for a task.
- The test command, the red output, and the green output. For a visual change, the issue comment with a screenshot or GIF that `docs/process/releases.md` requires.
- The OpenChamber install address as a Markdown link whose visible text is the complete HTTPS URL and whose target is the percent-encoded desktop install deep link: [https://github.com/mmospanenko/openchamber-markmap#dev](openchamber://extensions/install?url=https%3A%2F%2Fgithub.com%2Fmmospanenko%2Fopenchamber-markmap%23dev). For a feature branch, use the exact branch name after `#` in the same link shape; the plain-text template is `https://github.com/mmospanenko/openchamber-markmap#<branch>`, and the deep link encodes `/` as `%2F`. Clicking the link opens the desktop Add-extension dialog with the URL filled in, but the user still must confirm the install, and browsers or mobile have no direct install flow. Keep the visible HTTPS URL so it can be copied. Always include the address, even when the worktree folder is also available.

## Worktrees and sync

All work happens in `.worktrees/<name>`, never in the main checkout; agents run in parallel.

When the work is done, push the worktree branch and open a PR into `dev`. Merge through GitHub after CI. Do not commit or merge directly into `dev`.

The fork follows the same rule with its integration branch `feat/editable-model`.

## Human UI acceptance

Do not merge a UI change into `dev` until the user has tested and explicitly accepted its appearance on the installable feature branch. Before asking for acceptance, provide the complete feature-branch install address as plain text, the changed states to check, and screenshots for a static change or a short GIF for an interaction. A UI test request must include the complete address, not only a shortened linked label. Green CI does not count as visual acceptance. If the user requests changes, update the same branch and provide fresh evidence before asking again.

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
- Core and design reviews are addressed.
- README screenshots are uploaded to GitHub for visible UI changes.
- Release steps are in [`releases.md`](releases.md).
- The commit message describes the behavior, not the implementation.
