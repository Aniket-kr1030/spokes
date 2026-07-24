const ROLE_STYLE = {
    hub: { fill: '#E1F5EE', stroke: '#0F6E56' },
    spoke: { fill: '#EEEDFE', stroke: '#534AB7' },
    unmarked: { fill: '#F1EFE8', stroke: '#5F5E5A' },
};
// Mirrors render/mermaid.ts's nodeId (deliberately duplicated, per the spoke
// single-import constraint). Collapsing every non-word character keeps DOT ids
// robust to paths with parens/brackets (Next.js route groups & dynamic segments).
function nodeId(path) {
    return path.replace(/[^A-Za-z0-9_]/g, '_');
}
function violatingPaths(checkResult) {
    const paths = new Set();
    for (const d of [...checkResult.errors, ...checkResult.warnings])
        paths.add(d.primary.file);
    return paths;
}
/** Exports exactly one function, satisfying R4. */
export function renderDot(graph, checkResult) {
    const violating = violatingPaths(checkResult);
    const nodes = [...graph.nodes.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
    const edges = [...graph.edges].sort((a, b) => {
        if (a.from !== b.from)
            return a.from < b.from ? -1 : 1;
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
