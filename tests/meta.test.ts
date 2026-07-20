import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'dist', 'cli.js');

describe('meta: spokes obeys its own rules (dogfooding)', () => {
  it('spokes check exits 0 on the tool\'s own src/', () => {
    let status = 0;
    let stdout = '';
    try {
      stdout = execFileSync('node', [CLI, 'check', '--json'], { cwd: ROOT, encoding: 'utf8' });
    } catch (err) {
      const e = err as { stdout: string; status: number };
      status = e.status;
      stdout = e.stdout;
    }
    const result = JSON.parse(stdout);
    expect(result.errors).toEqual([]);
    expect(status).toBe(0);
  });
});
