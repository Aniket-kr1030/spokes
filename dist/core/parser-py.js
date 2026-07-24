import { readFileSync } from 'node:fs';
// Blanks out string-literal contents and `#` comments (newlines preserved) so
// the line scanner below never sees an `import` inside a docstring. Backslash
// always escapes the next character for termination purposes, matching how
// Python's tokenizer decides where a literal ends (even raw strings can't end
// on a backslashed quote).
function maskStringsAndComments(text) {
    const out = text.split('');
    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (c === '#') {
            while (i < text.length && text[i] !== '\n')
                out[i++] = ' ';
        }
        else if (c === '"' || c === "'") {
            const triple = text.slice(i, i + 3) === c.repeat(3);
            const quote = triple ? c.repeat(3) : c;
            i += quote.length; // quote chars stay visible; only contents are masked
            while (i < text.length) {
                if (text[i] === '\\') {
                    out[i] = ' ';
                    if (i + 1 < text.length && text[i + 1] !== '\n')
                        out[i + 1] = ' ';
                    i += 2;
                    continue;
                }
                if (text.slice(i, i + quote.length) === quote) {
                    i += quote.length;
                    break;
                }
                if (!triple && text[i] === '\n')
                    break; // unterminated single-line literal
                if (text[i] !== '\n')
                    out[i] = ' ';
                i++;
            }
        }
        else {
            i++;
        }
    }
    return out.join('');
}
function parenDelta(maskedLine) {
    let depth = 0;
    for (const c of maskedLine) {
        if (c === '(' || c === '[' || c === '{')
            depth++;
        else if (c === ')' || c === ']' || c === '}')
            depth--;
    }
    return depth;
}
// Joins physical lines into logical statements: open brackets and trailing
// backslashes continue onto the next line, so `from x import (a,\n b)` scans
// as one statement anchored at its first line.
function toLogicalLines(masked, raw) {
    const maskedLines = masked.split('\n');
    const rawLines = raw.split('\n');
    const logical = [];
    let li = 0;
    while (li < maskedLines.length) {
        const start = li;
        let depth = 0;
        let maskedParts = [];
        let rawParts = [];
        for (;;) {
            let m = maskedLines[li];
            depth += parenDelta(m);
            const continued = depth > 0 || /\\\s*$/.test(m);
            if (/\\\s*$/.test(m))
                m = m.replace(/\\\s*$/, ' ');
            maskedParts.push(m);
            rawParts.push(rawLines[li]);
            li++;
            if (!continued || li >= maskedLines.length)
                break;
        }
        const first = maskedParts[0];
        logical.push({
            masked: maskedParts.join(' '),
            raw: rawParts.join('\n'),
            line: start + 1,
            indent: first.length - first.trimStart().length,
        });
    }
    return logical;
}
/** Exports exactly one function, satisfying R4. All other declarations above are non-exported locals. */
export function parsePythonFile(absPath) {
    const raw = readFileSync(absPath, 'utf8');
    const masked = maskStringsAndComments(raw);
    const logical = toLogicalLines(masked, raw);
    const specifiers = [];
    const defNames = [];
    let allNames;
    // `if TYPE_CHECKING:` bodies are Python's type-only imports; tracked by
    // indentation (the block ends at the first non-blank line at or above the
    // guard's own indent).
    let typeCheckingIndent = null;
    for (const stmt of logical) {
        const trimmed = stmt.masked.trim();
        if (trimmed === '')
            continue;
        if (typeCheckingIndent !== null && stmt.indent <= typeCheckingIndent)
            typeCheckingIndent = null;
        const typeOnly = typeCheckingIndent !== null;
        if (/^if\s+(?:typing\s*\.\s*)?TYPE_CHECKING\s*[:(]/.test(trimmed))
            typeCheckingIndent = stmt.indent;
        const loc = { file: absPath, line: stmt.line, col: stmt.indent + 1 };
        const plain = /^import\s+(.+)$/.exec(trimmed);
        const from = plain ? null : /^from\s+([.\w]+)\s+import\s+(.+)$/.exec(trimmed);
        if (plain) {
            for (const item of plain[1].split(',')) {
                const m = /^([A-Za-z_][\w.]*)(?:\s+as\s+\w+)?$/.exec(item.trim());
                if (m)
                    specifiers.push({ text: m[1], loc, typeOnly });
            }
        }
        else if (from) {
            const base = from[1];
            const namesPart = from[2].replace(/[()]/g, '').trim();
            if (namesPart.startsWith('*')) {
                specifiers.push({ text: base, loc, typeOnly });
            }
            else {
                for (const item of namesPart.split(',')) {
                    const m = /^([A-Za-z_]\w*)(?:\s+as\s+\w+)?$/.exec(item.trim());
                    if (!m)
                        continue;
                    const text = base.endsWith('.') ? base + m[1] : `${base}.${m[1]}`;
                    specifiers.push({ text, loc, typeOnly, fromImport: true });
                }
            }
            continue;
        }
        if (stmt.indent !== 0)
            continue;
        // A literal `__all__` wins over counting definitions (names are read from
        // the raw text — the masked copy has the string contents blanked out).
        if (/^__all__\s*(?::[^=]*)?=/.test(trimmed)) {
            allNames = [...stmt.raw.matchAll(/["']([^"']*)["']/g)].map((m) => m[1]);
            continue;
        }
        const def = /^(?:async\s+)?def\s+([A-Za-z_]\w*)/.exec(trimmed) ?? /^class\s+([A-Za-z_]\w*)/.exec(trimmed);
        if (def && !def[1].startsWith('_') && !defNames.includes(def[1]))
            defNames.push(def[1]);
    }
    return { specifiers, exports: allNames ?? defNames };
}
