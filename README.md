# spokes

**v1.0.3** — A dependency-shape linter that draws your architecture.

Agents working in a `spokes`-clean repo can load exactly one file plus one interface to act
safely, because blast radius is bounded by construction — a hub has at most one caller, a spoke
has at most one dependency. `spokes` parses your repo's static import graph, classifies every
file as a **spoke** (out-degree ≤ 1) or a **hub** (in-degree ≤ 1), rejects any edge that violates
those degree rules or creates a cycle, and mechanically renders the result as an architecture
diagram — so the diagram is always true, because it's a projection of the code, not a drawing
someone forgot to update.

There's good prior art here — [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)
and [madge](https://github.com/pahen/madge) detect cycles, [Nx](https://nx.dev) enforces module
boundaries — but none of them type nodes by ownership shape or enforce the Stable Dependencies
Principle; they check "no cycles," `spokes` checks "no cycles, and every file has a legible reason
for existing."

No AI, no LLM calls, no network access at runtime, anywhere in this tool. Every diagnostic and
every diagram is deterministic: same repo in, byte-identical output out.

## Contents

- [What this is for](#what-this-is-for)
- [Core concepts](#core-concepts)
- [Install](#install)
- [Quick start](#quick-start)
- [Command reference](#command-reference)
- [Reading the diagram](#reading-the-diagram)
- [Configuration](#configuration)
- [Role declaration](#role-declaration)
- [Diagnostic codes](#diagnostic-codes)
- [CI integration](#ci-integration)
- [How it works](#how-it-works)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)

## What this is for

`spokes` works on any TypeScript/JavaScript repository with a static import graph
(`import`/`export`/dynamic `import()`/`require`). It's **incrementally adoptable** — unmarked
files are exempt from the degree rules by default, so you can turn it on in an existing codebase
and mark files hub/spoke one directory at a time, instead of needing a green field to start.

It tends to pay off most on:

- **Codebases that AI agents work in a lot.** The whole pitch is bounding blast radius so an
  agent (or a new hire) can load one file plus one interface and act safely. If most of your
  edits are done by agents or by people skimming unfamiliar code, this is the point.
- **Mid-to-large repos where "what depends on what" has gotten fuzzy.** If `git blame` on the
  architecture diagram would just show a Photoshop file from 2019, `spokes` replaces that with a
  diagram that can't drift, because it's generated from the same declarations the checker reads.
- **Monorepos or service boundaries you want to keep honest over time.** The hub/spoke rules are
  cheap to run in CI and catch structural erosion (a "just this once" third import, a shared
  utility silently growing five callers) before it compounds.

It's a poor fit for:

- **Throwaway prototypes / spikes** where the whole point is moving fast and structure doesn't
  matter yet — the degree rules will just be friction. Leave files unmarked, or don't run it yet.
- **Codebases dominated by a genuinely many-to-many domain model** (e.g. a dense object graph
  where 20 modules legitimately need to know about each other) — the Stable Dependencies
  Principle this tool enforces doesn't fit every domain, and you'll spend more time fighting the
  linter than benefiting from it. Mark those files `unmarked` (the default) rather than forcing
  them into a shape they don't want.
- **Non-TS/JS codebases.** v1 is TS/JS only (see [Roadmap](#roadmap)).

## Core concepts

| Term | Definition |
|---|---|
| **node** | One source file participating in the graph. |
| **edge** | A static import from file A to file B (`A → B` means "A imports B"). |
| **spoke** | Role with **out-degree ≤ 1**, in-degree unconstrained. The default role. A shared, widely-used file must itself depend on almost nothing. |
| **hub** | Role with **in-degree ≤ 1**, out-degree unconstrained. A file that orchestrates many dependencies must be exclusively owned by at most one caller. |
| **unmarked** | No pragma and no matching config rule. Exempt from the degree rules (still counted in cycle detection when `strictCycles: true`, the default). |
| **root** | A node with in-degree 0 (an entry point). Legal for both roles, since the rules are `≤ 1`, not `= 1`. |
| **leaf** | A node with out-degree 0 (a pure value/type file). Legal for both roles for the same reason. |

## Install

```sh
npm install --save-dev spokes
```

## Quick start

```sh
npx spokes init    # write spokes.config.json
npx spokes check   # run the checker
npx spokes graph   # render spokes-graph.mmd + spokes-graph.html
```

`spokes init` writes a default config scoped to `src/**`. `spokes check` reports 0 errors on a
fresh, all-unmarked repo (unmarked files are exempt from the degree rules) — you get real signal
once you start marking files with a pragma or a `roles` glob. `spokes graph` always produces a
diagram, marked or not, since it renders whatever the graph actually is.

Example of a caught violation:

```
$ spokes check
error S001: spoke has 3 outgoing edges (max 1)
  --> src/order/service.ts
  edge 1 → src/inventory/client.ts (imported at service.ts:4)
  edge 2 → src/logger.ts           (imported at service.ts:5)
  edge 3 → src/payment/client.ts   (imported at service.ts:3)
  help: mark this file as a hub (`// @spokes hub`) if it is exclusively
        owned by one caller, or route these through a shared hub file.

1 error(s), 0 warning(s).
$ echo $?
1
```

## Command reference

### `spokes init`

Writes a default `spokes.config.json` at the repository root. Refuses to overwrite an existing
one (exit 2).

### `spokes check [--json]`

Runs the four rules (R1 spoke out-degree, R2 hub in-degree, R3 acyclicity, R4 single-export)
against the configured `include` glob. Human-readable output by default; `--json` emits the
frozen `{ version, errors, warnings, stats }` schema below — treat this as a stable CI contract.

```jsonc
{
  "version": 1,
  "errors": [{ "code": "S001", "message": "...", "primary": { "file": "...", "line": 1, "col": 1 }, "related": [] }],
  "warnings": [],
  "stats": { "nodes": 22, "edges": 31, "hubs": 7, "spokes": 15, "unmarked": 0 }
}
```

Exit codes: `0` no errors (warnings allowed) · `1` at least one error · `2` config/usage error ·
`3` internal panic (always prints a bug-report URL).

### `spokes graph [--format mermaid|dot] [--no-timestamp] [--out <dir>]`

Renders the import graph deterministically to `spokes-graph.mmd` (Mermaid flowchart source) and
`spokes-graph.html` (a self-contained, interactive viewer — see
[Reading the diagram](#reading-the-diagram)) always; add `--format dot` to also emit
`spokes-graph.dot` (Graphviz). `--out <dir>` changes the output directory (created if missing,
default: current directory). `--no-timestamp` omits the generated-at timestamp from the HTML
header, for byte-identical output across runs — use this in CI snapshot tests.

Repos over 300 nodes automatically split into one diagram per top-level directory plus an
overview-of-directories diagram, and `spokes` prints a notice to stdout when this happens.

### `spokes suggest`

For every cycle `check` finds, proposes — as a text preview only, **never auto-applied** — the
standard fix: extract a shared hub file that the cycle's members redirect their internal import
to, plus a stub of the new file and a unified-diff-style preview of each changed import line.
`--write` is recognized but rejected in v1 (exit 2) — it's reserved for a future version; nothing
this tool does ever touches your source files.

### `spokes explain <path>`

Prints one file's card: resolved role, incoming/outgoing edges with source locations, export
list, and per-rule pass/fail status. Useful for "why is this file marked hub?" or "what's still
importing the file I'm trying to delete?" without reading the whole diagram.

## Reading the diagram

`spokes-graph.html` is self-contained — double-click it, no server needed. It renders via
[Mermaid](https://mermaid.js.org) loaded from a CDN (the only network reference in the entire
tool, and the tool itself never fetches it).

- **Color legend**: hub (green), spoke (purple), unmarked (tan), violation (red outline) — a node
  gets the violation outline if it appears in any `error` or `warning` diagnostic.
- **Directory clustering**: files group into a boxed cluster per containing directory, so related
  files stay visually together instead of scattering across the whole diagram.
- **Pan and zoom**: scroll to zoom (anchored under your cursor, not the corner), drag to pan,
  or use the Zoom in / Zoom out / Fit to screen buttons.
- **Click-to-focus**: click any file to dim everything except that file and its direct
  connections; click "Clear focus" (or click the file again) to reset. This is the fastest way to
  answer "what does X actually touch?" once a real repo's diagram has more than a handful of
  nodes.

## Configuration

`spokes.config.json` (created by `spokes init`; full JSON Schema in `schema.json` for editor
autocomplete):

| Field | Default | Meaning |
|---|---|---|
| `include` | `["src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"]` | Glob(s) of files to analyze. |
| `exclude` | `["**/*.test.*", "**/*.spec.*", "**/node_modules/**", "**/dist/**"]` | Glob(s) to skip. |
| `roles` | `[{ glob: "src/hubs/**", role: "hub" }, { glob: "src/**", role: "spoke" }]` | Ordered list; first matching glob wins. Overridden per-file by a pragma (see below). |
| `defaultRole` | `"unmarked"` | Role for files matched by neither a pragma nor a `roles` glob. |
| `strictCycles` | `true` | When `true`, cycle detection (R3) includes unmarked nodes too, not just hub/spoke. |
| `singleExport` | `"warn"` | `"off"` \| `"warn"` \| `"error"` — severity for R4 (a marked file exporting more than one symbol). |
| `typeOnlyEdges` | `"ignore"` | `"ignore"` \| `"count"` — whether `import type { X }` creates a graph edge at all. |
| `externalPackages` | `"ignore"` | npm/node-builtin imports never create edges in v1; this field is reserved. |

## Role declaration

Two mechanisms, checked in this priority order:

1. **File pragma** — a comment in the file's first 5 lines:

   ```ts
   // @spokes hub
   ```

   or

   ```ts
   // @spokes spoke
   ```

2. **Config glob** — the `roles` array above, first match wins.

If neither applies, the file is `unmarked`. **File pragmas always win over the config's `roles`
glob list** — use a pragma when one specific file needs to diverge from its directory's default.

## Diagnostic codes

| Code | Rule | Severity | Meaning |
|---|---|---|---|
| `S001` | R1 | error | A spoke has more than one outgoing edge. |
| `S002` | R2 | error | A hub has more than one incoming edge. |
| `S003` | R3 | error | A circular dependency exists (degree rules alone don't imply acyclicity — see `f04-two-cycle` in `fixtures/` for a worked example of two spokes that individually pass R1 but still form a cycle). |
| `S004` | R4 | warn (configurable) | A marked (hub or spoke) file exports more than one symbol. A file with **zero** value exports (e.g. a pure type-definitions module) never triggers this — there's nothing to fan out into a barrel, which is what R4 exists to discourage. |
| `E-RESOLVE` | — | warning | A relative import couldn't be resolved to a file; no edge is created for it. |

## CI integration

```yaml
# .github/workflows/spokes.yml
- run: npx spokes check   # exit 1 on any error fails the step; warnings don't
```

If you also want a machine-readable artifact (for a dashboard, a PR comment bot, etc.), run
`npx spokes check --json > spokes-report.json` as a separate step — its `{ version, errors,
warnings, stats }` schema (documented under [Command reference](#command-reference)) is frozen
specifically so it's safe to parse without pinning to a specific `spokes` patch version.

## How it works

Full internals — module map, why the architecture is shaped the way it is, data flow, testing
strategy — are documented in [`docs/ARCHI.md`](docs/ARCHI.md). Short version: `spokes` parses
files with the TypeScript compiler API (syntactic only, no type-checker, for speed), resolves
imports via `ts.resolveModuleName` (so `tsconfig.json` `paths` aliases work), builds an in-memory
graph, and runs four independent rule modules against it. Rendering (Mermaid, DOT, the
interactive HTML viewer) is a pure projection of that same graph — nothing about the diagram is
hand-maintained or can drift from what the checker sees.

The tool's own `src/` is organized as hubs and spokes and is required to pass `spokes check`
itself (dogfooding, enforced by `tests/meta.test.ts`) — if you're reading the source to
understand the pattern, it's a working example, not just a description.

## Contributing

```sh
git clone <this repo>
cd spokes
npm install
npm run build   # compile src/ to dist/
npm test        # build, then run the vitest suite (unit + fixtures + meta dogfooding + determinism)
```

Before opening a PR:

- `npm test` must pass, including the meta-dogfooding test — if you add a new top-level module,
  it needs a role (pragma or `roles` glob entry in the repo's own `spokes.config.json`) that keeps
  the tool's own source passing its own rules.
- New rule modules (`R5`+) follow the pattern in `src/rules/`: a single pure function taking
  `(graph, config)` and returning `Diagnostic[]` (or, if the rule needs to expose structured data
  to other consumers the way R3 does for `suggest`, a `{ diagnostics, cycles }`-shaped return).
  Each rule module may import `types.ts` and nothing else — see `docs/ARCHI.md` for why, and don't
  fight that constraint by adding a shared helper import; duplicate the small helper instead (the
  existing rule/render modules do this deliberately in a few places).
- New fixtures go in `fixtures/`, each a minimal mini-repo with its own `spokes.config.json` and
  a committed `expected.json` (the `check --json` output). `tests/fixtures.test.ts` picks up every
  directory under `fixtures/` automatically.
- Runtime dependencies are capped at `typescript`, `fast-glob`, `commander` by design (see
  [Roadmap](#roadmap) framing above) — don't add a new one without discussing it first; JSON
  Schema validation and glob-role-matching are hand-rolled specifically to stay within this limit.

## Roadmap

Shipped (v1, M0–M2): parsing, resolution, the four rules, `--json`, deterministic Mermaid/DOT/HTML
rendering, `suggest` previews.

Explicitly reserved, not built yet (M3): `suggest --write` (auto-applying the extraction), watch
mode, incremental (Pearce–Kelly) cycle checking for very large repos, a Python adapter, an
editor/LSP integration.

## License

MIT — see [`LICENSE`](LICENSE).
