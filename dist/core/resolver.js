import ts from 'typescript';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
const RESOLVE_EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const contextCache = new Map();
function buildContext(repoRoot) {
    const tsconfigPath = ts.findConfigFile(repoRoot, ts.sys.fileExists, 'tsconfig.json');
    let compilerOptions = {};
    if (tsconfigPath) {
        const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
        const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(tsconfigPath));
        compilerOptions = parsed.options;
    }
    return { compilerOptions, host: ts.sys };
}
function getContext(repoRoot) {
    let ctx = contextCache.get(repoRoot);
    if (!ctx) {
        ctx = buildContext(repoRoot);
        contextCache.set(repoRoot, ctx);
    }
    return ctx;
}
function manualExtensionFallback(fromAbsPath, specifierText) {
    const base = join(dirname(fromAbsPath), specifierText);
    for (const ext of RESOLVE_EXTENSIONS) {
        if (ext !== '' && existsSync(base + ext))
            return base + ext;
    }
    if (existsSync(base) && !existsSync(base + '/'))
        return base;
    for (const ext of RESOLVE_EXTENSIONS) {
        if (ext === '')
            continue;
        const indexPath = join(base, `index${ext}`);
        if (existsSync(indexPath))
            return indexPath;
    }
    return undefined;
}
/** Exports exactly one function, satisfying R4; caches per-repoRoot tsconfig state internally. */
export function resolveSpecifier(repoRoot, fromAbsPath, specifierText) {
    const isRelative = specifierText.startsWith('./') || specifierText.startsWith('../');
    const ctx = getContext(repoRoot);
    const { resolvedModule } = ts.resolveModuleName(specifierText, fromAbsPath, ctx.compilerOptions, ctx.host);
    if (resolvedModule) {
        if (resolvedModule.isExternalLibraryImport)
            return { kind: 'bare' };
        return { kind: 'relative', absPath: resolvedModule.resolvedFileName };
    }
    if (!isRelative)
        return { kind: 'bare' };
    const fallback = manualExtensionFallback(fromAbsPath, specifierText);
    if (fallback)
        return { kind: 'relative', absPath: fallback };
    return { kind: 'unresolved' };
}
