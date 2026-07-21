import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePythonFile } from '../src/core/parser-py.js';
import { resolvePythonSpecifier } from '../src/core/resolver-py.js';

function writeTempPy(source: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'spokes-py-'));
  const file = join(dir, 'mod.py');
  writeFileSync(file, source);
  return file;
}

describe('parser-py: import extraction', () => {
  it('handles plain, aliased, comma-separated, and dotted imports', () => {
    const file = writeTempPy('import os\nimport a.b.c as abc, second\n');
    const { specifiers } = parsePythonFile(file);
    expect(specifiers.map((s) => s.text)).toEqual(['os', 'a.b.c', 'second']);
    expect(specifiers.map((s) => s.loc.line)).toEqual([1, 2, 2]);
    expect(specifiers.every((s) => !s.fromImport)).toBe(true);
  });

  it('emits one specifier per from-imported name, marked fromImport', () => {
    const file = writeTempPy('from pkg.sub import one, two as t\nfrom . import sib\nfrom ..up import thing\n');
    const { specifiers } = parsePythonFile(file);
    expect(specifiers.map((s) => s.text)).toEqual(['pkg.sub.one', 'pkg.sub.two', '.sib', '..up.thing']);
    expect(specifiers.every((s) => s.fromImport)).toBe(true);
  });

  it('star imports target the module itself', () => {
    const file = writeTempPy('from pkg.mod import *\n');
    const { specifiers } = parsePythonFile(file);
    expect(specifiers).toHaveLength(1);
    expect(specifiers[0].text).toBe('pkg.mod');
    expect(specifiers[0].fromImport).toBeFalsy();
  });

  it('joins parenthesized multi-line and backslash-continued imports, anchored at the first line', () => {
    const file = writeTempPy('from pkg import (\n    alpha,\n    beta,\n)\nimport \\\n    gamma\n');
    const { specifiers } = parsePythonFile(file);
    expect(specifiers.map((s) => s.text)).toEqual(['pkg.alpha', 'pkg.beta', 'gamma']);
    expect(specifiers.map((s) => s.loc.line)).toEqual([1, 1, 5]);
  });

  it('ignores import-looking text inside docstrings, strings, and comments', () => {
    const file = writeTempPy(
      '"""docstring\nimport fake_a\nfrom fake_b import x\n"""\ns = "import fake_c"\n# import fake_d\nimport real\n',
    );
    const { specifiers } = parsePythonFile(file);
    expect(specifiers.map((s) => s.text)).toEqual(['real']);
    expect(specifiers[0].loc.line).toBe(7);
  });

  it('marks imports inside `if TYPE_CHECKING:` blocks as typeOnly until the block dedents', () => {
    const file = writeTempPy(
      'from typing import TYPE_CHECKING\n\nif TYPE_CHECKING:\n    from .contract import Shape\n\nimport real\n',
    );
    const { specifiers } = parsePythonFile(file);
    const byText = new Map(specifiers.map((s) => [s.text, s.typeOnly]));
    expect(byText.get('.contract.Shape')).toBe(true);
    expect(byText.get('real')).toBe(false);
  });
});

describe('parser-py: export counting (R4)', () => {
  it('counts public top-level def/class names, excluding underscore-prefixed and nested ones', () => {
    const file = writeTempPy(
      'def visible():\n    def nested():\n        pass\n\nasync def also_visible():\n    pass\n\nclass Thing:\n    pass\n\ndef _private():\n    pass\n',
    );
    expect(parsePythonFile(file).exports).toEqual(['visible', 'also_visible', 'Thing']);
  });

  it('a literal __all__ overrides definition counting', () => {
    const file = writeTempPy('__all__ = ["only_this"]\n\ndef only_this():\n    pass\n\ndef extra():\n    pass\n');
    expect(parsePythonFile(file).exports).toEqual(['only_this']);
  });
});

describe('resolver-py', () => {
  function makeTree(): string {
    const root = mkdtempSync(join(tmpdir(), 'spokes-pyres-'));
    mkdirSync(join(root, 'pkg', 'sub'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'pkg', '__init__.py'), '');
    writeFileSync(join(root, 'pkg', 'mod.py'), '');
    writeFileSync(join(root, 'pkg', 'sub', '__init__.py'), '');
    writeFileSync(join(root, 'pkg', 'sub', 'leaf.py'), '');
    writeFileSync(join(root, 'src', 'lib.py'), '');
    return root;
  }

  it('resolves relative sibling modules and parent-package hops', () => {
    const root = makeTree();
    const fromLeaf = join(root, 'pkg', 'sub', 'leaf.py');
    expect(resolvePythonSpecifier(root, join(root, 'pkg', '__init__.py'), '.mod', false).absPath).toBe(
      join(root, 'pkg', 'mod.py'),
    );
    expect(resolvePythonSpecifier(root, fromLeaf, '..mod', false).absPath).toBe(join(root, 'pkg', 'mod.py'));
  });

  it('from-import falls back from `pkg.symbol` to the package __init__', () => {
    const root = makeTree();
    const from = join(root, 'pkg', 'mod.py');
    expect(resolvePythonSpecifier(root, from, 'pkg.some_symbol', true).absPath).toBe(join(root, 'pkg', '__init__.py'));
    // ...but prefers the submodule reading when one exists
    expect(resolvePythonSpecifier(root, from, 'pkg.sub', true).absPath).toBe(join(root, 'pkg', 'sub', '__init__.py'));
  });

  it('resolves absolute imports against repoRoot and repoRoot/src', () => {
    const root = makeTree();
    const from = join(root, 'pkg', 'mod.py');
    expect(resolvePythonSpecifier(root, from, 'pkg.sub.leaf', false).absPath).toBe(join(root, 'pkg', 'sub', 'leaf.py'));
    expect(resolvePythonSpecifier(root, from, 'lib', false).absPath).toBe(join(root, 'src', 'lib.py'));
  });

  it('treats unknown absolute imports as external (bare) and broken relative imports as unresolved', () => {
    const root = makeTree();
    const from = join(root, 'pkg', 'mod.py');
    expect(resolvePythonSpecifier(root, from, 'os.path', false).kind).toBe('bare');
    expect(resolvePythonSpecifier(root, from, '.does_not_exist', false).kind).toBe('unresolved');
  });

  it('never returns the importing file itself (`from . import symbol` in __init__.py)', () => {
    const root = makeTree();
    const initFile = join(root, 'pkg', '__init__.py');
    expect(resolvePythonSpecifier(root, initFile, '.some_symbol', true).kind).toBe('unresolved');
  });
});
