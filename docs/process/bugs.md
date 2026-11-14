# Bugs

A bug is fixed only after a failing regression test proves the defect.

## Report

Open an issue from `.github/ISSUE_TEMPLATE/bug.md` and include:

- OpenChamber version, extension version, OS, and browser.
- File name pattern and a synthetic minimal file that reproduces the problem.
- Steps, expected result, actual result.
- Console or host output with secrets and user data removed.
- A screenshot or recording for visual defects.

Never attach a real user document. Reduce the case to synthetic Markdown.

## Regression test first

1. Add or reuse a requirement ID in `docs/requirements.md`.
2. Write a test with `[R-xx]` in its name that reproduces the defect.
3. Run the smallest command that executes the test and capture the red output.
4. Confirm the failure is the reported one, not a setup error.
5. Post the command and red output in the issue.
6. Only then change production code.

A fix without a red test is not accepted, except when a test is genuinely impossible. That exception needs a written reason and maintainer approval in the issue.

## Fix

- Make the smallest change that turns the test green.
- Keep the Markmap packages responsible for parsing, layout, and drawing.
- Do not add a workaround that changes the file or hides the failure.
- Run `bun run verify`.
- Run `bun run test:acceptance` when rendering, layout, theme, or the toolbar changed.
- Rebuild and commit `editor/main.js`.

## Evidence

The final report states:

- `done` or `blocked`.
- Commit and branch.
- The regression test name and command.
- Red output before the fix and green output after.
- Verification commands and results.
- Screenshots for visual changes.
- Any remaining limitation.
