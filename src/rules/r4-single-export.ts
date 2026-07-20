import type { Diagnostic, Graph, SpokesConfig } from '../types.js';

function buildMessage(path: string, exportNames: string[]): string {
  const lines = [
    `file exports ${exportNames.length} symbols; spokes files should expose one interface`,
    `  --> ${path}  (exports: ${exportNames.join(', ')})`,
  ];
  return lines.join('\n');
}

/**
 * Exports exactly one function, satisfying R4: `check(graph, config): Diagnostic[]`.
 * A count of 0 (pure type-definitions module, no value exports) never triggers S004 —
 * only count > 1 does; see the plan's documented R4 interpretation.
 */
export function check(graph: Graph, config: SpokesConfig): Diagnostic[] {
  if (config.singleExport === 'off') return [];

  const diagnostics: Diagnostic[] = [];
  const paths = [...graph.nodes.values()]
    .filter((n) => n.role === 'hub' || n.role === 'spoke')
    .map((n) => n.path)
    .sort();

  for (const path of paths) {
    const node = graph.nodes.get(path)!;
    if (node.exports.length > 1) {
      diagnostics.push({
        code: 'S004',
        message: buildMessage(path, node.exports),
        primary: { file: path, line: 1, col: 1 },
        related: [],
        severity: config.singleExport === 'error' ? 'error' : 'warning',
      });
    }
  }

  return diagnostics;
}
