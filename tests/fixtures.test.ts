import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/core/config.js';
import { buildGraph } from '../src/graph-builder.js';
import { check as checkR1 } from '../src/rules/r1-spoke-outdegree.js';
import { analyzeCycles } from '../src/rules/r3-acyclicity.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'dist', 'cli.js');
const FIXTURES_DIR = join(ROOT, 'fixtures');

function runCli(args: string[], cwd: string): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf8' });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status ?? 1 };
}

function makeUnresolvableImportRepro(): string {
  const dir = mkdtempSync(join(tmpdir(), 'spokes-eresolve-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'eresolve-repro' }));
  writeFileSync(
    join(dir, 'spokes.config.json'),
    JSON.stringify({
      include: ['src/**/*.ts'],
      exclude: [],
      roles: [{ glob: 'src/**', role: 'spoke' }],
      defaultRole: 'unmarked',
      strictCycles: true,
      singleExport: 'warn',
      typeOnlyEdges: 'ignore',
      externalPackages: 'ignore',
    }),
  );
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'a.ts'), "import { missing } from './does-not-exist.js';\nexport function a(): void { missing(); }\n");
  return dir;
}

const fixtureNames = readdirSync(FIXTURES_DIR)
  .filter((name) => statSync(join(FIXTURES_DIR, name)).isDirectory())
  .sort();

describe('fixtures (PRD §11 acceptance tests)', () => {
  for (const name of fixtureNames) {
    it(`${name}: spokes check --json matches expected.json`, () => {
      const fixtureDir = join(FIXTURES_DIR, name);
      const expected = JSON.parse(readFileSync(join(fixtureDir, 'expected.json'), 'utf8'));
      const { stdout } = runCli(['check', '--json'], fixtureDir);
      expect(JSON.parse(stdout)).toEqual(expected);
    });
  }

  it('f05-three-cycle: suggest emits a 3-file preview + hub stub', () => {
    const fixtureDir = join(FIXTURES_DIR, 'f05-three-cycle');
    const expected = readFileSync(join(fixtureDir, 'expected-suggest.txt'), 'utf8');
    const { stdout } = runCli(['suggest'], fixtureDir);
    expect(stdout.trimEnd()).toBe(expected.trimEnd());
  });

  it('f07-type-only: flipping typeOnlyEdges to "count" makes the type-only edge real and triggers S001', () => {
    const fixtureDir = join(FIXTURES_DIR, 'f07-type-only');
    const config = loadConfig(fixtureDir);
    const countConfig = { ...config, typeOnlyEdges: 'count' as const };
    const { graph } = buildGraph(countConfig, fixtureDir);
    const diagnostics = checkR1(graph, countConfig);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('S001');
  });

  it('f06-unmarked-mixed: the cycle through the unmarked node disappears when strictCycles is false', () => {
    const fixtureDir = join(FIXTURES_DIR, 'f06-unmarked-mixed');
    const config = loadConfig(fixtureDir);
    const relaxed = { ...config, strictCycles: false };
    const { graph } = buildGraph(relaxed, fixtureDir);
    expect(analyzeCycles(graph, relaxed).cycles).toHaveLength(0);
  });

  it('an unresolvable relative import surfaces as an E-RESOLVE warning in `check --json`\'s warnings array', () => {
    const dir = makeUnresolvableImportRepro();
    const { stdout, status } = runCli(['check', '--json'], dir);
    const result = JSON.parse(stdout);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe('E-RESOLVE');
    expect(result.warnings[0].primary.file).toBe('src/a.ts');
    expect(status).toBe(0); // a warning alone must not fail the exit code
  });

  it('an unresolvable relative import is still printed to stderr by `spokes graph` (no CheckResult of its own to carry it)', () => {
    const dir = makeUnresolvableImportRepro();
    const { stderr, status } = runCli(['graph', '--out', mkdtempSync(join(tmpdir(), 'spokes-graph-out-'))], dir);
    expect(stderr).toContain('E-RESOLVE');
    expect(stderr).toContain("could not resolve \"./does-not-exist.js\"");
    expect(status).toBe(0);
  });
});
