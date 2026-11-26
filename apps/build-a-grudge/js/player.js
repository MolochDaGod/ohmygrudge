// Runs a Grudge Engine game in a sandboxed iframe.
let engineSrc = null;
async function engine() {
  if (!engineSrc) engineSrc = await (await fetch('engine/grudge.js')).text();
  return engineSrc;
}

export function gameSize(code) {
  const m = /G\.init\(\s*\{[^}]*?width\s*:\s*(\d+)[^}]*?height\s*:\s*(\d+)/.exec(code || '');
  return m ? { w: +m[1] || 800, h: +m[2] || 450 } : { w: 800, h: 450 };
}

async function buildDoc(code) {
  const eng = await engine();
  const head = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}</style></head><body>\n' +
    '<script>' + eng + '<\/script>\n<script>window.__GF_LINES=[@@S,@@E];<\/script>\n<script>\n';
  const start = head.split('\n').length;
  const safe = String(code || '').replace(/<\/script/gi, '<\\/script');
  const end = start + safe.split('\n').length - 1;
  return head.replace('@@S', start).replace('@@E', end) + safe + '\n<\/script></body></html>';
}

export async function createPlayer(container, code, h = {}) {
  const { w, h: gh } = gameSize(code);
  const doc = await buildDoc(code);
  const wrap = document.createElement('div');
  wrap.className = 'player-frame absolute';
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts allow-pointer-lock');
  iframe.setAttribute('allow', 'autoplay; fullscreen; gamepad');
  iframe.title = 'Game';
  iframe.srcdoc = doc;
  wrap.appendChild(iframe);
  container.appendChild(wrap);

  const fit = () => {
    const cw = container.clientWidth, ch = container.clientHeight;
    if (!cw || !ch) return;
    const s = Math.min(cw / w, ch / gh);
    const W = Math.floor(w * s), H = Math.floor(gh * s);
    Object.assign(wrap.style, { width: W + 'px', height: H + 'px', left: (cw - W) / 2 + 'px', top: (ch - H) / 2 + 'px' });
  };
  const ro = new ResizeObserver(fit);
  ro.observe(container);
  fit();

  const pending = {};
  let n = 0;
  const onMsg = e => {
    if (e.source !== iframe.contentWindow) return;
    const d = e.data || {};
    if (d.type === 'grudge:ready') h.onReady && h.onReady();
    else if (d.type === 'grudge:error') h.onError && h.onError(d);
    else if (d.type === 'grudge:snapshot' && pending[d.id]) { const cb = pending[d.id]; delete pending[d.id]; cb(d.data); }
  };
  window.addEventListener('message', onMsg);

  return {
    iframe, wrap,
    focus() { try { iframe.focus(); iframe.contentWindow.postMessage({ type: 'grudge:focus' }, '*'); } catch (e) {} },
    snapshot() {
      return new Promise(res => {
        const id = ++n; pending[id] = res;
        try { iframe.contentWindow.postMessage({ type: 'grudge:snapshot', id }, '*'); } catch (e) { res(null); }
        setTimeout(() => { if (pending[id]) { delete pending[id]; res(null); } }, 1500);
      });
    },
    destroy() { ro.disconnect(); window.removeEventListener('message', onMsg); wrap.remove(); }
  };
}
