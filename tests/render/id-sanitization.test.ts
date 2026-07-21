import { describe, it, expect } from 'vitest';
import { renderMermaid } from '../../src/render/mermaid.js';
import { renderDot } from '../../src/render/dot.js';
import type { CheckResult, Graph, Node } from '../../src/types.js';

// Next.js route groups `(app)` and dynamic segments `[id]` / `[...path]` put
// parens and brackets straight into file paths; those are Mermaid/DOT shape
// syntax and must never survive into a node/subgraph id, or the whole diagram
// fails to parse. Labels (quoted) keep the real path.
function nextjsGraph(): Graph {
  const paths = [
    'app/(app)/layout.tsx',
    'app/(app)/teacher/test-papers/[id]/page.tsx',
    'app/api/backend/[...path]/route.ts',
    'lib/api-client.ts',
  ];
  const nodes = new Map<string, Node>();
  for (const path of paths) nodes.set(path, { path, role: 'spoke', exports: [] });
  return {
    nodes,
    edges: [
      { from: 'app/(app)/teacher/test-papers/[id]/page.tsx', to: 'lib/api-client.ts', locations: [] },
      { from: 'app/api/backend/[...path]/route.ts', to: 'lib/api-client.ts', locations: [] },
    ],
  };
}

const emptyResult: CheckResult = {
  version: 1,
  errors: [],
  warnings: [],
  stats: { nodes: 4, edges: 2, hubs: 0, spokes: 4, unmarked: 0 },
};

// A Mermaid/DOT identifier token is everything outside the quoted label; strip
// the `["...label..."]` parts, then assert no shape-reserved char remains.
function stripLabels(src: string): string {
  return src.replace(/\[".*?"\]/g, '').replace(/label=".*?"/g, '').replace(/"[^"]*"/g, '""');
}

describe('render id sanitization (Next.js route groups & dynamic segments)', () => {
  it('mermaid: no ( ) [ ] survive into node/subgraph ids, but labels keep the raw path', () => {
    const out = renderMermaid(nextjsGraph(), emptyResult, { noTimestamp: true });
    expect(stripLabels(out)).not.toMatch(/[()[\]]/);
    // labels are unchanged — the real path is still shown to the reader
    expect(out).toContain('["app/(app)/teacher/test-papers/[id]/page.tsx"]');
    expect(out).toContain('["app/api/backend/[...path]/route.ts"]');
    // the sanitized id is what edges reference
    expect(out).toContain('app__app__teacher_test_papers__id__page_tsx --> lib_api_client_ts');
  });

  it('dot: quoted node ids carry no ( ) [ ], but labels keep the raw path', () => {
    const out = renderDot(nextjsGraph(), emptyResult);
    // Every quoted id token (node decl `"id" [` and edges `"a" -> "b"`) is word-only.
    for (const m of out.matchAll(/"([^"]+)"(?:\s*\[|\s*->|\s*;)/g)) {
      expect(m[1]).toMatch(/^[A-Za-z0-9_]+$/);
    }
    expect(out).toContain('label="app/(app)/teacher/test-papers/[id]/page.tsx"');
    expect(out).toContain('"app_api_backend_____path__route_ts" -> "lib_api_client_ts";');
  });

  it('sanitized ids stay within [A-Za-z0-9_] so Mermaid emits them verbatim in SVG element ids (click-to-focus contract)', () => {
    const out = renderMermaid(nextjsGraph(), emptyResult, { noTimestamp: true });
    for (const line of out.split('\n')) {
      const decl = /^\s+([A-Za-z0-9_()[\].-]+)(?:\["|_dir\[")/.exec(line);
      if (decl) expect(decl[1]).toMatch(/^[A-Za-z0-9_]+$/);
    }
  });
});
