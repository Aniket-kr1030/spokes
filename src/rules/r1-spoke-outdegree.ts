import { basename } from 'node:path';
import type { Diagnostic, Graph, Loc, SpokesConfig } from '../types.js';

function buildMessage(spokePath: string, outEdges: { to: string; loc: Loc }[]): string {
  const maxLen = Math.max(...outEdges.map((e) => e.to.length));
  const lines = [
    `spoke has ${outEdges.length} outgoing edges (max 1)`,
    `  --> ${spokePath}`,
    ...outEdges.map(
      (e, i) => `  edge ${i + 1} → ${e.to.padEnd(maxLen + 1)}(imported at ${basename(e.loc.file)}:${e.loc.line})`,
    ),
    '  help: mark this file as a hub (`// @spokes hub`) if it is exclusively',
    '        owned by one caller, or route these through a shared hub file.',
  ];
  return lines.join('\n');
}

/** Exports exactly one function, satisfying R4: `check(graph, config): Diagnostic[]`. */
export function check(graph: Graph, config: SpokesConfig): Diagnostic[] {
  void config;
  const diagnostics: Diagnostic[] = [];
  const spokePaths = [...graph.nodes.values()]
    .filter((n) => n.role === 'spoke')
    .map((n) => n.path)
    .sort();

  for (const spokePath of spokePaths) {
    const outEdges = graph.edges
      .filter((e) => e.from === spokePath)
      .map((e) => ({ to: e.to, loc: e.locations[0] }))
      .sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0));

    if (outEdges.length > 1) {
      diagnostics.push({
        code: 'S001',
        message: buildMessage(spokePath, outEdges),
        primary: { file: spokePath, line: 1, col: 1 },
        related: outEdges.map((e) => e.loc),
        severity: 'error',
      });
    }
  }

  return diagnostics;
}
