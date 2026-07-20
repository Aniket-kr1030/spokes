import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import type { Loc } from '../types.js';

interface ImportSpecifier {
  text: string;
  loc: Loc;
  typeOnly: boolean;
}

interface ParseResult {
  specifiers: ImportSpecifier[];
  exports: string[];
}

function scriptKindFor(path: string): ts.ScriptKind {
  switch (extname(path)) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS; // .ts, .mts, .cts
  }
}

function locOf(sf: ts.SourceFile, pos: number, filePath: string): Loc {
  const { line, character } = sf.getLineAndCharacterOfPosition(pos);
  return { file: filePath, line: line + 1, col: character + 1 };
}

/** Exports exactly one function, satisfying R4. `ImportSpecifier` above is a non-exported local type. */
export function parseFile(absPath: string): ParseResult {
  const text = readFileSync(absPath, 'utf8');
  const sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true, scriptKindFor(absPath));

  const specifiers: ImportSpecifier[] = [];
  const exportNames: string[] = [];

  function addSpecifier(moduleSpecifier: ts.Expression | undefined, node: ts.Node, typeOnly: boolean): void {
    if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
      specifiers.push({ text: moduleSpecifier.text, loc: locOf(sf, node.getStart(sf), absPath), typeOnly });
    }
  }

  function importIsTypeOnly(clause: ts.ImportClause | undefined): boolean {
    if (!clause) return false; // side-effect import: `import './x'`
    if (clause.isTypeOnly) return true;
    if (clause.name) return false; // default import is always a value
    const bindings = clause.namedBindings;
    if (!bindings) return false;
    if (ts.isNamespaceImport(bindings)) return false; // `import * as ns`
    if (bindings.elements.length === 0) return false; // `import {} from 'x'`
    return bindings.elements.every((el) => el.isTypeOnly);
  }

  // Pure type declarations never contribute to the value-export surface R4 counts.
  function collectExportNames(node: ts.Node): void {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const hasExport = !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const hasDefault = !!modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

    if (hasExport && (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node))) {
      return; // pure type-space declarations: excluded regardless of typeOnlyEdges
    }
    if (hasExport && hasDefault) {
      exportNames.push('default');
      return;
    }
    if (hasExport && ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) exportNames.push(decl.name.text);
      }
      return;
    }
    if (hasExport && (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) {
      exportNames.push(node.name.text);
      return;
    }
    if (ts.isExportAssignment(node)) {
      exportNames.push('default');
      return;
    }
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const el of node.exportClause.elements) {
        if (!el.isTypeOnly && !node.isTypeOnly) exportNames.push(el.name.text);
      }
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      addSpecifier(node.moduleSpecifier, node, importIsTypeOnly(node.importClause));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      addSpecifier(node.moduleSpecifier, node, !!node.isTypeOnly);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if ((isDynamicImport || isRequire) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
        addSpecifier(node.arguments[0], node, false);
      }
    }

    collectExportNames(node);
    ts.forEachChild(node, visit);
  }

  visit(sf);

  return { specifiers, exports: exportNames };
}
