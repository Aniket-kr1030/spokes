import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'dist', 'cli.js');
const FIXTURES_DIR = join(ROOT, 'fixtures');

function runCli(args: string[], cwd: string): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf8' });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status ?? 1 };
}

describe('explain', () => {
  const fixtureDir = join(FIXTURES_DIR, 'f02-spoke-fanout');

  it('reports role, exports, both edge directions, and per-rule status for a real node', () => {
    const { stdout, status } = runCli(['explain', 'src/service.ts'], fixtureDir);
    expect(status).toBe(0);
    expect(stdout).toContain('src/service.ts');
    expect(stdout).toMatch(/role: (hub|spoke|unmarked)/);
    expect(stdout).toMatch(/incoming edges \(\d+\)/);
    expect(stdout).toMatch(/outgoing edges \(\d+\)/);
    for (const rule of ['R1 (spoke out-degree)', 'R2 (hub in-degree)', 'R3 (acyclicity)', 'R4 (single export)']) {
      expect(stdout).toContain(rule);
    }
  });

  it('surfaces the violating rule as FAIL for the file that actually breaks it', () => {
    // f02's whole point is one spoke with several outgoing edges (S001).
    const { stdout } = runCli(['explain', 'src/service.ts'], fixtureDir);
    expect(stdout).toContain('R1 (spoke out-degree): FAIL');
    expect(stdout).toContain('S001');
  });

  it('accepts a path relative to cwd and normalizes it to the graph\'s posix-relative form', () => {
    const viaDotSlash = runCli(['explain', './src/service.ts'], fixtureDir);
    const viaPlain = runCli(['explain', 'src/service.ts'], fixtureDir);
    expect(viaDotSlash.status).toBe(0);
    expect(viaDotSlash.stdout).toBe(viaPlain.stdout);
  });

  it('exits 2 with a clear message when the path is not a node in the graph', () => {
    const { stderr, status } = runCli(['explain', 'src/does-not-exist.ts'], fixtureDir);
    expect(status).toBe(2);
    expect(stderr).toContain('is not a node in the graph');
  });
});

describe('init', () => {
  function emptyRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), 'spokes-init-'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'init-target' }));
    return dir;
  }

  it('writes a spokes.config.json that is valid JSON and immediately usable by `check`', () => {
    const dir = emptyRepo();
    const { status } = runCli(['init'], dir);
    expect(status).toBe(0);

    const raw = readFileSync(join(dir, 'spokes.config.json'), 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(raw.endsWith('\n')).toBe(true);

    // The written config must actually load — this is the contract that broke in v1.0.4.
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'a.ts'), 'export function a(): void {}\n');
    const check = runCli(['check'], dir);
    expect(check.status).toBe(0);
  });

  it('points $schema at the published package name so editors resolve it after install', () => {
    const dir = emptyRepo();
    runCli(['init'], dir);
    const config = JSON.parse(readFileSync(join(dir, 'spokes.config.json'), 'utf8'));
    const pkgName = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).name;
    expect(config.$schema).toBe(`./node_modules/${pkgName}/schema.json`);
  });

  it('default include glob covers both TS/JS and Python sources', () => {
    const dir = emptyRepo();
    runCli(['init'], dir);
    const config = JSON.parse(readFileSync(join(dir, 'spokes.config.json'), 'utf8'));
    expect(config.include.join(' ')).toMatch(/\bts\b/);
    expect(config.include.join(' ')).toMatch(/\bpy\b/);
  });

  it('refuses to overwrite an existing config (exit 2, original left untouched)', () => {
    const dir = emptyRepo();
    runCli(['init'], dir);
    const before = readFileSync(join(dir, 'spokes.config.json'), 'utf8');

    const second = runCli(['init'], dir);
    expect(second.status).toBe(2);
    expect(second.stderr).toContain('refusing to overwrite');
    expect(readFileSync(join(dir, 'spokes.config.json'), 'utf8')).toBe(before);
  });
});
