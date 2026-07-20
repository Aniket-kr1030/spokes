import type { Loc, SpokesConfig } from '../src/types.js';

export function makeConfig(overrides: Partial<SpokesConfig> = {}): SpokesConfig {
  return {
    include: ['src/**/*.ts'],
    exclude: [],
    roles: [],
    defaultRole: 'unmarked',
    strictCycles: true,
    singleExport: 'warn',
    typeOnlyEdges: 'ignore',
    externalPackages: 'ignore',
    ...overrides,
  };
}

export function loc(file: string, line: number, col = 1): Loc {
  return { file, line, col };
}
