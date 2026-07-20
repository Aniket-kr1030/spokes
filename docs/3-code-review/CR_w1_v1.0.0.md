# Code Review: spokes v1.0.0 (M0–M2 initial implementation)

**Review Date**: 2026-07-20
**Version**: 1.0.0
**Files Reviewed**: all 22 files under `src/` (types, core/{config,roles,parser,resolver}, graph-builder, rules/r1–r4, render/{text,json,mermaid,dot,html,diff}, init, check, graph, suggest, explain, cli), 8 test files under `tests/`, 10 fixture directories under `fixtures/`, plus `spokes.config.json`, `package.json`, `tsconfig.json`, `schema.json`
**Plan**: `docs/1-plans/F_1.0.0_spokes-dependency-linter.plan.md`

---

## Executive Summary

Initial from-scratch implementation of `spokes` (M0 skeleton, M1 checker, M2 visuals + suggest) per the approved plan. Three review rounds: round 1 found one real Major bug (E-RESOLVE warnings silently dropped from the `check --json` contract) plus three accepted Minor/Suggestion items; the round-1 fix introduced a new Major regression (the `graph` command lost all visibility into resolve warnings), caught in round 2 and fixed with a one-line change plus a regression test in round 3. Round 3 verdict: **APPROVED**.

---

## Changes Overview

Full implementation of the `spokes` CLI: a static-import-graph linter that classifies files as hubs (in-degree ≤1) or spokes (out-degree ≤1), enforces those degree rules plus acyclicity (R1–R4), and renders the graph as Mermaid/DOT/HTML. Five commands (`init`, `check`, `graph`, `suggest`, `explain`) wired through `src/cli.ts`. The tool's own `src/` is organized to obey its own rules (verified by `tests/meta.test.ts`, dogfooding). All 10 PRD §11 acceptance fixtures (`fixtures/f01`–`f10`) pass against committed `expected.json` snapshots; 32 vitest tests total (unit tests for R1–R4 with inline-snapshotted diagnostic messages matching the PRD's literal examples verbatim, a fixtures suite, a determinism test, and a meta-dogfooding test).

---

## Findings

### Critical Issues

None.

### Major Issues

**1. `E-RESOLVE` warnings dropped from `check --json`'s frozen `warnings` contract.** (`src/graph-builder.ts`, `src/check.ts`, `src/cli.ts`) — Unresolvable relative imports produced a proper `Diagnostic` in `graph-builder.ts`'s `resolveWarnings`, but `check.ts`'s `run()` never accepted them, and `cli.ts` printed them once to stderr and discarded them, so `check --json`'s `warnings` array silently omitted a whole diagnostic class, and text mode printed a self-contradictory `0 warning(s)` summary beneath a printed warning line. **Disposition: addressed.** `check.ts:run()` gained a `resolveWarnings` parameter folded into its diagnostic aggregation (appears in both `renderText` and `renderJson` output, counted correctly in `warnings`); `cli.ts`'s `computeSilentCheckResult` (used by `graph`) got the same treatment for consistent violation styling. Verified live via reproduction in round 1 and round 2; regression test added in `tests/fixtures.test.ts`.

**2. Round-1 fix regressed the `graph` command's visibility into resolve warnings.** (`src/cli.ts`, `graph` action) — Fixing #1 removed `loadGraph`'s unconditional stderr print in favor of folding warnings into each command's own output channel, but the `graph` command has no text output channel (diagram files only) — so `spokes graph` on a repo with an unresolvable import produced empty stdout/stderr and only an unexplained red-stroked node in the diagram, silently losing the file/line/message that used to be visible. **Disposition: addressed.** One-line fix — `graph`'s action now also calls the same `printResolveWarnings()` helper used by `suggest`/`explain`, restoring stderr visibility while keeping the folded `CheckResult` for violation styling. Verified live in round 3 (exit 0, warning printed exactly once, diagram still written correctly); regression test added.

### Minor Issues

**3. `nodeId()` collision risk in `src/render/mermaid.ts` / `src/render/dot.ts`.** Two distinct repo paths differing only in whether a separator is `/`, `.`, or `_` would collapse to the same Mermaid/DOT node id (e.g. `src/a.b.ts` vs `src/a_b.ts`). Low likelihood on realistic repos; no fixture triggers it. **Disposition: accepted as-is**, not fixed — genuinely low-value effort for an edge case that doesn't occur in any fixture or the tool's own source.

**4. `computeSilentCheckResult` in `src/cli.ts` duplicates `check.ts`'s rule-aggregation + stats logic.** Both `cli.ts` and `check.ts` are hubs with unconstrained out-degree, so in principle a shared helper module could eliminate this — but doing so cleanly requires a new hub module with exactly one caller (hub in-degree ≤1 per the plan's architecture), which would mean `check.ts` no longer computing its own `CheckResult` internally, a larger and riskier change than warranted for a Minor finding. **Disposition: accepted as-is.** The two copies grew in lockstep (identical `resolveWarnings` fold added to both) rather than diverging, so the duplication didn't worsen in kind.

**5. `src/init.ts`'s `DEFAULT_CONFIG` object literal hand-duplicates `src/core/config.ts`'s `DEFAULTS`.** Forced by the R4 single-export architecture constraint (`config.ts`'s sole export is `loadConfig`, so `DEFAULTS` can't be re-exported without adding a second export). **Disposition: accepted as-is** — reviewer explicitly noted this is not a requested change, just a documented tradeoff to keep in sync by hand.

### Suggestions

**6. Edges resolving to a target outside the `include`/`exclude` universe render as an unlabeled box in Mermaid/Graphviz output.** Rare; no fixture triggers it; not urgent.

---

## Checklist

- [x] 1. Functional Requirements — all 10 PRD §11 fixtures pass, meta-dogfooding passes, R1–R4 message templates verified verbatim against the PRD's own literal examples via inline snapshots
- [x] 2. Code Quality — proper typing throughout (TS strict), duplication that exists is architecturally forced and documented, no unused imports
- [x] 3. Architectural Compliance — every spoke/hub module's export count and import edges independently verified against the plan across 5 plan-review rounds and 3 code-review rounds; the tool obeys its own rules
- [x] 4. Error Handling — config/usage errors exit 2, internal panics exit 3 with a bug-report URL, resolve warnings now surfaced consistently across all 4 graph-consuming commands
- [ ] 5. Security — not formally assessed (no untrusted input surface beyond local filesystem paths the user already controls); no issues found in review
- [x] 6. Performance — tsconfig/compiler options cached per repoRoot, syntactic-only parsing (no full type-checker), file contents read once

---

## Verdict

**APPROVED**

Two Major findings surfaced and were fixed across three review rounds — including a regression the first fix itself introduced, caught before it shipped. Three Minor findings and one Suggestion were reviewed and deliberately left as-is: two are forced by the project's own architectural constraints (spoke out-degree ≤1 prevents sharing certain helpers; R4 single-export prevents re-exporting `DEFAULTS`), and the third (`nodeId` collision) is a low-probability edge case with no realistic trigger in any fixture or the tool's own source. All 32 tests pass, typecheck and build are clean, and the tool's own source passes `spokes check` (dogfooding).
