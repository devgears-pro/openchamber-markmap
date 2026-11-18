# Testing

## Levels

| Level        | Tool                                 | What it proves                                                                                                |
| ------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Types        | `tsc --noEmit`                       | The code satisfies the strict TypeScript option set, including tests and scripts.                             |
| Unit         | Vitest                               | The adapter maps Markmap APIs, options, updates, and cleanup correctly.                                       |
| DOM          | Vitest + happy-dom                   | The host contract, node selection, theme, snapshot, and fallback behavior.                                    |
| Contract     | Vitest                               | `package.json` parses with the OpenChamber manifest schema.                                                   |
| Bundle       | Vitest                               | The entry is one classic script and the IIFE stays within budget.                                             |
| Acceptance   | Playwright                           | The real renderer draws a map, mounts its toolbar, and the keyboard editor inserts, edits, and removes nodes. |
| Static       | ESLint, Prettier, markdownlint, Knip | Strict type-aware rules, formatting, docs, and dead code.                                                     |
| Reproducible | `check:reproducible`                 | Two builds from the same tree produce identical bytes.                                                        |

## Commands

```bash
bun run test             # Vitest
bun run test:coverage    # Vitest with the 100% gate
bun run test:acceptance  # Playwright, real browser, real Markmap
bun run benchmark        # Playwright performance benchmark, local report only
bun run verify           # all merge-blocking checks
```

## Coverage

`vitest.config.ts` requires 100% statements, branches, functions, and lines for every file in `src/`, including `src/main.ts`, and checks the thresholds per file. The bootstrap is covered by a unit test that mocks `connectHost`, `mountApp`, and the Markmap factory, so the root lookup and the mount wiring are exercised without the OpenChamber frame.

Coverage is not a substitute for assertions. A test that calls code without checking observable behavior does not count as proof.

## Requirement traceability

Every requirement ID from `docs/requirements.md` appears in at least one test name as `[R-xx]`. Every test file has at least one ID. `bun run check:requirements` enforces both directions and fails on unknown IDs.

When a requirement changes:

1. Update the requirement text.
2. Update or add a failing test with the ID.
3. Implement the change.
4. Update the traceability table.

## Test design

Design the cases before writing the first failing test. List the behaviors, the branches, the equivalent inputs, and the boundaries, then keep the smallest set that covers them. A decision table or a short list in the work notes is enough; the design itself need not be committed.

- Add a case only when it proves a behavior or branch that the existing cases do not.
- Prefer the cheapest level that can prove the behavior: unit and DOM tests for logic and host wiring, acceptance for the real Markmap, layout, and gestures.
- Keep the test pyramid: many cheap unit and DOM tests, few acceptance tests. Acceptance proves integration once, not every branch.
- Arrange, act, assert. One observable behavior per test.
- Prefer real DOM behavior over implementation details.
- Mock only the Markmap boundary in unit tests; acceptance covers the real library.
- No network, timers, locale, timezone, or random values in tests.
- Use the synthetic `dev/sample.md` and inline test strings. Never use a real user document.
- A regression test must fail for the reported reason before the fix.

## Acceptance

Playwright starts the Vite harness and opens `/dev/`, and `/dev/block.html` for the chat block. It asserts on the rendered SVG, the Markmap toolbar, the layout switcher, soft theme depth styles in light and dark, the edit field matching each label style, node selection, keyboard edits, arrow navigation, folding, undo and redo, clipboard copy, cut, and paste, node dragging with its drop indicator, move keys, notes editing, opening at 100% with reset, theme state, read-only rendering, new empty file editing, editor errors, wheel gestures, the chat block, and accessible names. Screenshots are optional evidence for a report; the gate uses DOM assertions, not pixel diffs.

## Performance benchmark

`bun run benchmark` starts the dev harness in headless Chromium at a fixed 1280x800 viewport and measures synthetic small and 1,000-node maps. It reports p50 and p95 in whole milliseconds for open/render, selection, edit/type, commit, pan, and zoom, one row per map and scenario. Each scenario uses 20 measured runs after one unmeasured warm-up, and each interaction sample reloads the harness.

Open/render covers full harness navigation through parse and first render, including Vite module loading and host mount. Selection, edit/type, commit, pan, and zoom use real Playwright mouse, keyboard, and wheel input. Each timer starts inside the browser at the trusted input event, waits two animation frames, records the elapsed time, then verifies the visible selection, typed draft, committed label, transform, or scale result. Edit/type opens the label field before timing and measures one typed character through its preview. Commit measures the incremental Enter on that fully previewed draft plus the two-frame settle, and verifies the host snapshot contains the committed label. `p95` is the nearest-rank 19th of 20 samples. The numbers are machine-local comparisons, not input-to-paint/INP or absolute user latency.

The benchmark runs one worker and always starts its own Vite server on a fixed port; it never reuses another checkout's server. It uses only local synthetic maps, makes no external request, records no telemetry, writes no report, and asserts no absolute time limit. The command is not part of `bun run verify` or CI; use it to compare changes on the same machine and to propose budgets. Record proposed budgets in the issue that asks for them; do not turn them into test thresholds.

The synthetic maps come from `dev/benchmark.ts`: `benchmark-small` has 49 nodes and `benchmark-1000` has 1,000. `benchmarks/map-performance.spec.ts` owns the scenarios, and `playwright.benchmark.config.ts` fixes the environment.

## Demo recordings

A presentation uses a 3-6 second GIF. A milestone demo stays one video across the release features. Record both with a throwaway Playwright spec; typical cases are editing, keyboard, pan and zoom, markers, folding, and drag.

Use the spec with a video:

```ts
test.use({
  video: {
    mode: 'on',
    size: { width: 1200, height: 800 },
    show: { actions: { duration: 600 } },
  },
});
```

Keep a presentation to 3-6 seconds and pause between actions. The video is written after the context closes. For a presentation GIF, convert the WebM:

```bash
ffmpeg -y -i <video>.webm \
  -vf "fps=12,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  -loop 0 tmp/demo.gif
```

Write the result to `tmp/` and upload it to the issue or release comment. Do not commit the spec, video, or GIF.

## What not to do

- Do not lower coverage thresholds to merge a change.
- Do not add `v8 ignore` comments or exclude files without a written reason.
- Do not assert on generated bundle text beyond the IIFE and budget checks.
- Do not replace the real Markmap adapter with a permanent mock in production code.
