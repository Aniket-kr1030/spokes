import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CLI = join(ROOT, 'dist', 'cli.js');
const FIXTURE_DIR = join(ROOT, 'fixtures', 'f10-big-det');

function runGraph(outDir: string): void {
  execFileSync('node', [CLI, 'graph', '--no-timestamp', '--out', outDir], { cwd: FIXTURE_DIR, encoding: 'utf8' });
}

describe('graph determinism (f10-big-det, 40 files)', () => {
  it('two consecutive `graph --no-timestamp` runs produce byte-identical .mmd and .html output', () => {
    const out1 = mkdtempSync(join(tmpdir(), 'spokes-f10-1-'));
    const out2 = mkdtempSync(join(tmpdir(), 'spokes-f10-2-'));

    runGraph(out1);
    runGraph(out2);

    expect(readFileSync(join(out1, 'spokes-graph.mmd'), 'utf8')).toBe(readFileSync(join(out2, 'spokes-graph.mmd'), 'utf8'));
    expect(readFileSync(join(out1, 'spokes-graph.html'), 'utf8')).toBe(readFileSync(join(out2, 'spokes-graph.html'), 'utf8'));
  });
});
