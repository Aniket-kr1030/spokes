import type { Role, SpokesConfig } from '../types.js';

const PRAGMA_RE = /^\s*(\/\/|\/\*|#)\s*@spokes\s+(hub|spoke)\b/i;

function resolvePragma(fileContents: string): Role | undefined {
  const lines = fileContents.split(/\r?\n/, 5);
  for (const line of lines) {
    const match = PRAGMA_RE.exec(line);
    if (match) return match[2].toLowerCase() as Role;
  }
  return undefined;
}

function globToRegExp(glob: string): RegExp {
  let pattern = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        // consume an optional following slash so `**/` matches zero dirs too
        if (glob[i + 1] === '/') i++;
        pattern += '.*';
      } else {
        pattern += '[^/]*';
      }
    } else if (c === '{') {
      const close = glob.indexOf('}', i);
      const options = glob.slice(i + 1, close).split(',');
      pattern += `(?:${options.map((o) => o.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('|')})`;
      i = close;
    } else if ('.+^$()|[]\\'.includes(c)) {
      pattern += `\\${c}`;
    } else {
      pattern += c;
    }
  }
  return new RegExp(`^${pattern}$`);
}

function resolveConfigRole(relPath: string, config: SpokesConfig): Role | undefined {
  for (const entry of config.roles) {
    if (globToRegExp(entry.glob).test(relPath)) return entry.role;
  }
  return undefined;
}

/** Exports exactly one function, satisfying R4. */
export function resolveRole(fileContents: string, relPath: string, config: SpokesConfig): Role {
  return resolvePragma(fileContents) ?? resolveConfigRole(relPath, config) ?? config.defaultRole;
}
