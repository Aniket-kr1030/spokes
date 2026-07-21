import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

interface ResolveResult {
  kind: 'relative' | 'bare' | 'unresolved';
  absPath?: string;
}

function moduleFile(baseDir: string, segments: string[]): string | undefined {
  const p = segments.length > 0 ? join(baseDir, ...segments) : baseDir;
  if (segments.length > 0 && existsSync(`${p}.py`)) return `${p}.py`;
  const init = join(p, '__init__.py');
  if (existsSync(init)) return init;
  return undefined;
}

/**
 * Exports exactly one function, satisfying R4. No Python interpreter involved:
 * dotted specifiers are resolved purely on the filesystem — `<segs>.py` first,
 * then `<segs>/__init__.py`. `fromImport` enables the `X.name` → `X` fallback
 * (`from pkg import thing` names either a submodule or a symbol; try the
 * submodule reading first, exactly like Python's own import machinery).
 * Absolute imports are tried against repoRoot and repoRoot/src (the two common
 * layouts); anything not found there is assumed external (stdlib / installed).
 */
export function resolvePythonSpecifier(
  repoRoot: string,
  fromAbsPath: string,
  specifierText: string,
  fromImport: boolean,
): ResolveResult {
  let dots = 0;
  while (specifierText[dots] === '.') dots++;
  const rest = specifierText.slice(dots);
  const segments = rest.length > 0 ? rest.split('.') : [];

  const candidates: string[][] = [segments];
  if (fromImport && segments.length > 0) candidates.push(segments.slice(0, -1));

  if (dots > 0) {
    let baseDir = dirname(fromAbsPath);
    for (let i = 1; i < dots; i++) baseDir = dirname(baseDir);
    for (const cand of candidates) {
      const hit = moduleFile(baseDir, cand);
      // e.g. `from . import symbol` inside __init__.py falls back to the file
      // itself — a name lookup in the current module, not a dependency edge.
      if (hit && hit !== fromAbsPath) return { kind: 'relative', absPath: hit };
    }
    return { kind: 'unresolved' };
  }

  for (const cand of candidates) {
    if (cand.length === 0) continue;
    for (const root of [repoRoot, join(repoRoot, 'src')]) {
      const hit = moduleFile(root, cand);
      if (hit && hit !== fromAbsPath) return { kind: 'relative', absPath: hit };
    }
  }
  return { kind: 'bare' };
}
