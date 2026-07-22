# Code Review: spokes v1.1.2 (coverage gaps + split-filename sanitization)

**Review Date**: 2026-07-21
**Version**: 1.1.2
**Files Reviewed**: `src/graph.ts`, `tests/commands.test.ts`, `tests/render/graph-split.test.ts`
**Plan**: none — follow-up to a completeness audit ("is this project complete or are there
stubs?"). The audit found no stubs; these are the two real gaps it did surface.

---

## Executive Summary

Audit result: no stubs. Every module has exactly one implemented export, all five commands run
clean, and the single unimplemented flag (`suggest --write`) fails loudly and is documented as
reserved. The two genuine gaps were (a) one stale sanitization call in `graph.ts` and (b) three
untested code paths. Both closed. **APPROVED.**

## Findings

### Fix quality
- `src/graph.ts:85` now matches `render/mermaid.ts`'s `nodeId()` sanitization. Low-severity by
  itself (parens are legal in filenames, and the path is only reachable above 300 nodes), but it
  was the last surviving copy of the pattern that caused the v1.1.1 render failure — leaving it
  would have invited the same bug back through a different door.

### Test quality
- The `graph-split` test was **verified to fail on the pre-fix code**
  (`expected 'spokes-graph-src_(app).html' to match /^[A-Za-z0-9_.-]+$/`) before being accepted.
  A regression test that passes both before and after the fix proves nothing; this one was
  checked both ways.
- `init`'s `$schema` assertion deliberately reads the expected package name from the repo's own
  `package.json` rather than hard-coding `spokes-ai-humanism`. Hard-coding would have re-created
  exactly the v1.0.4 failure mode (a rename silently invalidating the value written into user
  repos); deriving it means a future rename either keeps the test honest or fails it loudly.
- The 320-file repo for the split test is generated at runtime, not committed — committing 320
  trivial files to exercise one branch would bloat the fixture tree for no added signal.
- `explain` coverage includes the exit-2 not-a-node path and the `./x` vs `x` normalization,
  which is the only behavior in `cli.ts`'s `toPosixRelative` that a user is likely to hit.

### Minor observations (accepted)
1. `explain`/`init` tests spawn the real CLI (like the fixture suite) rather than calling the
   exported functions directly. Slower, but it's the only way to observe `process.exit(2)` and
   the actual written file — which is the behavior that matters for both.

## Verification performed (run, not just read)

- `npm test` — 60/60 (51 prior unchanged, +9 new).
- Regression-guard check: reverted `graph.ts`, rebuilt, confirmed the new test fails; restored
  and confirmed it passes.
- `npx tsc --noEmit` — clean. `spokes check` on this repo — clean.
- Manually exercised all five commands end-to-end (`init`, `check`, `check --json`, `graph`,
  `graph --format dot`, `suggest`, `explain`) — all exit 0 and write the expected artifacts.

---

## Verdict

**APPROVED**

No behavior change for users beyond the split-path filenames. Three previously-unguarded code
paths are now covered.
