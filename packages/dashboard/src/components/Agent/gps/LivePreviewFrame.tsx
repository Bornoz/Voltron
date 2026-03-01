import { memo, useRef, useEffect, useCallback, useState } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

/* ─── Renderable file extensions ─── */
const RENDERABLE_EXTS = new Set([
  '.html', '.htm', '.jsx', '.tsx', '.vue', '.svelte', '.php', '.css', '.svg',
]);

const JSX_EXTS = new Set(['.jsx', '.tsx']);

export function isRenderable(ext: string): boolean {
  return RENDERABLE_EXTS.has(ext.toLowerCase());
}

/* ─── JSX/TSX → HTML wrapper ─── */
function wrapJSXSource(source: string, ext: string): string {
  const isTS = ext === '.tsx';
  // Extract default export component name
  const exportMatch = source.match(/export\s+(?:default\s+)?function\s+(\w+)/);
  const componentName = exportMatch?.[1] ?? 'App';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; }
  #root { min-height: 100vh; }
  /* Tailwind-like reset */
  button, input, select, textarea { font: inherit; color: inherit; }
  a { color: inherit; text-decoration: none; }
  /* Voltron animation presets */
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.8) } to { opacity: 1; transform: scale(1) } }
  @keyframes bounce { 0%,100% { transform: scale(1) } 50% { transform: scale(1.1) } }
  @keyframes wiggle { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-5deg) } 75% { transform: rotate(5deg) } }
  @keyframes glowPulse { 0%,100% { box-shadow: 0 0 5px rgba(59,130,246,0.3) } 50% { box-shadow: 0 0 20px rgba(59,130,246,0.6), 0 0 40px rgba(59,130,246,0.2) } }
</style>
<script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.development.js" crossorigin><\/script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.development.js" crossorigin><\/script>
<script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7/babel.min.js" crossorigin><\/script>
<!-- Tailwind CDN for styling -->
<script src="https://cdn.tailwindcss.com"><\/script>
<script>tailwind.config = { darkMode: 'class', theme: { extend: {} } }<\/script>
</head>
<body class="dark">
<div id="root"></div>
<script type="text/babel" data-presets="react${isTS ? ',typescript' : ''}">
// Provide common React hooks as globals
const { useState, useEffect, useRef, useMemo, useCallback, useContext, createContext, Fragment } = React;

// Stub imports that would fail in browser
const lucideReact = new Proxy({}, { get: (_, name) => {
  if (typeof name === 'string' && name[0] === name[0]?.toUpperCase()) {
    return (props) => React.createElement('span', { className: 'inline-flex items-center justify-center w-4 h-4 text-current opacity-60', title: name, ...props }, '[' + name + ']');
  }
  return undefined;
}});

// Source code (imports stripped)
${source
  .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '// [import removed for preview]')
  .replace(/^export\s+default\s+/gm, 'const __DefaultExport__ = ')
  .replace(/^export\s+/gm, '')}

// Render
const __Component__ = typeof __DefaultExport__ !== 'undefined' ? __DefaultExport__ : (typeof ${componentName} !== 'undefined' ? ${componentName} : () => React.createElement('div', {style:{padding:'2rem',color:'#94a3b8'}}, 'Component rendered'));
const __root__ = ReactDOM.createRoot(document.getElementById('root'));
__root__.render(React.createElement(__Component__));
<\/script>

<!-- Voltron right-click bridge -->
<script>
// Assign unique data-vid to every element for reliable selection
(function() {
  var vid = 0;
  function tagAll(root) {
    var els = root.querySelectorAll('*');
    for (var i = 0; i < els.length; i++) {
      if (!els[i].hasAttribute('data-vid')) els[i].setAttribute('data-vid', 'v' + (vid++));
    }
  }
  tagAll(document);
  new MutationObserver(function(muts) {
    for (var i = 0; i < muts.length; i++) {
      for (var j = 0; j < muts[i].addedNodes.length; j++) {
        var n = muts[i].addedNodes[j];
        if (n.nodeType === 1) {
          if (!n.hasAttribute('data-vid')) n.setAttribute('data-vid', 'v' + (vid++));
          if (n.querySelectorAll) tagAll(n);
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
})();

document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
  var el = e.target;
  var selector = '';
  try {
    if (el.getAttribute('data-vid')) selector = '[data-vid="' + el.getAttribute('data-vid') + '"]';
    else if (el.id) selector = '#' + el.id;
    else if (el.className && typeof el.className === 'string') selector = el.tagName.toLowerCase() + '.' + el.className.split(' ').filter(Boolean).join('.');
    else selector = el.tagName.toLowerCase();
  } catch(err) { selector = 'unknown'; }

  var rect = el.getBoundingClientRect();
  var computed = window.getComputedStyle(el);

  window.parent.postMessage({
    type: 'VOLTRON_CONTEXT_MENU',
    x: e.clientX,
    y: e.clientY,
    selector: selector,
    tagName: el.tagName,
    textContent: (el.textContent || '').substring(0, 100),
    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    styles: {
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      fontFamily: computed.fontFamily,
      display: computed.display,
      position: computed.position,
      padding: computed.padding,
      margin: computed.margin,
      borderRadius: computed.borderRadius,
      opacity: computed.opacity,
      boxShadow: computed.boxShadow,
    }
  }, '*');
});

// Listen for style changes from parent
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'VOLTRON_APPLY_STYLE') return;
  var target = document.querySelector(e.data.selector);
  if (!target) return;
  var styles = e.data.styles || {};
  for (var prop in styles) {
    target.style[prop] = styles[prop];
  }
  // Notify parent of success
  window.parent.postMessage({ type: 'VOLTRON_STYLE_APPLIED', selector: e.data.selector, styles: styles }, '*');
});

// Text edit support
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'VOLTRON_EDIT_TEXT') return;
  var target = document.querySelector(e.data.selector);
  if (!target) return;
  target.textContent = e.data.text;
  window.parent.postMessage({ type: 'VOLTRON_TEXT_EDITED', selector: e.data.selector }, '*');
});

// Delete element
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'VOLTRON_DELETE_ELEMENT') return;
  var target = document.querySelector(e.data.selector);
  if (target && target.parentNode) {
    target.parentNode.removeChild(target);
    window.parent.postMessage({ type: 'VOLTRON_ELEMENT_DELETED', selector: e.data.selector }, '*');
  }
});

// Duplicate element
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'VOLTRON_DUPLICATE_ELEMENT') return;
  var target = document.querySelector(e.data.selector);
  if (target && target.parentNode) {
    var clone = target.cloneNode(true);
    target.parentNode.insertBefore(clone, target.nextSibling);
    window.parent.postMessage({ type: 'VOLTRON_ELEMENT_DUPLICATED', selector: e.data.selector }, '*');
  }
});

// Toggle visibility
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'VOLTRON_TOGGLE_VISIBILITY') return;
  var target = document.querySelector(e.data.selector);
  if (target) {
    target.style.display = target.style.display === 'none' ? '' : 'none';
    window.parent.postMessage({ type: 'VOLTRON_VISIBILITY_TOGGLED', selector: e.data.selector }, '*');
  }
});

// Hover highlight + inspector tooltip
var _voltronTip = document.createElement('div');
_voltronTip.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;padding:2px 6px;border-radius:3px;font:10px/1.4 monospace;color:#e2e8f0;background:rgba(15,23,42,0.92);border:1px solid rgba(59,130,246,0.4);white-space:nowrap;display:none;';
document.body.appendChild(_voltronTip);

document.addEventListener('mouseover', function(e) {
  var el = e.target;
  if (el === document.body || el === document.documentElement || el === _voltronTip) return;
  el.style.outline = '1px dashed rgba(59,130,246,0.4)';
  // Show tooltip
  var tag = el.tagName.toLowerCase();
  var cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : '';
  var rect = el.getBoundingClientRect();
  var size = Math.round(rect.width) + 'x' + Math.round(rect.height);
  _voltronTip.textContent = '<' + tag + cls + '> ' + size;
  _voltronTip.style.display = 'block';
  _voltronTip.style.left = Math.min(rect.left, window.innerWidth - 150) + 'px';
  _voltronTip.style.top = Math.max(0, rect.top - 20) + 'px';
  el.addEventListener('mouseout', function handler() {
    el.style.outline = '';
    _voltronTip.style.display = 'none';
    el.removeEventListener('mouseout', handler);
  });
});
<\/script>
</body>
</html>`;
}

/* ─── CSS → Visual Preview ─── */
function wrapCSSSource(source: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { background: #0f172a; color: #e2e8f0; font-family: system-ui, sans-serif; padding: 2rem; min-height: 100vh; }
  .preview-section { margin-bottom: 2rem; }
  .preview-section h3 { font-size: 0.75rem; color: #64748b; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .sample-elements { display: flex; flex-wrap: wrap; gap: 1rem; }
  .sample { padding: 1rem 1.5rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); }
  /* Voltron animation presets */
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.8) } to { opacity: 1; transform: scale(1) } }
  @keyframes bounce { 0%,100% { transform: scale(1) } 50% { transform: scale(1.1) } }
  @keyframes wiggle { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-5deg) } 75% { transform: rotate(5deg) } }
  @keyframes glowPulse { 0%,100% { box-shadow: 0 0 5px rgba(59,130,246,0.3) } 50% { box-shadow: 0 0 20px rgba(59,130,246,0.6), 0 0 40px rgba(59,130,246,0.2) } }
  /* User CSS applied below */
  ${source}
</style>
</head>
<body>
<div class="preview-section">
  <h3>CSS Preview</h3>
  <div class="sample-elements">
    <div class="sample"><h1>Heading 1</h1></div>
    <div class="sample"><h2>Heading 2</h2></div>
    <div class="sample"><p>Paragraph text with some content</p></div>
    <div class="sample"><button>Button</button></div>
    <div class="sample"><a href="#">Link text</a></div>
    <div class="sample"><input type="text" placeholder="Input field" /></div>
    <div class="sample"><ul><li>List item 1</li><li>List item 2</li></ul></div>
  </div>
</div>
</body>
</html>`;
}

/* ─── PHP → HTML (strip PHP tags) ─── */
function wrapPHPSource(source: string): string {
  const stripped = source
    .replace(/<\?php[\s\S]*?\?>/g, '<!-- [PHP block] -->')
    .replace(/<\?=[\s\S]*?\?>/g, '[dynamic]');
  return stripped.includes('<html') ? stripped : `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>body { background: #0f172a; color: #e2e8f0; font-family: system-ui, sans-serif; padding: 2rem; }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.8) } to { opacity: 1; transform: scale(1) } }
  @keyframes bounce { 0%,100% { transform: scale(1) } 50% { transform: scale(1.1) } }
  @keyframes wiggle { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-5deg) } 75% { transform: rotate(5deg) } }
  @keyframes glowPulse { 0%,100% { box-shadow: 0 0 5px rgba(59,130,246,0.3) } 50% { box-shadow: 0 0 20px rgba(59,130,246,0.6), 0 0 40px rgba(59,130,246,0.2) } }
</style>
</head><body>${stripped}</body></html>`;
}

/* ─── Props ─── */
interface LivePreviewFrameProps {
  filePath: string;
  projectId: string;
  extension: string;
  content: string | null;
  onContextMenu?: (data: ContextMenuEventData) => void;
  onStyleApplied?: (selector: string, styles: Record<string, string>) => void;
}

export interface ContextMenuEventData {
  x: number;
  y: number;
  selector: string;
  tagName: string;
  textContent: string;
  rect: { top: number; left: number; width: number; height: number };
  styles: Record<string, string>;
}

/* ─── Component ─── */
export const LivePreviewFrame = memo(function LivePreviewFrame({
  filePath, projectId, extension, content, onContextMenu, onStyleApplied,
}: LivePreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const ext = extension.toLowerCase();

  // Determine rendering strategy
  const useDirectURL = ext === '.html' || ext === '.htm';
  const useJSXTransform = JSX_EXTS.has(ext);
  const useCSSPreview = ext === '.css';
  const usePHPStrip = ext === '.php';
  const useSVGDirect = ext === '.svg';

  // For HTML files: load via server preview API (which injects editor script)
  const iframeSrc = useDirectURL
    ? `/api/projects/${projectId}/agent/preview/${filePath}`
    : undefined;

  // For JSX/TSX/CSS/PHP: build srcdoc from content
  const srcdoc = (() => {
    if (!content) return undefined;
    if (useJSXTransform) return wrapJSXSource(content, ext);
    if (useCSSPreview) return wrapCSSSource(content);
    if (usePHPStrip) return wrapPHPSource(content);
    if (useSVGDirect) return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}</style></head><body>${content}</body></html>`;
    return undefined;
  })();

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.type) return;
      switch (e.data.type) {
        case 'VOLTRON_CONTEXT_MENU':
          onContextMenu?.(e.data as ContextMenuEventData);
          break;
        case 'VOLTRON_STYLE_APPLIED':
          onStyleApplied?.(e.data.selector, e.data.styles);
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onContextMenu, onStyleApplied]);

  // iframe load handlers
  const handleLoad = useCallback(() => {
    setStatus('ready');
    setErrorMsg('');
  }, []);

  const handleError = useCallback(() => {
    setStatus('error');
    setErrorMsg('Preview yüklenemedi');
  }, []);

  const handleRefresh = useCallback(() => {
    setStatus('loading');
    if (iframeRef.current) {
      if (iframeSrc) {
        iframeRef.current.src = iframeSrc;
      } else if (srcdoc) {
        iframeRef.current.srcdoc = srcdoc;
      }
    }
  }, [iframeSrc, srcdoc]);

  // Public method: send message to iframe
  const sendToIframe = useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(message, '*');
  }, []);

  // Expose sendToIframe via ref for parent access
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      (iframe as unknown as Record<string, unknown>).__voltronSend = sendToIframe;
    }
  }, [sendToIframe]);

  // No content and not a direct URL
  if (!iframeSrc && !srcdoc) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={24} className="text-yellow-500 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Bu dosya türü önizlenemez</p>
          <p className="text-[10px] text-slate-600 mt-1">{ext} dosyaları için kod görünümünü kullanın</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative overflow-hidden">
      {/* Loading overlay */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'rgba(6,10,20,0.8)' }}>
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={20} className="text-blue-400 animate-spin" />
            <span className="text-[10px] text-slate-500">Render ediliyor...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'rgba(6,10,20,0.9)' }}>
          <div className="flex flex-col items-center gap-2">
            <AlertTriangle size={20} className="text-red-400" />
            <span className="text-xs text-slate-400">{errorMsg}</span>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 mt-1"
            >
              <RefreshCw size={10} /> Yeniden dene
            </button>
          </div>
        </div>
      )}

      {/* Refresh button */}
      {status === 'ready' && (
        <button
          onClick={handleRefresh}
          className="absolute top-2 right-2 z-10 p-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.06] text-slate-400 hover:text-slate-200 transition-all"
          title="Yenile"
        >
          <RefreshCw size={12} />
        </button>
      )}

      {/* The iframe */}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        srcDoc={!iframeSrc ? srcdoc : undefined}
        onLoad={handleLoad}
        onError={handleError}
        sandbox="allow-scripts allow-same-origin allow-popups"
        className="w-full h-full border-0"
        style={{ background: '#0f172a' }}
        title="Live Preview"
      />
    </div>
  );
});
