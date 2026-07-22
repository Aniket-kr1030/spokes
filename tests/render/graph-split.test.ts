import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CLI = join(ROOT, 'dist', 'cli.js');

// graph.ts splits into one diagram per top-level group above 300 nodes. Building
// a repo that large is the only way to reach that path, so it's generated here
// rather than committed as a fixture.
const OVER_SPLIT_THRESHOLD = 320;

function makeBigRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'spokes-split-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'split-repo' }));
  writeFileSync(
    join(dir, 'spokes.config.json'),
    JSON.stringify({
      include: ['src/**/*.ts'],
      exclude: [],
      roles: [{ glob: 'src/**', role: 'spoke' }],
      defaultRole: 'unmarked',
      strictCycles: true,
      singleExport: 'off',
      typeOnlyEdges: 'ignore',
      externalPackages: 'ignore',
    }),
  );
  // One plain group and one Next.js-style route group, so the generated
  // filenames exercise both the ordinary and the parenthesized case.
  const groups = ['plain', '(app)'];
  for (const group of groups) {
    mkdirSync(join(dir, 'src', group), { recursive: true });
    for (let i = 0; i < OVER_SPLIT_THRESHOLD / 2; i++) {
      writeFileSync(join(dir, 'src', group, `m${i}.ts`), `export function m${i}(): number { return ${i}; }\n`);
    }
  }
  return dir;
}

describe('graph split above the node threshold', () => {
  it('writes one diagram per top-level group plus an overview, with filenames free of path punctuation', () => {
    const repo = makeBigRepo();
    const out = mkdtempSync(join(tmpdir(), 'spokes-split-out-'));
    const result = spawnSync('node', [CLI, 'graph', '--no-timestamp', '--out', out], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('writing one diagram per top-level directory');

    const written = readdirSync(out).sort();
    expect(written).toContain('spokes-graph-overview.mmd');
    expect(written).toContain('spokes-graph-overview.html');

    // The route group `src/(app)` must not leak `(` / `)` into a filename.
    for (const name of written) {
      expect(name).toMatch(/^[A-Za-z0-9_.-]+$/);
    }
    // Both groups produced their own diagram (3 basenames: 2 groups + overview).
    const basenames = new Set(written.map((n) => n.replace(/\.(mmd|html|dot)$/, '')));
    expect(basenames.size).toBe(3);
  });
});
