import type { Diagnostic } from '../types.js';

/** Exports exactly one function, satisfying R4. */
export function renderText(diagnostics: Diagnostic[]): string {
  return diagnostics.map((d) => `${d.severity} ${d.code}: ${d.message}`).join('\n\n');
}
