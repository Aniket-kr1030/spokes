import type { Diagnostic, Graph, Loc, SpokesConfig } from '../types.js';

function buildMessage(hubPath: string, inEdges: { from: string; loc: Loc }[]): string {
  const lines = [
    `hub has ${inEdges.length} incoming edges (max 1)`,
    `  --> ${hubPath}`,
    ...inEdges.map((e, i) => `  caller ${i + 1}: ${e.from}:${e.loc.line}`),
    '  help: a hub must have at most one owner. Either give it a single owner,',
    '        or split it, or re-mark it as a spoke and reduce its dependencies.',
  ];
  return lines.join('\n');
}

/** Exports exactly one function, satisfying R4: `check(graph, config): Diagnostic[]`. */
export function check(graph: Graph, config: SpokesConfig): Diagnostic[] {
  void config;
  const diagnostics: Diagnostic[] = [];
  const hubPaths = [...graph.nodes.values()]
    .filter((n) => n.role === 'hub')
    .map((n) => n.path)
    .sort();

  for (const hubPath of hubPaths) {
    const inEdges = graph.edges
      .filter((e) => e.to === hubPath)
      .map((e) => ({ from: e.from, loc: e.locations[0] }))
      .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));

    if (inEdges.length > 1) {
      diagnostics.push({
        code: 'S002',
        message: buildMessage(hubPath, inEdges),
        primary: { file: hubPath, line: 1, col: 1 },
        related: inEdges.map((e) => e.loc),
        severity: 'error',
      });
    }
  }

  return diagnostics;
}
