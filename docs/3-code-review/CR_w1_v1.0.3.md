# Code Review: spokes v1.0.3 (graph structure & navigability overhaul)

**Review Date**: 2026-07-20
**Version**: 1.0.3
**Files Reviewed**: `src/render/mermaid.ts`, `src/render/html.ts`
**Plan**: no plan — unplanned change (direct user-reported usability issue)

---

## Executive Summary

Addressed a structural readability complaint: as the file count grows, a flat Mermaid flowchart
of every file with every import edge reads as an undifferentiated "hairball" with no way to
isolate a single file's context. Three changes, verified live in a browser session across
multiple iterations: (1) nodes are now clustered into one Mermaid `subgraph` per containing
directory, so related files group visually instead of scattering; (2) clicking a file dims
everything except that file and its direct connections, with a "Clear focus" reset; (3) edge
routing switched from Mermaid's default smooth/overlapping curves to right-angle `step` routing,
so individual connections read as distinct traceable segments instead of tangled diagonal splines.
**APPROVED with observations** — code review skipped as a formal multi-agent loop (scoped to two
rendering files, no logic/rule/CLI-contract impact); verified interactively with the requester
across several rounds of live feedback.

---

## Changes Overview

`src/render/mermaid.ts`: nodes are grouped by `dirOf(path)` into a `Map`; each non-root group
renders as a `subgraph <dirId>_dir["<dir>"] ... end` block; root-level files (no `/` in path)
render ungrouped, at the top level, for repos where the include glob matches files outside any
subdirectory. Edge lines and `style` lines are unaffected — both remain valid regardless of which
subgraph (if any) their referenced node id lives in.

`src/render/html.ts`: switched `mermaid.render()`'s import from `startOnLoad` auto-processing
(already the case since v1.0.1) to explicit rendering with `flowchart.curve: 'step'`. Added a
click-to-focus interaction: the diagram source's own `"  from --> to"` lines (a format this file
fully controls) are parsed client-side into an adjacency map — deliberately *not* reverse-engineered
from Mermaid's rendered SVG structure, which would be far more fragile. Node/edge SVG element
identity is resolved via Mermaid's deterministic id scheme (`<renderId>-flowchart-<ourId>-<n>` for
nodes, `<renderId>-L_<from>_<to>_<n>` for edges), which is reliable specifically because this file
controls the `renderId` string passed into `mermaid.render()`. Click vs. drag-to-pan is
disambiguated by mouse-movement distance from mousedown to mouseup (`CLICK_THRESHOLD = 4px`).

---

## Findings

### Critical / Major / Minor Issues
None.

### Suggestions

**1.** The click/drag disambiguation and SVG id-parsing approach is deterministic given this
file's control over the Mermaid render id and diagram source format, but is inherently coupled to
Mermaid's current internal id-naming convention (`-flowchart-<id>-<n>`, `-L_<from>_<to>_<n>`) — a
future Mermaid major-version bump could change this scheme and silently break focus-highlighting
(degrading gracefully to "click does nothing" rather than erroring, since `ourNodeId()` returns
`null` for unrecognized ids). Not urgent; noted for future maintainers.

**2.** `ROLE_STYLE`/`nodeId`/`violatingPaths` duplication between `render/mermaid.ts` and
`render/dot.ts` (accepted in the v1.0.0 review) is now joined by the same directory-grouping
logic existing only in `mermaid.ts` — `dot.ts` does not (yet) cluster nodes with DOT `subgraph
cluster_*` blocks. Not requested by the user (whose complaint was specifically about the HTML/
Mermaid viewer), so left out of scope for this patch; worth a follow-up if DOT output usability
becomes a concern.

---

## Checklist

- [x] 1. Functional Requirements — clustering, focus-highlighting, and step-routing all verified live via screenshots and interactive clicks/scrolls in a real browser session
- [x] 2. Code Quality — no new dependencies; click/edge-id resolution deliberately built on data this code already fully controls (diagram source text, render id) rather than fragile DOM introspection
- [x] 3. Architectural Compliance — both files remain spokes/whatever role they already had, single required export unchanged, no new import edges
- [x] 4. Error Handling — `ourNodeId()` returns `null` gracefully for unrecognized element ids rather than throwing
- [ ] 5. Security — not applicable
- [x] 6. Performance — n/a (client-side rendering/interaction only); determinism test confirms no non-determinism introduced by the grouping logic

---

## Verdict

**APPROVED with observations**

Formal code-review loop skipped for this patch (scoped to two rendering files, verified through
direct interactive confirmation across several rounds — the appropriate method for a visual/UX
readability complaint). All 32 existing tests still pass unchanged, including the determinism
test (subgraph grouping remains fully deterministic).
