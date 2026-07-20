import { describe, it, expect } from 'vitest';
import { check } from '../../src/rules/r2-hub-indegree.js';
import type { Graph } from '../../src/types.js';
import { makeConfig, loc } from '../helpers.js';

describe('R2 hub in-degree', () => {
  it('flags a hub with more than one incoming edge, matching the §7 template', () => {
    const graph: Graph = {
      nodes: new Map([
        ['src/checkout/engine.ts', { path: 'src/checkout/engine.ts', role: 'hub', exports: ['run'] }],
        ['src/app.ts', { path: 'src/app.ts', role: 'spoke', exports: ['start'] }],
        ['src/admin/tools.ts', { path: 'src/admin/tools.ts', role: 'spoke', exports: ['invoke'] }],
      ]),
      edges: [
        { from: 'src/app.ts', to: 'src/checkout/engine.ts', locations: [loc('src/app.ts', 10)] },
        { from: 'src/admin/tools.ts', to: 'src/checkout/engine.ts', locations: [loc('src/admin/tools.ts', 7)] },
      ],
    };

    const diagnostics = check(graph, makeConfig());
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('S002');
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].primary).toEqual(loc('src/checkout/engine.ts', 1));
    expect(diagnostics[0].related).toHaveLength(2);
    expect(diagnostics[0].message).toMatchInlineSnapshot(`
      "hub has 2 incoming edges (max 1)
        --> src/checkout/engine.ts
        caller 1: src/admin/tools.ts:7
        caller 2: src/app.ts:10
        help: a hub must have at most one owner. Either give it a single owner,
              or split it, or re-mark it as a spoke and reduce its dependencies."
    `);
  });

  it('does not flag a hub with at most one incoming edge', () => {
    const graph: Graph = {
      nodes: new Map([
        ['src/hub.ts', { path: 'src/hub.ts', role: 'hub', exports: ['run'] }],
        ['src/app.ts', { path: 'src/app.ts', role: 'spoke', exports: ['start'] }],
      ]),
      edges: [{ from: 'src/app.ts', to: 'src/hub.ts', locations: [loc('src/app.ts', 1)] }],
    };
    expect(check(graph, makeConfig())).toHaveLength(0);
  });

  it('does not flag spoke or unmarked nodes regardless of in-degree', () => {
    const graph: Graph = {
      nodes: new Map([
        ['src/value.ts', { path: 'src/value.ts', role: 'spoke', exports: ['value'] }],
        ['src/a.ts', { path: 'src/a.ts', role: 'spoke', exports: ['a'] }],
        ['src/b.ts', { path: 'src/b.ts', role: 'spoke', exports: ['b'] }],
      ]),
      edges: [
        { from: 'src/a.ts', to: 'src/value.ts', locations: [loc('src/a.ts', 1)] },
        { from: 'src/b.ts', to: 'src/value.ts', locations: [loc('src/b.ts', 1)] },
      ],
    };
    expect(check(graph, makeConfig())).toHaveLength(0);
  });
});
