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
<meta name="color-scheme" content="light" />
<title>spokes graph</title>
<style>
  html { background: #ffffff; color-scheme: light; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; color: #1a1a1a; background: #ffffff; }
  header { margin-bottom: 1rem; color: #444; }
  .legend { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 1rem; font-size: 13px; flex-wrap: wrap; }
  .legend span { display: inline-flex; align-items: center; gap: 0.4rem; }
  .swatch { width: 12px; height: 12px; border-radius: 2px; display: inline-block; border: 2px solid; }
  .hub { background: #E1F5EE; border-color: #0F6E56; }
  .spoke { background: #EEEDFE; border-color: #534AB7; }
  .unmarked { background: #F1EFE8; border-color: #5F5E5A; }
  .violation { background: #fff; border-color: #A32D2D; border-width: 3px; }
  .toolbar { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
  .toolbar button {
    font: inherit; font-size: 13px; padding: 0.35rem 0.7rem; border: 1px solid #ccc; border-radius: 4px;
    background: #fafafa; cursor: pointer; color: #1a1a1a;
  }
  .toolbar button:hover { background: #f0f0f0; }
  .toolbar .hint { font-size: 12px; color: #777; margin-left: 0.5rem; }
  #viewport {
    overflow: hidden; border: 1px solid #e5e5e5; border-radius: 6px; background: #ffffff;
    width: 100%; height: 75vh; min-height: 420px; position: relative; cursor: grab;
  }
  #viewport.grabbing { cursor: grabbing; }
  #inner { transform-origin: 0 0; will-change: transform; }
  #inner svg { display: block; max-width: none !important; height: auto !important; }
  #diagram-source { display: none; }
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
<div class="toolbar">
  <button id="zoom-in" type="button">Zoom in</button>
  <button id="zoom-out" type="button">Zoom out</button>
  <button id="fit" type="button">Fit to screen</button>
  <span class="hint">scroll to zoom &middot; drag to pan</span>
</div>
<div id="viewport">
  <div id="inner"></div>
</div>
<pre id="diagram-source">${escapeHtml(mermaidSrc)}</pre>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({
    startOnLoad: false,
    flowchart: { useMaxWidth: false, htmlLabels: true, nodeSpacing: 40, rankSpacing: 60 },
    themeVariables: { fontSize: '16px' },
  });

  const source = document.getElementById('diagram-source').textContent;
  const viewport = document.getElementById('viewport');
  const inner = document.getElementById('inner');

  let scale = 1;
  let panX = 0;
  let panY = 0;

  function applyTransform() {
    inner.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
  }

  function fitToScreen() {
    const svgEl = inner.querySelector('svg');
    if (!svgEl) return;
    const box = svgEl.getBBox();
    const vpRect = viewport.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const pad = 32;
    const fitScale = Math.min((vpRect.width - pad) / box.width, (vpRect.height - pad) / box.height, 1.5);
    scale = Math.max(fitScale, 0.05);
    panX = (vpRect.width - box.width * scale) / 2 - box.x * scale;
    panY = (vpRect.height - box.height * scale) / 2 - box.y * scale;
    applyTransform();
  }

  const { svg } = await mermaid.render('spokes-diagram-svg', source);
  inner.innerHTML = svg;
  fitToScreen();

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    // Proportional to deltaY (not a fixed step per event) so trackpads' many small
    // events zoom smoothly instead of jumping, and zoom is anchored under the cursor
    // instead of the content's top-left corner, so the view doesn't jump around.
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomIntensity = 0.0015;
    const factor = Math.exp(-e.deltaY * zoomIntensity);
    const newScale = Math.min(6, Math.max(0.05, scale * factor));
    const contentX = (mouseX - panX) / scale;
    const contentY = (mouseY - panY) / scale;
    panX = mouseX - contentX * newScale;
    panY = mouseY - contentY * newScale;
    scale = newScale;
    applyTransform();
  }, { passive: false });

  let isPanning = false;
  let startX = 0;
  let startY = 0;

  viewport.addEventListener('mousedown', (e) => {
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    viewport.classList.add('grabbing');
  });
  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
  });
  window.addEventListener('mouseup', () => {
    isPanning = false;
    viewport.classList.remove('grabbing');
  });

  document.getElementById('zoom-in').addEventListener('click', () => {
    scale = Math.min(6, scale * 1.25);
    applyTransform();
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    scale = Math.max(0.05, scale / 1.25);
    applyTransform();
  });
  document.getElementById('fit').addEventListener('click', fitToScreen);
</script>
</body>
</html>
`;
}
