#!/usr/bin/env node
import { Command } from 'commander';
import { realpathSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './core/config.js';
import { buildGraph } from './graph-builder.js';
import { check as checkR1 } from './rules/r1-spoke-outdegree.js';
import { check as checkR2 } from './rules/r2-hub-indegree.js';
import { analyzeCycles } from './rules/r3-acyclicity.js';
import { check as checkR4 } from './rules/r4-single-export.js';
import { renderText } from './render/text.js';
import { run as runInit } from './init.js';
import { run as runCheck } from './check.js';
import { run as runGraph } from './graph.js';
import { run as runSuggest } from './suggest.js';
import { run as runExplain } from './explain.js';
const BUG_REPORT_URL = 'https://github.com/Aniket-kr1030/spokes/issues/new';
function toPosixRelative(repoRoot, targetPath) {
    const abs = resolve(repoRoot, targetPath);
    return relative(repoRoot, abs).split(sep).join('/');
}
// Mirrors check.ts's internal diagnostic/stats computation without printing —
// used by the `graph` command, which needs a CheckResult purely for violation
// styling and must not also emit `check`'s own report to stdout. `resolveWarnings`
// (E-RESOLVE) are folded in the same way check.ts folds them, so violation styling
// and stats stay consistent between `check` and `graph`.
function computeSilentCheckResult(graph, config, resolveWarnings) {
    const all = [
        ...checkR1(graph, config),
        ...checkR2(graph, config),
        ...analyzeCycles(graph, config).diagnostics,
        ...checkR4(graph, config),
        ...resolveWarnings,
    ];
    const errors = all.filter((d) => d.severity === 'error');
    const warnings = all.filter((d) => d.severity === 'warning');
    let hubs = 0;
    let spokes = 0;
    let unmarked = 0;
    for (const node of graph.nodes.values()) {
        if (node.role === 'hub')
            hubs++;
        else if (node.role === 'spoke')
            spokes++;
        else
            unmarked++;
    }
    const stats = { nodes: graph.nodes.size, edges: graph.edges.length, hubs, spokes, unmarked };
    return { version: 1, errors, warnings, stats };
}
function loadGraph(repoRoot) {
    const config = loadConfig(repoRoot);
    const { graph, resolveWarnings } = buildGraph(config, repoRoot);
    return { graph, config, resolveWarnings };
}
// `suggest`/`explain` never build a CheckResult (unlike `check`/`graph`), so
// E-RESOLVE warnings would otherwise be invisible for those two commands.
function printResolveWarnings(resolveWarnings) {
    if (resolveWarnings.length > 0) {
        console.error(renderText(resolveWarnings));
        console.error();
    }
}
/** Exports exactly one function, satisfying R4. */
export async function main(argv) {
    const repoRoot = process.cwd();
    let exitCode = 0;
    const program = new Command();
    program
        .name('spokes')
        .description('A dependency-shape linter that draws your architecture.')
        .exitOverride()
        .configureOutput({ writeErr: (str) => process.stderr.write(str) });
    program
        .command('init')
        .description('write default spokes.config.json')
        .action(() => {
        runInit(repoRoot);
    });
    program
        .command('check')
        .description('run the checker (R1-R4)')
        .option('--json', 'emit machine-readable JSON output')
        .action((opts) => {
        const { graph, config, resolveWarnings } = loadGraph(repoRoot);
        const { exitCode: code } = runCheck(graph, config, { json: !!opts.json }, resolveWarnings);
        exitCode = code;
    });
    program
        .command('graph')
        .description('render the architecture diagram')
        .option('--format <format>', 'mermaid or dot', 'mermaid')
        .option('--no-timestamp', 'omit the generated timestamp')
        .option('--out <dir>', 'output directory', '.')
        .action((opts) => {
        const { graph, config, resolveWarnings } = loadGraph(repoRoot);
        printResolveWarnings(resolveWarnings);
        const result = computeSilentCheckResult(graph, config, resolveWarnings);
        runGraph(graph, result, {
            format: opts.format === 'dot' ? 'dot' : 'mermaid',
            noTimestamp: !opts.timestamp,
            out: opts.out,
        });
    });
    program
        .command('suggest')
        .description('preview cycle-extraction fixes (not applied)')
        .option('--write', 'reserved for a future version')
        .action((opts) => {
        if (opts.write) {
            console.error('error: --write is not implemented in v1.');
            process.exitCode = 2;
            exitCode = 2;
            return;
        }
        const { graph, config, resolveWarnings } = loadGraph(repoRoot);
        printResolveWarnings(resolveWarnings);
        runSuggest(graph, config);
    });
    program
        .command('explain <path>')
        .description("show one file's role, edges, exports, and rule status")
        .action((pathArg) => {
        const { graph, config, resolveWarnings } = loadGraph(repoRoot);
        printResolveWarnings(resolveWarnings);
        runExplain(graph, config, toPosixRelative(repoRoot, pathArg));
    });
    try {
        await program.parseAsync(argv);
    }
    catch (err) {
        if (err && typeof err === 'object' && 'exitCode' in err) {
            return err.exitCode;
        }
        console.error(`internal error: ${err.stack ?? err}`);
        console.error(`Please report this bug: ${BUG_REPORT_URL}`);
        return 3;
    }
    return exitCode;
}
/**
 * True when this module was executed directly (rather than imported).
 *
 * Compares fully-resolved file URLs: a global install puts a SYMLINK on PATH
 * (e.g. /opt/homebrew/bin/spokes -> .../dist/cli.js), so `process.argv[1]` is
 * the link while `import.meta.url` is the real path. Naive string comparison
 * therefore never matched and the CLI exited 0 having done nothing. realpath
 * resolves the link, and pathToFileURL encodes paths containing spaces.
 */
function isDirectRun() {
    const entry = process.argv[1];
    if (!entry)
        return false;
    try {
        return import.meta.url === pathToFileURL(realpathSync(entry)).href;
    }
    catch {
        return false;
    }
}
if (isDirectRun()) {
    main(process.argv).then((code) => {
        process.exitCode = code;
    });
}
