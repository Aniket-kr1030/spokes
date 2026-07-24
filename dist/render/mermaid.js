const ROLE_STYLE = {
    hub: { fill: '#E1F5EE', stroke: '#0F6E56' },
    spoke: { fill: '#EEEDFE', stroke: '#534AB7' },
    unmarked: { fill: '#F1EFE8', stroke: '#5F5E5A' },
};
// Any character outside [A-Za-z0-9_] must be collapsed to '_': Mermaid reserves
// (), [], {} for node-shape syntax, so a Next.js route group (app/(app)/...) or
// dynamic segment (app/[id]/..., app/[...path]/...) left raw makes the whole
// flowchart a syntax error. Restricting the id to word characters also keeps it
// verbatim in Mermaid's rendered SVG element ids, which render/html.ts parses
// back out for click-to-focus — a char Mermaid rewrote there would desync it.
function nodeId(path) {
    return path.replace(/[^A-Za-z0-9_]/g, '_');
}
function dirOf(path) {
    const idx = path.lastIndexOf('/');
    return idx === -1 ? '' : path.slice(0, idx);
}
function violatingPaths(checkResult) {
    const paths = new Set();
    for (const d of [...checkResult.errors, ...checkResult.warnings])
        paths.add(d.primary.file);
    return paths;
}
/**
 * Exports exactly one function, satisfying R4. Any label-escaping/id-computation helpers stay
 * internal to this file. Nodes are clustered into one Mermaid `subgraph` per containing directory
 * so related files stay visually grouped instead of scattering across the whole flowchart —
 * without this, a real repo's fan-out (a hub imported by several callers, several rule/render
 * spokes each imported by several commands) reads as an undifferentiated hairball.
 */
export function renderMermaid(graph, checkResult, opts) {
    void opts; // the .mmd itself never contains a timestamp — only render/html.ts's header does
    const violating = violatingPaths(checkResult);
    const nodes = [...graph.nodes.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
    const edges = [...graph.edges].sort((a, b) => {
        if (a.from !== b.from)
            return a.from < b.from ? -1 : 1;
        return a.to < b.to ? -1 : a.to > b.to ? 1 : 0;
    });
    const lines = ['flowchart TD'];
    const groups = new Map();
    for (const node of nodes) {
        const dir = dirOf(node.path);
        if (!groups.has(dir))
            groups.set(dir, []);
        groups.get(dir).push(node);
    }
    for (const node of groups.get('') ?? []) {
        lines.push(`  ${nodeId(node.path)}["${node.path}"]`);
    }
    for (const dir of [...groups.keys()].filter((d) => d !== '').sort()) {
        lines.push(`  subgraph ${nodeId(dir)}_dir["${dir}"]`);
        for (const node of groups.get(dir)) {
            lines.push(`    ${nodeId(node.path)}["${node.path}"]`);
        }
        lines.push('  end');
    }
    for (const edge of edges) {
        lines.push(`  ${nodeId(edge.from)} --> ${nodeId(edge.to)}`);
    }
    for (const node of nodes) {
        const id = nodeId(node.path);
        const style = ROLE_STYLE[node.role] ?? ROLE_STYLE.unmarked;
        const isViolating = violating.has(node.path);
        const stroke = isViolating ? '#A32D2D' : style.stroke;
        const strokeWidth = isViolating ? ',stroke-width:2px' : '';
        lines.push(`  style ${id} fill:${style.fill},stroke:${stroke}${strokeWidth}`);
    }
    return lines.join('\n');
}
