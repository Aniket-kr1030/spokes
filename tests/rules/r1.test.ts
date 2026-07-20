import { describe, it, expect } from 'vitest';
import { check } from '../../src/rules/r1-spoke-outdegree.js';
import type { Graph } from '../../src/types.js';
import { makeConfig, loc } from '../helpers.js';

describe('R1 spoke out-degree', () => {
  it('flags a spoke with more than one outgoing edge, matching the §7 template', () => {
    const graph: Graph = {
      nodes: new Map([
        ['src/service.ts', { path: 'src/service.ts', role: 'spoke', exports: ['run'] }],
        ['src/payment.ts', { path: 'src/payment.ts', role: 'spoke', exports: ['pay'] }],
        ['src/logger.ts', { path: 'src/logger.ts', role: 'spoke', exports: ['log'] }],
      ]),
      edges: [
        { from: 'src/service.ts', to: 'src/payment.ts', locations: [loc('src/service.ts', 3)] },
        { from: 'src/service.ts', to: 'src/logger.ts', locations: [loc('src/service.ts', 4)] },
      ],
    };

    const diagnostics = check(graph, makeConfig());
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('S001');
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].primary).toEqual(loc('src/service.ts', 1));
    expect(diagnostics[0].related).toHaveLength(2);
    expect(diagnostics[0].message).toMatchInlineSnapshot(`
      "spoke has 2 outgoing edges (max 1)
        --> src/service.ts
        edge 1 → src/logger.ts  (imported at service.ts:4)
        edge 2 → src/payment.ts (imported at service.ts:3)
        help: mark this file as a hub (\`// @spokes hub\`) if it is exclusively
              owned by one caller, or route these through a shared hub file."
    `);
  });

  it('does not flag a spoke with exactly one outgoing edge', () => {
    const graph: Graph = {
      nodes: new Map([
        ['src/a.ts', { path: 'src/a.ts', role: 'spoke', exports: ['a'] }],
        ['src/b.ts', { path: 'src/b.ts', role: 'spoke', exports: ['b'] }],
      ]),
      edges: [{ from: 'src/a.ts', to: 'src/b.ts', locations: [loc('src/a.ts', 1)] }],
    };
    expect(check(graph, makeConfig())).toHaveLength(0);
  });

  it('does not flag hub or unmarked nodes regardless of out-degree', () => {
    const graph: Graph = {
      nodes: new Map([
        ['src/hub.ts', { path: 'src/hub.ts', role: 'hub', exports: ['run'] }],
        ['src/loose.ts', { path: 'src/loose.ts', role: 'unmarked', exports: [] }],
        ['src/a.ts', { path: 'src/a.ts', role: 'spoke', exports: ['a'] }],
        ['src/b.ts', { path: 'src/b.ts', role: 'spoke', exports: ['b'] }],
      ]),
      edges: [
        { from: 'src/hub.ts', to: 'src/a.ts', locations: [loc('src/hub.ts', 1)] },
        { from: 'src/hub.ts', to: 'src/b.ts', locations: [loc('src/hub.ts', 2)] },
        { from: 'src/loose.ts', to: 'src/a.ts', locations: [loc('src/loose.ts', 1)] },
        { from: 'src/loose.ts', to: 'src/b.ts', locations: [loc('src/loose.ts', 2)] },
      ],
    };
    expect(check(graph, makeConfig())).toHaveLength(0);
  });
});
