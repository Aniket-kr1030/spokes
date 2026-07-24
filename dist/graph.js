import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderMermaid } from './render/mermaid.js';
import { renderDot } from './render/dot.js';
import { renderHtml } from './render/html.js';
const MAX_NODES_PER_DIAGRAM = 300;
function topLevelGroup(path) {
    const parts = path.split('/');
    if (parts[0] === 'src' && parts.length > 2)
        return `${parts[0]}/${parts[1]}`;
    return parts[0];
}
function subgraphFor(graph, paths) {
    const nodes = new Map();
    for (const [p, n] of graph.nodes)
        if (paths.has(p))
            nodes.set(p, n);
    const edges = graph.edges.filter((e) => paths.has(e.from) && paths.has(e.to));
    return { nodes, edges };
}
function overviewGraph(graph, groups) {
    const nodes = new Map();
    for (const dir of groups.keys())
        nodes.set(dir, { path: dir, role: 'unmarked', exports: [] });
    const dirOf = new Map();
    for (const [dir, paths] of groups)
        for (const p of paths)
            dirOf.set(p, dir);
    const edgeMap = new Map();
    for (const e of graph.edges) {
        const fromDir = dirOf.get(e.from);
        const toDir = dirOf.get(e.to);
        if (!fromDir || !toDir || fromDir === toDir)
            continue;
        const key = `${fromDir} ${toDir}`;
        if (!edgeMap.has(key))
            edgeMap.set(key, { from: fromDir, to: toDir, locations: [] });
    }
    return { nodes, edges: [...edgeMap.values()] };
}
/** Exports exactly one function, satisfying R4. */
export function run(graph, checkResult, opts) {
    const outDir = opts.out ?? '.';
    mkdirSync(outDir, { recursive: true });
    const writeOne = (baseName, g) => {
        const mmd = renderMermaid(g, checkResult, { noTimestamp: opts.noTimestamp });
        writeFileSync(join(outDir, `${baseName}.mmd`), `${mmd}\n`, 'utf8');
        const html = renderHtml(mmd, checkResult, { noTimestamp: opts.noTimestamp });
        writeFileSync(join(outDir, `${baseName}.html`), html, 'utf8');
        if (opts.format === 'dot') {
            const dot = renderDot(g, checkResult);
            writeFileSync(join(outDir, `${baseName}.dot`), `${dot}\n`, 'utf8');
        }
    };
    const nodeCount = graph.nodes.size;
    if (nodeCount <= MAX_NODES_PER_DIAGRAM) {
        writeOne('spokes-graph', graph);
        return;
    }
    const groups = new Map();
    for (const node of graph.nodes.values()) {
        const dir = topLevelGroup(node.path);
        if (!groups.has(dir))
            groups.set(dir, new Set());
        groups.get(dir).add(node.path);
    }
    console.log(`spokes: ${nodeCount} nodes exceeds ${MAX_NODES_PER_DIAGRAM} — writing one diagram per top-level directory plus an overview.`);
    // Same word-only sanitization the renderers apply to ids (see render/mermaid.ts):
    // a top-level group can be a Next.js route group like `src/(app)`, and those
    // characters have no business in a generated filename.
    for (const [dir, paths] of [...groups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        writeOne(`spokes-graph-${dir.replace(/[^A-Za-z0-9_]/g, '_')}`, subgraphFor(graph, paths));
    }
    writeOne('spokes-graph-overview', overviewGraph(graph, groups));
}
