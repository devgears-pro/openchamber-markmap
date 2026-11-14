# Change lifecycle

This repository uses a small, deterministic loop: requirement, failing test, minimal implementation, verification, documented evidence.

## Principles

- One behavior, one requirement, one failing test.
- The same source and lockfile produce the same bundle.
- The committed bundle is part of the source of truth.
- Every check runs locally and in CI with the same command.
- No user data in the repository, fixtures, logs, or screenshots.
- No comments in code. Tests and docs explain behavior.

## Change types

| Type    | First artifact                           | Required proof                         |
| ------- | ---------------------------------------- | -------------------------------------- |
| Feature | Requirement ID in `docs/requirements.md` | Failing test with `[R-xx]`, then green |
| Bug     | Issue with reproduction steps            | Failing regression test, then green    |
| Chore   | No behavior change                       | Existing checks stay green             |
| Docs    | No behavior change                       | Markdownlint and link check            |

## Steps

1. **Define the requirement.** Add or reuse an ID in `docs/requirements.md`. State the observable behavior, not the implementation.
2. **Write the failing test.** Put `[R-xx]` in the test name. Run the smallest test command and keep the red output for the report.
3. **Implement the minimum.** Change only what the test needs. Keep the Markmap packages responsible for parsing, layout, and drawing.
4. **Refactor with the test green.** Remove duplication and dead code. Do not add comments.
5. **Run the gate.** `bun run verify` must pass. It includes typecheck, lint, requirement traceability, build, stale-bundle check, reproducible build check, and 100% coverage.
6. **Run acceptance when rendering changes.** `bun run test:acceptance` drives a real browser and the real Markmap packages.
7. **Rebuild the artifact.** `bun run build` updates `editor/main.js`; commit it with the source.
8. **Update traceability.** Keep `docs/requirements.md` aligned with the tests.
9. **Report evidence.** Include the command, result, commit, and screenshots for UI changes.

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

- Never commit a real user document, even as a fixture.
- Dev and test data must be synthetic.
- Do not add logging of file contents.
- Do not add network access or external assets.

## Definition of done

- Requirement and test are mapped.
- `bun run verify` is green.
- Acceptance is green when rendering changed.
- `editor/main.js` is rebuilt and committed.
- Docs and traceability are updated.
- README screenshots are regenerated for visible UI changes.
- A published version follows [`release.md`](release.md).
- The commit message describes the behavior, not the implementation.
