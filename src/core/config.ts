import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SpokesConfig, RoleGlob, Role, SingleExportLevel, TypeOnlyEdges } from '../types.js';

const CONFIG_FILENAME = 'spokes.config.json';

// Vendored / build / virtual-env directories are never part of a project's own
// dependency shape. They are ALWAYS excluded and merged into the effective
// exclude list even when a config supplies its own `exclude` (which otherwise
// replaces the defaults), so scanning can never descend into them.
const ALWAYS_EXCLUDE = [
  '**/node_modules/**',
  '**/.venv/**',
  '**/venv/**',
  '**/env/**',
  '**/__pycache__/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.tox/**',
  '**/site-packages/**',
];

const DEFAULTS: SpokesConfig = {
  include: ['src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs,py}'],
  exclude: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**', '**/dist/**'],
  roles: [
    { glob: 'src/hubs/**', role: 'hub' },
    { glob: 'src/**', role: 'spoke' },
  ],
  defaultRole: 'unmarked',
  strictCycles: true,
  singleExport: 'warn',
  typeOnlyEdges: 'ignore',
  externalPackages: 'ignore',
};

function fail(schemaPath: string, reason: string): never {
  console.error(`error: invalid spokes.config.json at "${schemaPath}": ${reason}`);
  process.exit(2);
}

// Python repos have no package.json; pyproject.toml (or an already-present
// spokes.config.json) marks the root just as well.
const ROOT_MARKERS = [CONFIG_FILENAME, 'package.json', 'pyproject.toml'];

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (ROOT_MARKERS.some((marker) => existsSync(join(dir, marker)))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

function validateStringArray(value: unknown, schemaPath: string): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
    fail(schemaPath, 'expected an array of strings');
  }
  return value as string[];
}

function validateRoles(value: unknown, schemaPath: string): RoleGlob[] {
  if (!Array.isArray(value)) fail(schemaPath, 'expected an array');
  return (value as unknown[]).map((entry, i) => {
    const path = `${schemaPath}[${i}]`;
    if (typeof entry !== 'object' || entry === null) fail(path, 'expected an object');
    const obj = entry as Record<string, unknown>;
    if (typeof obj.glob !== 'string') fail(`${path}.glob`, 'expected a string');
    if (obj.role !== 'hub' && obj.role !== 'spoke') fail(`${path}.role`, 'expected "hub" or "spoke"');
    return { glob: obj.glob, role: obj.role };
  });
}

function validateEnum<T extends string>(value: unknown, allowed: readonly T[], schemaPath: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    fail(schemaPath, `expected one of ${allowed.map((a) => `"${a}"`).join(', ')}`);
  }
  return value as T;
}

function validateBoolean(value: unknown, schemaPath: string): boolean {
  if (typeof value !== 'boolean') fail(schemaPath, 'expected a boolean');
  return value;
}

function parseConfig(raw: unknown): SpokesConfig {
  if (typeof raw !== 'object' || raw === null) fail('$', 'expected an object');
  const obj = raw as Record<string, unknown>;

  const include = 'include' in obj ? validateStringArray(obj.include, 'include') : DEFAULTS.include;
  const userExclude = 'exclude' in obj ? validateStringArray(obj.exclude, 'exclude') : DEFAULTS.exclude;
  // Always ignore vendor/build/venv dirs, regardless of the config's own exclude.
  const exclude = Array.from(new Set([...ALWAYS_EXCLUDE, ...userExclude]));
  const roles = 'roles' in obj ? validateRoles(obj.roles, 'roles') : DEFAULTS.roles;
  const defaultRole =
    'defaultRole' in obj
      ? validateEnum<Role>(obj.defaultRole, ['unmarked', 'spoke', 'hub'], 'defaultRole')
      : DEFAULTS.defaultRole;
  const strictCycles = 'strictCycles' in obj ? validateBoolean(obj.strictCycles, 'strictCycles') : DEFAULTS.strictCycles;
  const singleExport =
    'singleExport' in obj
      ? validateEnum<SingleExportLevel>(obj.singleExport, ['off', 'warn', 'error'], 'singleExport')
      : DEFAULTS.singleExport;
  const typeOnlyEdges =
    'typeOnlyEdges' in obj
      ? validateEnum<TypeOnlyEdges>(obj.typeOnlyEdges, ['ignore', 'count'], 'typeOnlyEdges')
      : DEFAULTS.typeOnlyEdges;
  const externalPackages =
    'externalPackages' in obj
      ? validateEnum(obj.externalPackages, ['ignore'] as const, 'externalPackages')
      : DEFAULTS.externalPackages;

  return { include, exclude, roles, defaultRole, strictCycles, singleExport, typeOnlyEdges, externalPackages };
}

/** Exports exactly one function, satisfying R4. */
export function loadConfig(cwd: string): SpokesConfig {
  const repoRoot = findRepoRoot(cwd);
  const configPath = join(repoRoot, CONFIG_FILENAME);
  if (!existsSync(configPath)) {
    console.error(
      `error: no ${CONFIG_FILENAME} found at "${repoRoot}". Run "spokes init" to create one.`,
    );
    process.exit(2);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (err) {
    fail('$', `could not parse JSON: ${(err as Error).message}`);
  }
  return parseConfig(raw);
}
