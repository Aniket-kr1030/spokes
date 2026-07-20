import type { CheckResult, Graph } from '../types.js';

const ROLE_STYLE: Record<string, { fill: string; stroke: string }> = {
  hub: { fill: '#E1F5EE', stroke: '#0F6E56' },
  spoke: { fill: '#EEEDFE', stroke: '#534AB7' },
  unmarked: { fill: '#F1EFE8', stroke: '#5F5E5A' },
};

function nodeId(path: string): string {
  return path.replace(/[/.]/g, '_');
}

function violatingPaths(checkResult: CheckResult): Set<string> {
  const paths = new Set<string>();
  for (const d of [...checkResult.errors, ...checkResult.warnings]) paths.add(d.primary.file);
  return paths;
}

/** Exports exactly one function, satisfying R4. */
export function renderDot(graph: Graph, checkResult: CheckResult): string {
  const violating = violatingPaths(checkResult);
  const nodes = [...graph.nodes.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
  const edges = [...graph.edges].sort((a, b) => {
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    return a.to < b.to ? -1 : a.to > b.to ? 1 : 0;
  });

  const lines = ['digraph spokes {'];

  for (const node of nodes) {
    const id = nodeId(node.path);
    const style = ROLE_STYLE[node.role] ?? ROLE_STYLE.unmarked;
    const isViolating = violating.has(node.path);
    const color = isViolating ? '#A32D2D' : style.stroke;
    const penwidth = isViolating ? ', penwidth=2' : '';
    lines.push(`  "${id}" [label="${node.path}", style=filled, fillcolor="${style.fill}", color="${color}"${penwidth}];`);
  }
  for (const edge of edges) {
    lines.push(`  "${nodeId(edge.from)}" -> "${nodeId(edge.to)}";`);
  }

  lines.push('}');
  return lines.join('\n');
}
