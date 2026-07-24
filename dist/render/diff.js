/** Exports exactly one function, satisfying R4. */
export function renderDiff(proposals) {
    const blocks = proposals.map((p) => {
        const isPy = p.hubPath.endsWith('.py');
        const pragma = isPy ? '  # @spokes hub' : '  // @spokes hub';
        const stubLines = p.hubStubExports
            .map((name) => isPy
            ? `  from .TODO import ${name}  # TODO: fill in shared contract`
            : `  export type { ${name} } from './TODO'; // TODO: fill in shared contract`)
            .join('\n');
        const fileDiffs = p.changes
            .map((c) => [`--- a/${c.path}`, `+++ b/${c.path}`, `- ${c.oldLine}`, `+ ${c.newLine}`].join('\n'))
            .join('\n\n');
        return [`new file: ${p.hubPath}`, pragma, stubLines, '', fileDiffs].join('\n');
    });
    return ['PREVIEW — not applied', ...blocks].join('\n\n');
}
