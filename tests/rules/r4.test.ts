import { describe, it, expect } from 'vitest';
import { check } from '../../src/rules/r4-single-export.js';
import type { Graph } from '../../src/types.js';
import { makeConfig } from '../helpers.js';

describe('R4 single export', () => {
  it('flags a marked node exporting more than one symbol, matching the §7 template', () => {
    const graph: Graph = {
      nodes: new Map([
        ['src/utils.ts', { path: 'src/utils.ts', role: 'spoke', exports: ['formatDate', 'parseDate', 'clamp', 'uuid'] }],
      ]),
      edges: [],
    };

    const diagnostics = check(graph, makeConfig());
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('S004');
    expect(diagnostics[0].severity).toBe('warning');
    expect(diagnostics[0].message).toMatchInlineSnapshot(`
      "file exports 4 symbols; spokes files should expose one interface
        --> src/utils.ts  (exports: formatDate, parseDate, clamp, uuid)"
    `);
  });

  it('does not flag a node exporting exactly one symbol', () => {
    const graph: Graph = {
      nodes: new Map([['src/a.ts', { path: 'src/a.ts', role: 'spoke', exports: ['a'] }]]),
      edges: [],
    };
    expect(check(graph, makeConfig())).toHaveLength(0);
  });

  it('does not flag a node exporting zero symbols (pure type module, no fan-out risk)', () => {
    const graph: Graph = {
      nodes: new Map([['src/types.ts', { path: 'src/types.ts', role: 'spoke', exports: [] }]]),
      edges: [],
    };
    expect(check(graph, makeConfig())).toHaveLength(0);
  });

  it('does not flag unmarked nodes regardless of export count', () => {
    const graph: Graph = {
      nodes: new Map([['src/loose.ts', { path: 'src/loose.ts', role: 'unmarked', exports: ['a', 'b', 'c'] }]]),
      edges: [],
    };
    expect(check(graph, makeConfig())).toHaveLength(0);
  });

  it('respects config.singleExport level: off skips entirely, error escalates severity', () => {
    const graph: Graph = {
      nodes: new Map([['src/utils.ts', { path: 'src/utils.ts', role: 'spoke', exports: ['a', 'b'] }]]),
      edges: [],
    };
    expect(check(graph, makeConfig({ singleExport: 'off' }))).toHaveLength(0);
    const errored = check(graph, makeConfig({ singleExport: 'error' }));
    expect(errored).toHaveLength(1);
    expect(errored[0].severity).toBe('error');
  });
});
