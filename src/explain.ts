import { check as checkR1 } from './rules/r1-spoke-outdegree.js';
import { check as checkR2 } from './rules/r2-hub-indegree.js';
import { analyzeCycles } from './rules/r3-acyclicity.js';
import { check as checkR4 } from './rules/r4-single-export.js';
import { renderText } from './render/text.js';
import type { Graph, SpokesConfig } from './types.js';

/** Exports exactly one function, satisfying R4. */
export function run(graph: Graph, config: SpokesConfig, targetPath: string): void {
  const node = graph.nodes.get(targetPath);
  if (!node) {
    console.error(`error: "${targetPath}" is not a node in the graph (not matched by include/exclude, or unresolved).`);
    process.exit(2);
  }

  const inEdges = graph.edges.filter((e) => e.to === targetPath).sort((a, b) => (a.from < b.from ? -1 : 1));
  const outEdges = graph.edges.filter((e) => e.from === targetPath).sort((a, b) => (a.to < b.to ? -1 : 1));

  console.log(targetPath);
  console.log(`  role: ${node.role}`);
  console.log(`  exports: ${node.exports.length > 0 ? node.exports.join(', ') : '(none)'}`);
  console.log(`  incoming edges (${inEdges.length}):`);
  for (const e of inEdges) console.log(`    ${e.from}:${e.locations[0].line}`);
  console.log(`  outgoing edges (${outEdges.length}):`);
  for (const e of outEdges) console.log(`    ${e.to}:${e.locations[0].line}`);

  const r1 = checkR1(graph, config).filter((d) => d.primary.file === targetPath);
  const r2 = checkR2(graph, config).filter((d) => d.primary.file === targetPath);
  const r4 = checkR4(graph, config).filter((d) => d.primary.file === targetPath);
  const { cycles } = analyzeCycles(graph, config);
  const r3Cycles = cycles.filter((c) => c.members.includes(targetPath));

  console.log('  rule status:');
  console.log(`    R1 (spoke out-degree): ${r1.length === 0 ? 'pass' : 'FAIL'}`);
  console.log(`    R2 (hub in-degree):    ${r2.length === 0 ? 'pass' : 'FAIL'}`);
  console.log(`    R3 (acyclicity):       ${r3Cycles.length === 0 ? 'pass' : 'FAIL'}`);
  console.log(`    R4 (single export):    ${r4.length === 0 ? 'pass' : r4[0].severity === 'error' ? 'FAIL' : 'warn'}`);

  const flatDiagnostics = [...r1, ...r2, ...r4];
  if (flatDiagnostics.length > 0) {
    console.log();
    console.log(renderText(flatDiagnostics));
  }
  if (r3Cycles.length > 0) {
    console.log();
    for (const cycle of r3Cycles) {
      console.log(`  cycle: ${[...cycle.members, cycle.members[0]].join(' → ')}`);
    }
  }
}
