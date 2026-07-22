# Changelog Table

| Version | Week | Object |
|---|---|---|
| `1.1.2` | 1 | Close explain/init/graph-split coverage gaps; sanitize split-diagram filenames |
| `1.1.1` | 1 | Sanitize graph ids so Next.js route-group / dynamic-segment paths render |
| `1.1.0` | 1 | Python language support (check/graph/suggest/explain on Python and mixed repos) |
| `1.0.4` | 1 | Rename npm package to spokes-ai-humanism (name collision on the registry) |
| `1.0.3` | 1 | Fix graph structure and navigability (clustering, click-to-focus, line routing) |
| `1.0.2` | 1 | Fix scroll-to-zoom sensitivity in spokes-graph.html |
| `1.0.1` | 1 | Fix spokes-graph.html visibility and navigability |
| `1.0.0` | 1 | Implement spokes v1.0.0: dependency-shape linter (M0-M2) |

## Changelog Summary

- **v1.1.2** (Week 1, 21-07-2026) — Patch. Completeness audit follow-up: no stubs found, but
  `graph.ts`'s >300-node split path still built filenames with the stale `[/.]` sanitization
  (`spokes-graph-src_(app).html`), and `explain`, `init`, and the split path had no tests at all.
  Filename sanitization aligned with the renderers; 9 new tests. See
  `docs/2-changelog/w1_v1.1.2.md`.
- **v1.1.1** (Week 1, 21-07-2026) — Patch. `spokes graph` produced an unparseable diagram
  ("Syntax error in text", blank pane) on repos with `()`/`[]` in paths — Next.js route groups
  (`app/(app)/...`) and dynamic segments (`[id]`, `[...path]`). `nodeId()` now collapses every
  non-`[A-Za-z0-9_]` char to `_` in both `render/mermaid.ts` and `render/dot.ts`; labels keep the
  real path, and the click-to-focus SVG-id contract stays intact. See
  `docs/2-changelog/w1_v1.1.1.md`.
- **v1.1.0** (Week 1, 21-07-2026) — Minor. Python language support: a hand-rolled import/export
  scanner and filesystem resolver (`src/core/parser-py.ts` / `resolver-py.ts`) feed the same
  graph and rules; `# @spokes` pragmas, `pyproject.toml` root detection, TYPE_CHECKING as
  type-only edges, `__all__`-aware R4, Python-style suggest previews, fixture `f11-python`.
  No new dependencies, no Python interpreter. See `docs/2-changelog/w1_v1.1.0.md`.
- **v1.0.4** (Week 1, 20-07-2026) — Patch. npm package renamed to `spokes-ai-humanism` after
  discovering `spokes` was already taken on the registry by an unrelated package; the CLI command
  itself stays `spokes`. See `docs/2-changelog/w1_v1.0.4.md`.
- **v1.0.3** (Week 1, 20-07-2026) — Patch. Directory-based subgraph clustering, click-to-focus
  highlighting (dim everything except a clicked file's direct connections), and right-angle
  edge routing to replace the tangled default curve style. See `docs/2-changelog/w1_v1.0.3.md`.
- **v1.0.2** (Week 1, 20-07-2026) — Patch. Fixed scroll-to-zoom feeling too sensitive (fixed
  10%-per-event step) and always anchoring at the top-left corner instead of the cursor. See
  `docs/2-changelog/w1_v1.0.2.md`.
- **v1.0.1** (Week 1, 20-07-2026) — Patch. Fixed `spokes-graph.html` rendering dark-on-dark under
  browser dark mode, and replaced the viewport-squeezed static diagram with a pan/zoom-capable
  viewer (scroll-to-zoom, drag-to-pan, fit-to-screen). See `docs/2-changelog/w1_v1.0.1.md`.
- **v1.0.0** (Week 1, 20-07-2026) — Initial release. Full `spokes` CLI implementing the M0–M2
  build spec: static import-graph parsing, hub/spoke degree-rule + acyclicity checking (R1–R4),
  deterministic Mermaid/DOT/HTML diagram generation, and cycle-extraction suggestions. See
  `docs/2-changelog/w1_v1.0.0.md` for details.
