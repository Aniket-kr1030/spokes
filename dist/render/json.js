function toFrozenShape(d) {
    return { code: d.code, message: d.message, primary: d.primary, related: d.related };
}
/** Exports exactly one function, satisfying R4. Serializes to the frozen §10 schema (no `severity` field). */
export function renderJson(result) {
    const output = {
        version: result.version,
        errors: result.errors.map(toFrozenShape),
        warnings: result.warnings.map(toFrozenShape),
        stats: result.stats,
    };
    return JSON.stringify(output, null, 2);
}
