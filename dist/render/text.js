/** Exports exactly one function, satisfying R4. */
export function renderText(diagnostics) {
    return diagnostics.map((d) => `${d.severity} ${d.code}: ${d.message}`).join('\n\n');
}
