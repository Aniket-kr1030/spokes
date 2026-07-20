import { check as checkR1 } from './rules/r1-spoke-outdegree.js';
import { check as checkR2 } from './rules/r2-hub-indegree.js';
import { analyzeCycles } from './rules/r3-acyclicity.js';
import { check as checkR4 } from './rules/r4-single-export.js';
import { renderText } from './render/text.js';
import { renderJson } from './render/json.js';
import type { CheckResult, CheckStats, Diagnostic, Graph, SpokesConfig } from './types.js';

function computeStats(graph: Graph): CheckStats {
  let hubs = 0;
  let spokes = 0;
  let unmarked = 0;
  for (const node of graph.nodes.values()) {
    if (node.role === 'hub') hubs++;
    else if (node.role === 'spoke') spokes++;
    else unmarked++;
  }
  return { nodes: graph.nodes.size, edges: graph.edges.length, hubs, spokes, unmarked };
}

/**
 * Exports exactly one function, satisfying R4.
 * `resolveWarnings` (E-RESOLVE diagnostics from graph-builder.ts) are folded in here so they
 * appear in both the human report and the frozen `--json` `warnings` array — dropping them
 * from either would silently understate the tool's own diagnostic surface.
 */
export function run(
  graph: Graph,
  config: SpokesConfig,
  opts: { json: boolean },
  resolveWarnings: Diagnostic[] = [],
): { result: CheckResult; exitCode: 0 | 1 } {
  const all: Diagnostic[] = [
    ...checkR1(graph, config),
    ...checkR2(graph, config),
    ...analyzeCycles(graph, config).diagnostics,
    ...checkR4(graph, config),
    ...resolveWarnings,
  ];

  const errors = all.filter((d) => d.severity === 'error');
  const warnings = all.filter((d) => d.severity === 'warning');
  const result: CheckResult = { version: 1, errors, warnings, stats: computeStats(graph) };

  if (opts.json) {
    console.log(renderJson(result));
  } else {
    const text = renderText(all);
    if (text) console.log(`${text}\n`);
    console.log(`${errors.length} error(s), ${warnings.length} warning(s).`);
  }

  return { result, exitCode: errors.length > 0 ? 1 : 0 };
}
