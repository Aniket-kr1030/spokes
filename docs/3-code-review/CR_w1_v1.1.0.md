# Code Review: spokes v1.1.0 (Python language support)

**Review Date**: 2026-07-21
**Version**: 1.1.0
**Files Reviewed**: `src/core/parser-py.ts`, `src/core/resolver-py.ts`, `src/graph-builder.ts`,
`src/core/roles.ts`, `src/core/config.ts`, `src/init.ts`, `src/rules/r1-spoke-outdegree.ts`,
`src/rules/r3-acyclicity.ts`, `src/suggest.ts`, `src/render/diff.ts`, `fixtures/f11-python/`,
`tests/python.test.ts`, `tests/fixtures.test.ts`, `README.md`, `docs/ARCHI.md`
**Plan**: `docs/1-plans/F_1.1.0_python-support.plan.md`

---

## Executive Summary

Python support lands as two new spoke modules (parser + resolver) behind a per-file extension
dispatch in `graph-builder.ts`; everything downstream of the graph is untouched and
language-agnostic. The feature was verified primarily **by execution** — a new full fixture
(`f11-python`) whose expected outputs were captured from real CLI runs and hand-verified line by
line, 13 targeted unit tests, and a separate realistic `src/`-layout Python project exercised
end-to-end (`check`, `explain`, `graph`) outside the fixture tree. **APPROVED** — single-session
self-review (no multi-agent loop this round); all TS/JS behavior is provably unchanged (all 32
pre-existing tests pass byte-identical, including the frozen §7 message snapshots).

---

## Architectural Compliance

- `parser-py.ts` / `resolver-py.ts`: spokes under the repo's own `src/** → spoke` glob, zero
  value imports (types-only), exactly one export each — R1/R4 clean.
- `graph-builder.ts` remains the sole owner of language dispatch; it is a hub (out-degree
  unconstrained) so the two new value imports are legal, and its in-degree stays 1 (`cli.ts`).
- `reconstructSpecifier`'s Python branch is added to **both** deliberate duplicates
  (`r3-acyclicity.ts`, `suggest.ts`) — kept in sync, per the documented duplication tradeoff.
- Dogfooding: `spokes check` on the tool's own source still exits 0 with 0 warnings.

## Findings

### Critical / Major Issues
None found. The one real design risk — `from pkg import thing` being ambiguous between a
submodule and a symbol — is handled the way Python itself handles it (submodule reading first,
package `__init__.py` fallback), is covered by unit tests for both readings, and is exercised in
`f11-python` (`from app.util import helper` resolving to `app/util.py`).

### Minor observations (accepted)
1. Semicolon-joined statements (`import os; import sys`) are dropped by the item regex — no
   false edges, just a missed edge for a style virtually absent from real Python. Not worth the
   parser complexity.
2. R3's reconstructed closing-edge specifier always renders the *relative* dotted form even when
   the source used an absolute import (`import app.cycle_a` → shown as `'.cycle_a'`). Same
   documented "plausible reconstruction" caveat the TS side already carries for aliased imports.
3. Namespace packages (no `__init__.py`) can't anchor `from . import name` fallbacks — the
   import surfaces as E-RESOLVE rather than silently guessing. Documented in the README.

## Verification performed (run, not just read)

- `npm test` — 47/47 passing: all 32 pre-existing tests unchanged (proves zero TS/JS behavior
  drift, incl. frozen message snapshots), 13 new parser/resolver unit tests, f11 `check --json`
  fixture comparison, f11 Python-style `suggest` comparison.
- `f11-python` expected output hand-verified against the source files before committing:
  S001 (spoke fan-out), S002 (`#`-pragma hub with two callers — also proves the pragma is
  actually read, since without it no S002 is possible), S003 (cycle mixing relative and absolute
  import forms), S004 (two public defs) and its suppression via `__all__`, TYPE_CHECKING edge
  ignored, bare `import os` ignored, docstring offset line numbers correct (`main.py:5`).
- Separate scratch project with `pyproject.toml` + `src/mypkg/` layout: absolute imports
  resolved through the `src` root, `check` exits 0, `explain` reports correct roles/edges,
  `graph` renders `.py` nodes and directory clusters.
- `spokes check` on this repo itself: clean.

---

## Verdict

**APPROVED**

No regressions possible on the TS/JS path without a pre-existing test failing; Python behavior
is fixture- and unit-covered. Publishing to npm remains a separate, not-yet-taken action.
