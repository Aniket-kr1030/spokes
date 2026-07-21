# Architecture: spokes

A CLI dependency-shape linter for TS/JS repos. Parses the static import graph, classifies every
file as a **hub** (in-degree ≤ 1) or **spoke** (out-degree ≤ 1), enforces those degree rules plus
acyclicity, and mechanically renders the result as a Mermaid/DOT/HTML architecture diagram. The
tool's own `src/` obeys its own rules (verified by `tests/meta.test.ts`) — this dogfooding
requirement is the load-bearing constraint behind every module boundary below.

## Module map

```
src/cli.ts (hub, in=0, entry point)
 ├─ init.ts          (hub, in=1 ← cli.ts)
 ├─ graph-builder.ts (hub, in=1 ← cli.ts)   -- builds the Graph ONCE
 ├─ check.ts         (hub, in=1 ← cli.ts)   -- receives Graph as a fn argument
 ├─ graph.ts         (hub, in=1 ← cli.ts)   -- receives Graph as a fn argument
 ├─ suggest.ts       (hub, in=1 ← cli.ts)   -- receives Graph as a fn argument
 └─ explain.ts       (hub, in=1 ← cli.ts)   -- receives Graph as a fn argument

src/types.ts          (spoke via `// @spokes spoke` pragma; pure types, zero imports, zero value exports)
src/core/config.ts     (spoke) -- loads + hand-validates spokes.config.json
src/core/roles.ts       (spoke) -- pragma + config-glob role resolution
src/core/parser.ts      (spoke) -- TS compiler API AST walk: imports/exports
src/core/parser-py.ts   (spoke) -- hand-rolled Python import/export scanner (string-masked, line-based)
src/core/resolver.ts    (spoke) -- ts.resolveModuleName-based specifier resolution
src/core/resolver-py.ts (spoke) -- filesystem-based dotted-specifier resolution (mod.py / pkg/__init__.py)
src/rules/r1-spoke-outdegree.ts  (spoke) -- S001
src/rules/r2-hub-indegree.ts     (spoke) -- S002
src/rules/r3-acyclicity.ts       (spoke) -- S003, iterative 3-color DFS
src/rules/r4-single-export.ts    (spoke) -- S004
src/render/text.ts, json.ts, mermaid.ts, dot.ts, html.ts, diff.ts  (each a spoke)
```

**Why this shape**: `graph-builder.ts` is built once inside `cli.ts` and the resulting `Graph`
is passed as a **plain function argument** to `check`/`graph`/`suggest`/`explain` — passing data
as a call argument is not a static import, so it creates no edge, which is what lets four
different command modules share one graph without any of them (or `graph-builder.ts`) violating
the hub in-degree-≤1 rule. `graph-builder.ts` itself lives at the top level of `src/` (not
`src/core/`) specifically so the repo's own `roles` config classifies it as a hub via the
`src/*.ts → hub` glob — it needs unconstrained out-degree for its four internal imports.
`types.ts` is the one exception to that glob: it carries its own `// @spokes spoke` pragma
(pragma wins over config glob) since it's imported everywhere and would otherwise trip the hub
in-degree rule.

Every rule/render module is capped at exactly one internal import edge (the spoke constraint),
which forces small helper duplication in a few places rather than a shared helper module — e.g.
`reconstructSpecifier` (recovering a plausible import-specifier string from two resolved paths,
since `Edge` doesn't retain the literal text) appears independently in both
`rules/r3-acyclicity.ts` and `suggest.ts`; `ROLE_STYLE`/`nodeId`/`violatingPaths` appear in both
`render/mermaid.ts` and `render/dot.ts`. This is intentional, not an oversight — see
`docs/1-plans/F_1.0.0_spokes-dependency-linter.plan.md` for the full reasoning.

Every hub/spoke module also exports exactly **one** function (rule R4, dogfooded on the tool's
own source), except modules with zero value exports (like `types.ts`), which are exempt by
design — see the plan's documented R4 interpretation for why a 0-count never triggers S004.

## Data flow

1. `cli.ts` parses argv via `commander`, resolves `repoRoot = process.cwd()`.
2. `loadConfig(repoRoot)` (`core/config.ts`) reads and hand-validates `spokes.config.json`.
3. `buildGraph(config, repoRoot)` (`graph-builder.ts`) globs files via `fast-glob`, parses each
   with `core/parser.ts` (`.py` files: `core/parser-py.ts`), resolves each import specifier with
   `core/resolver.ts` (`.py`: `core/resolver-py.ts`), and resolves each file's role with
   `core/roles.ts`. Language dispatch is a per-file extension check inside `graph-builder.ts` —
   everything downstream of the graph is language-agnostic. Returns `{ graph, resolveWarnings }` —
   `resolveWarnings` are `E-RESOLVE` diagnostics for relative imports that couldn't be resolved.
4. Command modules (`check`, `graph`, `suggest`, `explain`) receive `graph`/`config` as arguments
   and independently invoke the rule modules they need (`check`/`explain` run all of R1–R4;
   `suggest` only needs `r3-acyclicity.ts`'s cycle list).
5. `check`/`graph` fold `resolveWarnings` into their own diagnostic aggregation (so `E-RESOLVE`
   appears in `check --json`'s `warnings` array and affects `graph`'s violation styling);
   `suggest`/`explain` (which never build a full `CheckResult`) print them directly via
   `cli.ts`'s `printResolveWarnings()` helper. This split was the subject of a real bug found and
   fixed during code review — see `docs/3-code-review/CR_w1_v1.0.0.md`.

## Testing

- `tests/rules/*.test.ts` — unit tests per rule module; diagnostic message text is
  inline-snapshotted (`toMatchInlineSnapshot`) against the PRD's literal §7 templates.
- `tests/fixtures.test.ts` — drives all 10 PRD §11 acceptance fixtures (`fixtures/f01`–`f10`)
  through the **compiled** CLI as a subprocess, diffing `check --json` output against each
  fixture's committed `expected.json`. Also covers `suggest` output, `typeOnlyEdges: "count"`,
  `strictCycles: false`, and the `E-RESOLVE` regression.
- `tests/meta.test.ts` — dogfooding: `spokes check` against the tool's own `src/` must exit 0.
- `tests/render/determinism.test.ts` — two consecutive `graph --no-timestamp` runs against the
  40-file `f10-big-det` fixture must produce byte-identical `.mmd`/`.html` output.

`npm test` runs `npm run build` first (via `pretest`) so the fixture/meta/determinism tests
always exercise fresh compiled output, never stale `dist/`.

## Constraints (do not violate)

- Runtime deps limited to `typescript`, `fast-glob`, `commander` (per the build spec) — no
  JSON-schema or glob-matching library; both are hand-rolled (`core/config.ts`'s validator,
  `core/roles.ts`'s `globToRegExp`).
- No network calls at runtime, ever (the generated HTML's Mermaid CDN `<script>` tag is the one
  exception — the tool itself never fetches it).
- All detection/suggestion logic is deterministic — no AI/LLM involvement anywhere in `src/`.
- `spokes suggest --write` must remain unimplemented in v1 (reserved for M3); the flag is
  recognized and rejected with exit code 2 in `cli.ts`.

## Extending

New CLI subcommands go in `src/`, are hub modules owned solely by `cli.ts` (in-degree 1), and
receive any shared `Graph`/`SpokesConfig` state as a function argument rather than importing a
shared builder. New rule modules (R5+) follow the `rules/r*.ts` spoke pattern: single `types.ts`
import, pure `(graph, config) => Diagnostic[]` function (or the `r3`-style
`{diagnostics, cycles}` shape if the rule needs to expose structured data to other consumers),
message templates committed to docs and snapshot-tested verbatim.
