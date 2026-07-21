# Code Review: spokes v1.1.1 (graph id sanitization)

**Review Date**: 2026-07-21
**Version**: 1.1.1
**Files Reviewed**: `src/render/mermaid.ts`, `src/render/dot.ts`,
`tests/render/id-sanitization.test.ts`, `fixtures/f12-nextjs-paths/`
**Plan**: none — bug fix (a user pointed out that Next.js `(app)` route groups and `[id]` /
`[...path]` dynamic segments land unsanitized in Mermaid ids).

---

## Executive Summary

`nodeId()` only stripped `/` and `.`, so paths containing Mermaid's shape-reserved characters
(`(`, `)`, `[`, `]`) produced ids that made the whole flowchart fail to parse — not a cosmetic
glitch, a total render failure ("Syntax error in text", empty viewport) on any Next.js app-router
repo. Fix: both duplicate `nodeId()` copies now collapse every non-`[A-Za-z0-9_]` character to
`_`. **APPROVED** — reproduced and fixed against a real project in-browser, not just asserted.

## Findings

### Correctness
- The fix is the minimal correct one: restricting ids to word characters both satisfies Mermaid's
  grammar and preserves the deterministic-SVG-id contract `render/html.ts` relies on for
  click-to-focus (Mermaid emits a word-only id verbatim; a char it would have rewritten there
  would have desynced focus from the source-parsed adjacency). Verified the round-trip holds on
  route-group/dynamic-segment nodes in the browser.
- Labels are deliberately **not** sanitized — parens/brackets inside a quoted Mermaid label are
  valid (probe-tested: `parens`, `brackets`, `[...path]`, and subgraph titles all render), and
  the reader needs to see the real path. This was checked, not assumed; an earlier hypothesis
  that labels also needed escaping was falsified by the probe before any code was written for it.

### Architectural Compliance
- `render/mermaid.ts` and `render/dot.ts` remain single-export spokes; `nodeId` stays a private
  helper duplicated across both by the same spoke-single-import constraint as the pre-existing
  `ROLE_STYLE`/`violatingPaths` duplication. No new imports, no edge changes.
- DOT was arguably never broken (it quotes its ids, so `"app_(app)_x"` is legal) — the change is
  applied there too for consistency and is harmless; the test asserts DOT's quoted id tokens are
  word-only without falsely flagging DOT's legitimate `[attr]` attribute-list syntax.

### Minor observations (accepted)
1. Sanitization can in principle collapse two distinct paths to the same id (e.g. `a-b/c` vs
   `a_b/c`). This collision class pre-existed the fix (`.` and `/` already both mapped to `_`) and
   is not introduced here; a genuinely robust dedupe would be a separate change. Not worth it for
   the observed frequency (zero in any real fixture).

## Verification performed (run, not just read)

- Real repro: generated the graph for the `Kalvi Seyarkai Nunnarivu` Next.js frontend before the
  fix → blank pane + "Syntax error in text" (screenshotted); after → renders (1 SVG, 28 nodes,
  62 edges, `hasError:false`), served over HTTP so Mermaid actually executed (the file:// preview
  serves a non-executing static snapshot and cannot be trusted for this).
- Mermaid label-escaping probe (6 cases) to confirm labels need no escaping.
- Click-to-focus id round-trip check: 26/28 nodes match source adjacency (2 = edge-less nodes).
- `npm test` — 51/51 (47 prior unchanged + 3 new unit + 1 new fixture); `spokes check` on this
  repo still clean.

---

## Verdict

**APPROVED**

Rendering-only fix, no `--json`/diagnostics impact. Regression-covered by a direct render unit
test and a CLI fixture. Publishing to npm remains a separate, not-yet-taken action.
