# Changelog Table

| Version | Week | Object |
|---|---|---|
| `1.0.4` | 1 | Rename npm package to spokes-ai-humanism (name collision on the registry) |
| `1.0.3` | 1 | Fix graph structure and navigability (clustering, click-to-focus, line routing) |
| `1.0.2` | 1 | Fix scroll-to-zoom sensitivity in spokes-graph.html |
| `1.0.1` | 1 | Fix spokes-graph.html visibility and navigability |
| `1.0.0` | 1 | Implement spokes v1.0.0: dependency-shape linter (M0-M2) |

## Changelog Summary

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
