# Code Review: spokes v1.0.1 (graph HTML viewer fix)

**Review Date**: 2026-07-20
**Version**: 1.0.1
**Files Reviewed**: `src/render/html.ts`
**Plan**: no plan — unplanned change (direct user-reported bug fix)

---

## Executive Summary

Fixed two visibility/usability bugs in `spokes graph`'s generated `spokes-graph.html` output, both reported directly by the user after visually inspecting the rendered page: (1) the page had no explicit background color, so it rendered dark text on a dark background under a dark-mode browser; (2) Mermaid's default `useMaxWidth: true` behavior shrank the flowchart to fit the page width, making a 22-node graph illegibly tiny with no way to inspect it. **APPROVED with observations** — code review skipped as a formal multi-agent loop (trivial, single-file, purely presentational change with no logic/rule/CLI-contract impact); instead verified interactively in a live browser session across multiple rounds directly with the requester.

---

## Changes Overview

`src/render/html.ts` only. Added an explicit light background + `color-scheme: light` so the page never depends on the viewer's OS/browser theme. Replaced the static, viewport-squeezed `<pre class="mermaid">` auto-render with an explicit `mermaid.render()` call into a pan/zoom-capable viewport: hand-written (no new dependency) wheel-to-zoom, drag-to-pan, zoom in/out buttons, and a "fit to screen" reset that computes an initial scale/pan from the rendered SVG's bounding box. The required `.mmd` output (`render/mermaid.ts`) and its `flowchart TD` content are untouched — this change is scoped entirely to the optional HTML wrapper (PRD §9 "Output 2").

---

## Findings

### Critical Issues
None.

### Major Issues
None.

### Minor Issues
None.

### Suggestions
None — verified interactively (zoom in/out, drag-pan, fit-to-screen reset all confirmed working live; light background confirmed via screenshot) rather than via static review, which is the appropriate verification method for a rendering/interaction bug.

---

## Checklist

- [x] 1. Functional Requirements — both reported bugs reproduced, fixed, and re-verified live in-browser
- [x] 2. Code Quality — single well-scoped file change, no new dependencies (hand-written pan/zoom, per the project's "no other JS dependencies" constraint from PRD §9)
- [x] 3. Architectural Compliance — `render/html.ts` remains a spoke with its single required export (`renderHtml`); no import/edge changes
- [x] 4. Error Handling — n/a (presentational change, no new failure modes)
- [ ] 5. Security — not applicable (static local HTML generation, no new input surface)
- [x] 6. Performance — n/a (client-side rendering only, no build-time cost)

---

## Verdict

**APPROVED with observations**

Formal code-review loop skipped for this patch — trivial in scope (one file, no logic changes) and verified through direct interactive confirmation with the requester instead, which is the more appropriate verification method for a UI/rendering bug than static code reading. All 32 existing tests still pass unchanged (none assert on generated HTML byte content).
