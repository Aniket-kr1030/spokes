# spokes

**v1.0.0** — A dependency-shape linter that draws your architecture.

Agents working in a `spokes`-clean repo can load exactly one file plus one interface to act
safely, because blast radius is bounded by construction — a hub has at most one caller, a spoke
has at most one dependency. `spokes` parses your repo's static import graph, classifies every
file as a **spoke** (out-degree ≤ 1) or a **hub** (in-degree ≤ 1), rejects any edge that violates
those degree rules or creates a cycle, and mechanically renders the result as an architecture
diagram — so the diagram is always true, because it's a projection of the code, not a drawing
someone forgot to update. There's good prior art here — dependency-cruiser and madge detect
cycles, Nx enforces module boundaries — but none of them type nodes by ownership shape or enforce
the Stable Dependencies Principle; they check "no cycles," `spokes` checks "no cycles, and every
file has a legible reason for existing."

## Install

```sh
npm install --save-dev spokes
```

## Quick start

```sh
npx spokes init
npx spokes check
npx spokes graph
```

## Commands

### `spokes init`

Writes a default `spokes.config.json` at the repository root. Refuses to overwrite an existing
one.

### `spokes check [--json]`

Runs the four rules (spoke out-degree, hub in-degree, acyclicity, single-export) against the
configured `include` glob. Human-readable output by default; `--json` emits the frozen
`{ version, errors, warnings, stats }` schema for CI integration.

Exit codes: `0` no errors (warnings allowed) · `1` at least one error · `2` config/usage error ·
`3` internal panic.

### `spokes graph [--format mermaid|dot] [--no-timestamp] [--out <dir>]`

Renders the import graph as a Mermaid flowchart (`spokes-graph.mmd` + a self-contained
`spokes-graph.html` you can double-click open) and, with `--format dot`, a Graphviz DOT file.
Deterministic: an unchanged repo produces byte-identical output run to run (pass
`--no-timestamp` for exact reproducibility in CI snapshots).

### `spokes suggest`

For every cycle `check` finds, proposes — as a text preview only, never auto-applied — the
standard fix: extract a shared hub file that the cycle's members redirect their internal import
to.

### `spokes explain <path>`

Prints one file's card: resolved role, incoming/outgoing edges with source locations, export
list, and per-rule pass/fail status.

## Configuration

See `spokes.config.json` (created by `spokes init`) and `schema.json` for the full schema:
`include`/`exclude` globs, per-glob `roles`, `defaultRole` for unmarked files, `strictCycles`,
`singleExport` level, `typeOnlyEdges` handling, and `externalPackages` (always ignored in v1).

Mark a file's role with a pragma in its first 5 lines:

```ts
// @spokes hub
```

or

```ts
// @spokes spoke
```

File pragmas always win over the config's `roles` glob list.

## Development

```sh
npm install
npm run build   # compile src/ to dist/
npm test        # build, then run the vitest suite (unit + fixtures + meta dogfooding)
```

The project's own `src/` is organized as hubs and spokes and must pass `spokes check` itself —
`npm test` verifies this via `tests/meta.test.ts`.
