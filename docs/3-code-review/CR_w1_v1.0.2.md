# Code Review: spokes v1.0.2 (graph HTML zoom sensitivity fix)

**Review Date**: 2026-07-20
**Version**: 1.0.2
**Files Reviewed**: `src/render/html.ts`
**Plan**: no plan — unplanned change (direct user-reported bug fix)

---

## Executive Summary

Fixed scroll-to-zoom being too sensitive in `spokes-graph.html`'s pan/zoom viewer (introduced in
v1.0.1): each wheel event applied a fixed ±10% zoom step regardless of scroll magnitude, which
felt jumpy — especially on trackpads that emit many small wheel events per gesture. Also fixed a
related UX issue: zoom was always anchored at the content's top-left corner (`transform-origin: 0
0`), so zooming caused the view to jump around instead of staying centered on what the user was
looking at. **APPROVED with observations** — code review skipped as a formal loop (trivial,
single-file, no logic/rule/CLI-contract impact); verified interactively with the requester.

---

## Changes Overview

`src/render/html.ts` only, scoped to the wheel-event handler added in v1.0.1. Replaced the fixed
10%-per-event zoom step with a step proportional to `e.deltaY` (`Math.exp(-deltaY * 0.0015)`), so
trackpads' small continuous events zoom smoothly and mouse-wheel notches zoom by a comparable,
controlled amount. Also made zoom anchor under the cursor position (compute the content-space
point under the cursor before the scale change, then adjust `panX`/`panY` after so that point
stays fixed on screen) instead of the fixed top-left origin.

---

## Findings

### Critical / Major / Minor Issues
None.

### Suggestions
None — verified interactively: a moderate scroll now produces a smooth, anchored zoom (confirmed
via screenshots showing `src/cli.ts`/`src/init.ts`/`src/explain.ts` growing legible without the
view jumping to an extreme or unrelated position).

---

## Checklist

- [x] 1. Functional Requirements — reported sensitivity issue reproduced, fixed, and re-verified live
- [x] 2. Code Quality — single well-scoped change, no new dependencies
- [x] 3. Architectural Compliance — `render/html.ts` remains a spoke with its single required export
- [x] 4. Error Handling — n/a (presentational change)
- [ ] 5. Security — not applicable
- [x] 6. Performance — n/a (client-side interaction only)

---

## Verdict

**APPROVED with observations**

Formal code-review loop skipped for this patch (trivial scope, verified interactively — the
appropriate method for tuning an interaction/feel bug). All 32 existing tests still pass unchanged.
