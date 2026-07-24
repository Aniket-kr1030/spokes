import { analyzeCycles } from './rules/r3-acyclicity.js';
import { renderDiff } from './render/diff.js';
function longestCommonDir(paths) {
    const partsList = paths.map((p) => p.split('/').slice(0, -1));
    const first = partsList[0];
    const common = [];
    for (let i = 0; i < first.length; i++) {
        if (partsList.every((parts) => parts[i] === first[i]))
            common.push(first[i]);
        else
            break;
    }
    return common.length > 0 ? common.join('/') : '.';
}
// Edge doesn't retain the literal specifier text; reconstructed here the same
// way r3-acyclicity.ts does, duplicated because a spoke/hub module can't add
// a second import edge just to share this small helper (see rules/r3-acyclicity.ts).
function reconstructSpecifier(fromPath, toPath) {
    const fromDir = fromPath.split('/').slice(0, -1);
    const toParts = toPath.split('/');
    let i = 0;
    while (i < fromDir.length && i < toParts.length - 1 && fromDir[i] === toParts[i])
        i++;
    const ups = fromDir.length - i;
    const downs = toParts.slice(i);
    if (toPath.endsWith('.py')) {
        // Python relative form: one dot = same package, each extra dot = one level
        // up; a package's __init__.py collapses to the package itself.
        const last = downs[downs.length - 1].replace(/\.py$/, '');
        if (last === '__init__')
            downs.pop();
        else
            downs[downs.length - 1] = last;
        return '.'.repeat(ups + 1) + downs.join('.');
    }
    let result = (ups > 0 ? '../'.repeat(ups) : './') + downs.join('/');
    result = result.replace(/\.(tsx|mts|cts|jsx|mjs|cjs|ts|js)$/, '');
    if (!result.startsWith('.'))
        result = `./${result}`;
    return result;
}
function buildProposal(graph, cycle) {
    const commonDir = longestCommonDir(cycle.members);
    // Cross-language imports don't exist, so a cycle is always single-language.
    const isPy = cycle.members[0].endsWith('.py');
    const hubPath = `${commonDir}/${isPy ? 'shared_hub.py' : 'shared.hub.ts'}`;
    const exportSet = new Set();
    for (const member of cycle.members) {
        for (const name of graph.nodes.get(member)?.exports ?? [])
            exportSet.add(name);
    }
    const importLine = (from, to) => isPy ? `from ${reconstructSpecifier(from, to)} import ...` : `import ... from '${reconstructSpecifier(from, to)}';`;
    const changes = cycle.members.map((member, i) => {
        const next = cycle.members[(i + 1) % cycle.members.length];
        return {
            path: member,
            oldLine: importLine(member, next),
            newLine: importLine(member, hubPath),
        };
    });
    return { cycle, hubPath, hubStubExports: [...exportSet].sort(), changes };
}
/** Exports exactly one function, satisfying R4. */
export function run(graph, config) {
    const { cycles } = analyzeCycles(graph, config);
    if (cycles.length === 0) {
        console.log('spokes: no cycles found — nothing to suggest.');
        return;
    }
    const proposals = cycles.map((cycle) => buildProposal(graph, cycle));
    console.log(renderDiff(proposals));
    console.log();
    console.log([
        'note: extraction resolves cycles caused by a shared contract. If these',
        'files are truly mutually recursive in logic, extraction only relocates',
        'the knot — consider merging the files or inverting one call instead.',
    ].join('\n'));
}
