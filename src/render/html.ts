import type { CheckResult } from '../types.js';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Exports exactly one function, satisfying R4. */
export function renderHtml(mermaidSrc: string, checkResult: CheckResult, opts: { noTimestamp: boolean }): string {
  const { stats, errors } = checkResult;
  const timestampLine = opts.noTimestamp ? '' : ` &middot; generated ${new Date().toISOString()}`;
  const header = `${stats.nodes} files &middot; ${stats.edges} edges &middot; ${errors.length} errors${timestampLine}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>spokes graph</title>
<style>
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; color: #1a1a1a; }
  header { margin-bottom: 1rem; color: #444; }
  .legend { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; font-size: 13px; }
  .legend span { display: inline-flex; align-items: center; gap: 0.4rem; }
  .swatch { width: 12px; height: 12px; border-radius: 2px; display: inline-block; border: 2px solid; }
  .hub { background: #E1F5EE; border-color: #0F6E56; }
  .spoke { background: #EEEDFE; border-color: #534AB7; }
  .unmarked { background: #F1EFE8; border-color: #5F5E5A; }
  .violation { background: #fff; border-color: #A32D2D; border-width: 3px; }
</style>
</head>
<body>
<header>${header}</header>
<div class="legend">
  <span><i class="swatch hub"></i> hub</span>
  <span><i class="swatch spoke"></i> spoke</span>
  <span><i class="swatch unmarked"></i> unmarked</span>
  <span><i class="swatch violation"></i> violation</span>
</div>
<pre class="mermaid">
${escapeHtml(mermaidSrc)}
</pre>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true });
</script>
</body>
</html>
`;
}
