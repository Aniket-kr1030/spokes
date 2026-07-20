import { describe, it, expect } from 'vitest';
import { analyzeCycles } from '../../src/rules/r3-acyclicity.js';
import type { Graph } from '../../src/types.js';
import { makeConfig, loc } from '../helpers.js';

describe('R3 acyclicity', () => {
  it('detects a 2-node cycle even when both nodes individually satisfy R1/R2', () => {
    const graph: Graph = {
      nodes: new Map([
        ['src/a.ts', { path: 'src/a.ts', role: 'spoke', exports: ['a'] }],
        ['src/b.ts', { path: 'src/b.ts', role: 'spoke', exports: ['b'] }],
      ]),
      edges: [
        { from: 'src/a.ts', to: 'src/b.ts', locations: [loc('src/a.ts', 1)] },
        { from: 'src/b.ts', to: 'src/a.ts', locations: [loc('src/b.ts', 1)] },
      ],
    };

    const { diagnostics, cycles } = analyzeCycles(graph, makeConfig());
    expect(cycles).toHaveLength(1);
    expect(cycles[0].members).toEqual(['src/a.ts', 'src/b.ts']);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('S003');
    expect(diagnostics[0].message).toMatchInlineSnapshot(`
      "circular dependency (2 files)
        cycle: src/a.ts → src/b.ts → src/a.ts
        closing edge: src/b.ts:1 imports './a'
        help: run \`spokes suggest\` for an extraction plan."
    `);
  });

  it('detects a 3-node cycle and names the closing edge', () => {
    const graph: Graph = {
      nodes: new Map([
        ['src/a.ts', { path: 'src/a.ts', role: 'spoke', exports: ['a'] }],
        ['src/b.ts', { path: 'src/b.ts', role: 'spoke', exports: ['b'] }],
        ['src/c.ts', { path: 'src/c.ts', role: 'spoke', exports: ['c'] }],
      ]),
      edges: [
        { from: 'src/a.ts', to: 'src/b.ts', locations: [loc('src/a.ts', 1)] },
        { from: 'src/b.ts', to: 'src/c.ts', locations: [loc('src/b.ts', 1)] },
        { from: 'src/c.ts', to: 'src/a.ts', locations: [loc('src/c.ts', 2)] },
      ],
    };

    const { diagnostics, cycles } = analyzeCycles(graph, makeConfig());
    expect(cycles).toHaveLength(1);
    expect(cycles[0].members).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
    expect(cycles[0].closingEdge).toEqual({ from: 'src/c.ts', to: 'src/a.ts', loc: loc('src/c.ts', 2) });
    expect(diagnostics[0].message).toMatchInlineSnapshot(`
      "circular dependency (3 files)
        cycle: src/a.ts → src/b.ts → src/c.ts → src/a.ts
        closing edge: src/c.ts:2 imports './a'
        help: run \`spokes suggest\` for an extraction plan."
    `);
  });

  it('excludes unmarked nodes from cycle detection when strictCycles is false', () => {
    const graph: Graph = {
      nodes: new Map([
        ['src/marked/a.ts', { path: 'src/marked/a.ts', role: 'spoke', exports: ['a'] }],
        ['src/loose.ts', { path: 'src/loose.ts', role: 'unmarked', exports: [] }],
      ]),
      edges: [
        { from: 'src/marked/a.ts', to: 'src/loose.ts', locations: [loc('src/marked/a.ts', 1)] },
        { from: 'src/loose.ts', to: 'src/marked/a.ts', locations: [loc('src/loose.ts', 1)] },
      ],
    };

    expect(analyzeCycles(graph, makeConfig({ strictCycles: true })).cycles).toHaveLength(1);
    expect(analyzeCycles(graph, makeConfig({ strictCycles: false })).cycles).toHaveLength(0);
  });

  it('reports each distinct cycle exactly once regardless of DFS entry point', () => {
    const graph: Graph = {
      nodes: new Map([
        ['src/a.ts', { path: 'src/a.ts', role: 'spoke', exports: ['a'] }],
        ['src/b.ts', { path: 'src/b.ts', role: 'spoke', exports: ['b'] }],
        ['src/c.ts', { path: 'src/c.ts', role: 'spoke', exports: ['c'] }],
      ]),
      edges: [
        { from: 'src/a.ts', to: 'src/b.ts', locations: [loc('src/a.ts', 1)] },
        { from: 'src/b.ts', to: 'src/c.ts', locations: [loc('src/b.ts', 1)] },
        { from: 'src/c.ts', to: 'src/a.ts', locations: [loc('src/c.ts', 1)] },
      ],
    };
    const { cycles } = analyzeCycles(graph, makeConfig());
    expect(cycles).toHaveLength(1);
  });
});
