# Code Review: spokes v1.0.4 (npm package rename)

**Review Date**: 2026-07-20
**Version**: 1.0.4
**Files Reviewed**: `package.json`, `package-lock.json`, `src/init.ts`, `README.md`
**Plan**: no plan — unplanned change (npm publish name collision discovered when the user asked
whether the package was already published)

---

## Executive Summary

The npm registry already has an unrelated package named `spokes` (a pub/sub event library,
published 2025, unaffiliated with this project) — confirmed via `npm view spokes`. Since this
project has never been published, renaming was the only option before a first publish could ever
happen. Renamed the npm package to `spokes-ai-humanism` (confirmed available via `npm view
spokes-ai-humanism` returning 404) while keeping the CLI command itself as `spokes` (the `bin`
field's key, unaffected by the package `name` field) — per explicit user decision to minimize
churn to existing documentation and command examples. **APPROVED with observations** — code
review skipped as a formal loop (mechanical rename, no logic change); every touched path verified
by direct execution rather than static reading.

---

## Changes Overview

- `package.json`: `name` field `"spokes"` → `"spokes-ai-humanism"`. `bin.spokes` (the command
  users actually type) is unchanged.
- `package-lock.json`: regenerated via `npm install` to match (also picked up a stale `version`
  field that had drifted to `1.0.0` and was never refreshed by prior patches — now correctly
  `1.0.4`).
- `src/init.ts`: `DEFAULT_CONFIG.$schema`, the value **written into every other project** that
  runs `spokes init`, updated from `./node_modules/spokes/schema.json` to
  `./node_modules/spokes-ai-humanism/schema.json` — this is the real behavioral change here (not
  just this repo's own identity), since the old value would have pointed at a schema file that
  doesn't exist once installed under the new package name.
- `README.md`: install instructions updated to `npm install --save-dev spokes-ai-humanism`, with
  an explicit note that `npx spokes ...` in Quick Start only works after that install step (it
  resolves to the local `node_modules/.bin/spokes`, not a zero-install registry lookup — a
  zero-install `npx spokes` would in fact invoke the *other*, unrelated `spokes` package).

---

## Findings

### Critical / Major / Minor Issues
None.

### Suggestions

**1.** No `publishConfig`/`repository` field changes were made — this patch only makes the
package *nameable*, it doesn't perform an actual `npm publish`. That remains a separate,
explicit, user-authorized action (not taken in this session).

---

## Checklist

- [x] 1. Functional Requirements — name collision correctly identified via live registry lookup
  (not assumed); replacement name confirmed available the same way, not guessed
- [x] 2. Code Quality — single-purpose rename, no unrelated changes bundled in
- [x] 3. Architectural Compliance — `src/init.ts` remains a hub with its single required export;
  no import/edge changes
- [x] 4. Error Handling — n/a
- [ ] 5. Security — not applicable
- [x] 6. Performance — n/a

**Verification performed** (not just read, actually run):
- `npm view spokes` — confirmed the name collision is real, not assumed.
- `npm view spokes-ai-humanism` — confirmed 404 (available) before committing to the new name.
- `npx tsc --noEmit` — clean.
- `npm test` — 32/32 passing, including the meta-dogfooding test (the rename didn't touch
  anything the tool's own `spokes check` would flag).
- Ran `spokes init` fresh against a scratch directory and inspected the written
  `spokes.config.json` — confirmed `$schema` now reads
  `./node_modules/spokes-ai-humanism/schema.json`, not the stale value.

---

## Verdict

**APPROVED with observations**

Formal code-review loop skipped (mechanical rename, verified end-to-end by execution rather than
static reading). All 32 existing tests still pass. Publishing to the registry itself remains a
separate, not-yet-taken action.
