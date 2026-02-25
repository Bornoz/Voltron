/**
 * Voltron Visual Editor — iframe-injected script.
 *
 * UX: Zero toolbar. Everything is mouse-driven:
 *   - Hover: highlight element
 *   - Click: select → property panel appears in parent
 *   - Drag: move element
 *   - Double-click: edit text inline
 *   - Right-click: advanced context menu with submenus
 *   - Resize handles appear on selection
 *
 * Features:
 *   - Advanced context menu with submenus (color, font, effects)
 *   - Prompt pin system (numbered, draggable, blue pins)
 *   - Reference image overlay (draggable, resizable, opacity control)
 *   - i18n support (TR/EN via data-voltron-lang)
 *   - All edits accumulate. Parent collects them and sends to AI.
 *
 * IMPORTANT: All JS is ES5-compatible (no arrow functions, no let/const,
 * no template literals, no destructuring). Uses var, function(){}, string concat.
 */
export const EDITOR_SCRIPT = `
<script data-voltron-editor>
(function(){
  "use strict";

  /* ═══ STATE ═══ */
  var S = {
    selected: null,
    edits: [],
    dragging: false,
    dragStartX: 0, dragStartY: 0,
    dragOrigTX: 0, dragOrigTY: 0,
    resizing: false,
    resizeHandle: null,
    resizeOrigRect: null,
    textEditing: null,
    textOriginal: '',
    editIdCounter: 0,
    annotations: [],
    contextMenu: null,
    contextX: 0, contextY: 0,
    hovered: null,
    enabled: true,
    lang: 'tr',
    promptPins: [],
    promptPinCounter: 0,
    showAllPins: false,
    refImage: null,
    refImageEl: null,
    refImageDragging: false,
    refImageResizing: false,
    refImageDragStartX: 0,
    refImageDragStartY: 0,
    refImageOrigLeft: 0,
    refImageOrigTop: 0,
    refImageOrigW: 0,
    refImageOrigH: 0,
    submenuTimer: null,
    activeSubmenu: null,
    activeSubmenuItem: null
  };

  function uid() { return 've_' + (++S.editIdCounter) + '_' + Math.random().toString(36).slice(2,6); }

  /* ═══ i18n ═══ */
  var STRINGS = {
    tr: {
      editText: 'Metni D\\u00FCzenle',
      copySelector: 'Selekt\\u00F6r\\u00FC Kopyala',
      changeColor: 'Renk De\\u011Fi\\u015Ftir...',
      fontSize: 'Font Boyutu...',
      addEffect: 'Efekt Ekle...',
      expandShrink: 'Geni\\u015Flet/Daralt',
      markError: 'Hata \\u0130\\u015Faretle',
      addHere: 'Buraya Ekle',
      leaveNote: 'Not B\\u0131rak',
      addPrompt: 'Prompt Ekle',
      showAllPins: 'T\\u00FCm Pinleri G\\u00F6ster',
      hideAllPins: 'T\\u00FCm Pinleri Gizle',
      addRefImage: 'Referans G\\u00F6rsel Ekle',
      clearAll: 'T\\u00FCm D\\u00FCzenlemeleri Temizle',
      secEdit: 'D\\u00FCzenle',
      secStyle: 'Stil',
      secSize: 'Boyut',
      secMark: '\\u0130\\u015Faretle',
      secPrompt: 'Prompt',
      textColor: 'Yaz\\u0131 Rengi',
      bgColor: 'Arkaplan Rengi',
      borderColor: 'Kenarl\\u0131k Rengi',
      shadowSm: 'K\\u00FC\\u00E7\\u00FCk G\\u00F6lge',
      shadowMd: 'Orta G\\u00F6lge',
      shadowLg: 'B\\u00FCy\\u00FCk G\\u00F6lge',
      shadowXl: '\\u00C7ok B\\u00FCy\\u00FCk G\\u00F6lge',
      shadowInner: '\\u0130\\u00E7 G\\u00F6lge',
      shadowNone: 'G\\u00F6lge Kald\\u0131r',
      enterWidth: 'Geni\\u015Flik (px):',
      enterHeight: 'Y\\u00FCkseklik (px):',
      enterNote: 'Not giriniz:',
      enterPrompt: 'Prompt giriniz:',
      confirmClear: 'T\\u00FCm d\\u00FCzenlemeleri silmek istedi\\u011Finize emin misiniz?'
    },
    en: {
      editText: 'Edit Text',
      copySelector: 'Copy Selector',
      changeColor: 'Change Color...',
      fontSize: 'Font Size...',
      addEffect: 'Add Effect...',
      expandShrink: 'Expand/Shrink',
      markError: 'Mark Error',
      addHere: 'Add Here',
      leaveNote: 'Leave Note',
      addPrompt: 'Add Prompt',
      showAllPins: 'Show All Pins',
      hideAllPins: 'Hide All Pins',
      addRefImage: 'Add Reference Image',
      clearAll: 'Clear All Edits',
      secEdit: 'Edit',
      secStyle: 'Style',
      secSize: 'Size',
      secMark: 'Mark',
      secPrompt: 'Prompt',
      textColor: 'Text Color',
      bgColor: 'Background Color',
      borderColor: 'Border Color',
      shadowSm: 'Small Shadow',
      shadowMd: 'Medium Shadow',
      shadowLg: 'Large Shadow',
      shadowXl: 'Extra Large Shadow',
      shadowInner: 'Inner Shadow',
      shadowNone: 'Remove Shadow',
      enterWidth: 'Width (px):',
      enterHeight: 'Height (px):',
      enterNote: 'Enter note:',
      enterPrompt: 'Enter prompt:',
      confirmClear: 'Are you sure you want to clear all edits?'
    }
  };

  function t(key) {
    var lang = S.lang || 'tr';
    var dict = STRINGS[lang] || STRINGS.tr;
    return dict[key] || key;
  }

  /* ═══ UTILS ═══ */
  function getSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return 'body';
    if (el.id && !el.id.startsWith('__ve')) return '#' + CSS.escape(el.id);
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      var seg = cur.tagName.toLowerCase();
      if (cur.id && !cur.id.startsWith('__ve')) { parts.unshift('#' + CSS.escape(cur.id)); break; }
      if (cur.className && typeof cur.className === 'string') {
        var cls = cur.className.trim().split(/\\s+/).filter(function(c){ return c && !c.startsWith('__ve'); }).slice(0,2);
        if (cls.length) seg += '.' + cls.map(function(c){ return CSS.escape(c); }).join('.');
      }
      var parent = cur.parentElement;
      if (parent) {
        var sibs = Array.from(parent.children).filter(function(s){ return s.tagName === cur.tagName; });
        if (sibs.length > 1) seg += ':nth-child(' + (Array.from(parent.children).indexOf(cur) + 1) + ')';
      }
      parts.unshift(seg);
      cur = parent;
    }
    return parts.join(' > ');
  }

  function isOurs(el) {
    var n = el;
    while (n) { if (n.id && n.id.startsWith('__ve')) return true; if (n.dataset && n.dataset.ve !== undefined) return true; n = n.parentElement; }
    return false;
  }

  function emit(type, payload) { window.parent.postMessage({ type: type, payload: payload || {} }, '*'); }

  function addEdit(edit) { S.edits.push(edit); emit('VOLTRON_EDIT_CREATED', { edit: edit }); }

  function getComp(el) {
    var cs = window.getComputedStyle(el);
    return { color: cs.color, backgroundColor: cs.backgroundColor, borderColor: cs.borderColor, fontSize: cs.fontSize, fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, boxShadow: cs.boxShadow, borderRadius: cs.borderRadius, opacity: cs.opacity };
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  /* ═══ OVERLAY UI ═══ */
  var hoverBox, selBox, handleEls = {}, tooltip;
  var HS = 8;
  var HPOS = ['nw','n','ne','e','se','s','sw','w'];

  function init() {
    hoverBox = mk('div', '__ve_hover', 'position:fixed;pointer-events:none;z-index:2147483630;border:1.5px dashed rgba(59,130,246,0.5);display:none;transition:all 0.05s;');
    selBox = mk('div', '__ve_sel', 'position:fixed;pointer-events:none;z-index:2147483631;border:2px solid #3b82f6;background:rgba(59,130,246,0.05);display:none;');

    HPOS.forEach(function(pos) {
      var cursors = {nw:'nwse-resize',n:'ns-resize',ne:'nesw-resize',e:'ew-resize',se:'nwse-resize',s:'ns-resize',sw:'nesw-resize',w:'ew-resize'};
      var h = mk('div', '__ve_h_' + pos, 'position:fixed;z-index:2147483632;width:'+HS+'px;height:'+HS+'px;background:#3b82f6;border:1px solid #fff;border-radius:1px;display:none;pointer-events:auto;cursor:'+cursors[pos]+';');
      h.dataset.ve = '1';
      h.dataset.handle = pos;
      handleEls[pos] = h;
    });

    tooltip = mk('div', '__ve_tip', 'position:fixed;z-index:2147483640;pointer-events:none;background:#0f172aee;color:#e2e8f0;font:10px/1.3 ui-monospace,monospace;padding:2px 6px;border-radius:3px;display:none;white-space:nowrap;');

    var langAttr = document.documentElement.getAttribute('data-voltron-lang');
    if (langAttr) S.lang = langAttr;

    emit('VOLTRON_INSPECTOR_READY', {});
  }

  function mk(tag, id, css) {
    var el = document.createElement(tag);
    el.id = id;
    el.style.cssText = css;
    document.body.appendChild(el);
    return el;
  }

  function posBox(box, rect) {
    box.style.left = rect.x + 'px'; box.style.top = rect.y + 'px';
    box.style.width = rect.width + 'px'; box.style.height = rect.height + 'px';
    box.style.display = 'block';
  }

  function posHandles(rect) {
    var x = rect.x, y = rect.y, w = rect.width, h = rect.height, hs = HS/2;
    var p = { nw:[x-hs,y-hs], n:[x+w/2-hs,y-hs], ne:[x+w-hs,y-hs], e:[x+w-hs,y+h/2-hs], se:[x+w-hs,y+h-hs], s:[x+w/2-hs,y+h-hs], sw:[x-hs,y+h-hs], w:[x-hs,y+h/2-hs] };
    HPOS.forEach(function(k){ handleEls[k].style.left=p[k][0]+'px'; handleEls[k].style.top=p[k][1]+'px'; handleEls[k].style.display='block'; });
  }

  function hideHandles() { HPOS.forEach(function(k){ handleEls[k].style.display='none'; }); }

  function updateSel() {
    if (!S.selected) { selBox.style.display='none'; hideHandles(); emitSel(null); return; }
    var r = S.selected.getBoundingClientRect();
    posBox(selBox, r);
    posHandles(r);
    emitSel(S.selected);
  }

  function emitSel(el) {
    if (!el) { emit('VOLTRON_SELECTION_CHANGED', null); return; }
    var r = el.getBoundingClientRect();
    var text = (el.textContent||'').trim().substring(0,200);
    var html = el.outerHTML; if (html.length > 600) html = html.substring(0,600) + '...';
    emit('VOLTRON_SELECTION_CHANGED', {
      selector: getSelector(el), tag: el.tagName.toLowerCase(),
      id: el.id || null, classes: Array.from(el.classList||[]).filter(function(c){return !c.startsWith('__ve');}),
      text: text, html: html,
      rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
      computed: getComp(el)
    });
  }

  /* ═══ SELECT ═══ */
  function select(el) {
    if (S.textEditing) finishText();
    S.selected = el;
    updateSel();
  }

  /* ═══ MOVE (drag) ═══ */
  function startDrag(e) {
    if (!S.selected) return;
    S.dragging = true;
    S.dragStartX = e.clientX; S.dragStartY = e.clientY;
    var cs = window.getComputedStyle(S.selected);
    var tf = cs.transform;
    S.dragOrigTX = 0; S.dragOrigTY = 0;
    if (tf && tf !== 'none') {
      var m = tf.match(/matrix\\(([^)]+)\\)/);
      if (m) { var v = m[1].split(','); S.dragOrigTX = parseFloat(v[4])||0; S.dragOrigTY = parseFloat(v[5])||0; }
    }
    document.body.style.cursor = 'grabbing';
  }

  function doDrag(e) {
    var dx = e.clientX - S.dragStartX, dy = e.clientY - S.dragStartY;
    S.selected.style.transform = 'translate(' + (S.dragOrigTX+dx) + 'px,' + (S.dragOrigTY+dy) + 'px)';
    updateSel();
  }

  function endDrag(e) {
    document.body.style.cursor = '';
    S.dragging = false;
    var dx = e.clientX - S.dragStartX, dy = e.clientY - S.dragStartY;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    var r = S.selected.getBoundingClientRect();
    addEdit({
      id: uid(), type: 'move', selector: getSelector(S.selected),
      desc: 'Tasi: (' + Math.round(dx) + ', ' + Math.round(dy) + ')px',
      coords: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      from: { translateX: S.dragOrigTX, translateY: S.dragOrigTY },
      to: { translateX: S.dragOrigTX+dx, translateY: S.dragOrigTY+dy, deltaX: dx, deltaY: dy }
    });
  }

  /* ═══ RESIZE (handles) ═══ */
  function startResize(handle, e) {
    S.resizing = true; S.resizeHandle = handle;
    S.dragStartX = e.clientX; S.dragStartY = e.clientY;
    var r = S.selected.getBoundingClientRect();
    S.resizeOrigRect = { x: r.x, y: r.y, w: r.width, h: r.height };
  }

  function doResize(e) {
    var dx = e.clientX - S.dragStartX, dy = e.clientY - S.dragStartY;
    var o = S.resizeOrigRect, nw = o.w, nh = o.h, h = S.resizeHandle;
    if (h.indexOf('e')!==-1) nw = o.w+dx;
    if (h.indexOf('w')!==-1) nw = o.w-dx;
    if (h.indexOf('s')!==-1) nh = o.h+dy;
    if (h.indexOf('n')!==-1) nh = o.h-dy;
    nw = Math.max(20,nw); nh = Math.max(20,nh);
    S.selected.style.width = nw+'px'; S.selected.style.height = nh+'px';
    S.selected.style.minWidth = nw+'px'; S.selected.style.minHeight = nh+'px';
    updateSel();
  }

  function endResize() {
    S.resizing = false;
    var o = S.resizeOrigRect, r = S.selected.getBoundingClientRect();
    var nw = Math.round(r.width), nh = Math.round(r.height);
    S.resizeHandle = null;
    if (nw===o.w && nh===o.h) return;
    addEdit({
      id: uid(), type: 'resize', selector: getSelector(S.selected),
      desc: 'Boyutla: ' + o.w + 'x' + o.h + ' \\u2192 ' + nw + 'x' + nh,
      coords: { x: Math.round(r.x), y: Math.round(r.y), w: nw, h: nh },
      from: { width: o.w, height: o.h },
      to: { width: nw, height: nh }
    });
  }

  /* ═══ TEXT EDIT (double-click) ═══ */
  function startText(el) {
    if (S.textEditing) finishText();
    S.textEditing = el; S.textOriginal = el.textContent || '';
    el.contentEditable = 'true'; el.focus();
    el.style.outline = '2px dashed #f97316'; el.style.outlineOffset = '2px';
    var range = document.createRange(); range.selectNodeContents(el);
    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  }

  function finishText() {
    if (!S.textEditing) return;
    var el = S.textEditing, newText = el.textContent || '';
    el.contentEditable = 'false'; el.style.outline = ''; el.style.outlineOffset = '';
    if (newText !== S.textOriginal) {
      var r = el.getBoundingClientRect();
      addEdit({
        id: uid(), type: 'retext', selector: getSelector(el),
        desc: 'Metin: "' + S.textOriginal.substring(0,30) + '" \\u2192 "' + newText.substring(0,30) + '"',
        coords: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        from: { text: S.textOriginal }, to: { text: newText }
      });
    }
    S.textEditing = null; S.textOriginal = '';
  }

  /* ═══ COLOR / FONT / EFFECT (from parent or context menu) ═══ */
  function applyColor(color, target) {
    if (!S.selected) return;
    var el = S.selected, cs = window.getComputedStyle(el);
    var prop, oldVal;
    if (target==='bg') { prop='backgroundColor'; oldVal=cs.backgroundColor; el.style.backgroundColor=color; }
    else if (target==='border') { prop='borderColor'; oldVal=cs.borderColor; el.style.borderColor=color; if(!el.style.borderWidth||el.style.borderWidth==='0px'){el.style.borderWidth='1px';el.style.borderStyle='solid';} }
    else { prop='color'; oldVal=cs.color; el.style.color=color; }
    var r = el.getBoundingClientRect();
    addEdit({
      id: uid(), type: 'recolor', selector: getSelector(el),
      desc: target + ': ' + color,
      coords: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      from: { property: prop, value: oldVal },
      to: { property: prop, value: color, target: target }
    });
    updateSel();
  }

  function applyFont(opts) {
    if (!S.selected) return;
    var el = S.selected, cs = window.getComputedStyle(el);
    var from = { fontSize: cs.fontSize, fontFamily: cs.fontFamily, fontWeight: cs.fontWeight };
    if (opts.size) el.style.fontSize = opts.size;
    if (opts.family) el.style.fontFamily = opts.family;
    if (opts.weight) el.style.fontWeight = opts.weight;
    var r = el.getBoundingClientRect();
    addEdit({
      id: uid(), type: 'refont', selector: getSelector(el),
      desc: 'Font: ' + (opts.size||'') + ' ' + (opts.family||''),
      coords: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      from: from,
      to: { fontSize: opts.size||from.fontSize, fontFamily: opts.family||from.fontFamily, fontWeight: opts.weight||from.fontWeight }
    });
  }

  function applyEffect(opts) {
    if (!S.selected) return;
    var el = S.selected, cs = window.getComputedStyle(el), from = {}, to = {};
    if (opts.shadow!==undefined) { from.boxShadow=cs.boxShadow; el.style.boxShadow=opts.shadow; to.boxShadow=opts.shadow; }
    if (opts.borderRadius!==undefined) { from.borderRadius=cs.borderRadius; el.style.borderRadius=opts.borderRadius; to.borderRadius=opts.borderRadius; }
    if (opts.opacity!==undefined) { from.opacity=cs.opacity; el.style.opacity=opts.opacity; to.opacity=opts.opacity; }
    if (opts.background!==undefined) { from.background=el.style.background||cs.background; el.style.background=opts.background; to.background=opts.background; }
    var r = el.getBoundingClientRect();
    addEdit({
      id: uid(), type: 'effect', selector: getSelector(el),
      desc: 'Efekt: ' + Object.keys(to).join(', '),
      coords: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      from: from, to: to
    });
  }

  /* ═══ ANNOTATIONS ═══ */
  var annCount = 0;
  function addAnnotation(x, y, type, note) {
    annCount++;
    var colors = { error:'#ef4444', add:'#22c55e', note:'#f59e0b' };
    var icons = { error:'!', add:'+', note: annCount+'' };
    var pin = mk('div', '__ve_ann_' + annCount, 'position:fixed;z-index:2147483635;left:'+(x-12)+'px;top:'+(y-12)+'px;width:24px;height:24px;border-radius:50%;background:'+(colors[type]||'#f59e0b')+';color:#fff;font:bold 12px/24px sans-serif;text-align:center;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:default;');
    pin.textContent = icons[type] || annCount+'';
    pin.title = note;
    pin.dataset.ve = '1';
    S.annotations.push(pin);
    if (note) {
      var lbl = mk('div', '__ve_annl_' + annCount, 'position:fixed;z-index:2147483636;left:'+(x+16)+'px;top:'+(y-8)+'px;background:#1e293bee;color:#e2e8f0;font:11px/1.3 sans-serif;padding:3px 8px;border-radius:4px;border:1px solid '+(colors[type]||'#f59e0b')+';max-width:200px;word-wrap:break-word;pointer-events:auto;');
      lbl.textContent = note;
      lbl.dataset.ve = '1';
      S.annotations.push(lbl);
    }
    var sx = window.pageXOffset||0, sy = window.pageYOffset||0;
    addEdit({
      id: uid(), type: type==='error'?'mark_error':type==='add'?'add_here':'annotate', selector: 'viewport',
      desc: (type==='error'?'HATA':type==='add'?'EKLE':'NOT') + ': ' + (note||''),
      coords: { x: Math.round(x+sx), y: Math.round(y+sy), w:24, h:24 },
      from: null,
      to: { type:type, note:note||'', viewportX:Math.round(x), viewportY:Math.round(y), pageX:Math.round(x+sx), pageY:Math.round(y+sy) }
    });
  }

  /* ═══ PROMPT PIN SYSTEM ═══ */
  function addPromptPin(x, y) {
    var promptText = prompt(t('enterPrompt'));
    if (!promptText || !promptText.trim()) return;

    S.promptPinCounter++;
    var pinNum = S.promptPinCounter;
    var pinId = '__ve_pin_' + pinNum;
    var lineId = '__ve_pinline_' + pinNum;
    var tooltipId = '__ve_pintip_' + pinNum;

    var nearestEl = findNearestElement(x, y);
    var nearestRect = nearestEl ? nearestEl.getBoundingClientRect() : null;

    /* Connection line (SVG) to nearest element */
    var svgNs = 'http://www.w3.org/2000/svg';
    var svgEl = document.createElementNS(svgNs, 'svg');
    svgEl.id = lineId;
    svgEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483633;pointer-events:none;';
    svgEl.setAttribute('data-ve', '1');
    var lineEl = document.createElementNS(svgNs, 'line');
    lineEl.setAttribute('stroke', '#3b82f6');
    lineEl.setAttribute('stroke-width', '1.5');
    lineEl.setAttribute('stroke-dasharray', '4 3');
    lineEl.setAttribute('stroke-opacity', '0.6');
    if (nearestRect) {
      var cx = nearestRect.x + nearestRect.width/2;
      var cy = nearestRect.y + nearestRect.height/2;
      lineEl.setAttribute('x1', x+'');
      lineEl.setAttribute('y1', y+'');
      lineEl.setAttribute('x2', cx+'');
      lineEl.setAttribute('y2', cy+'');
    }
    svgEl.appendChild(lineEl);
    document.body.appendChild(svgEl);

    /* Pin circle */
    var pin = mk('div', pinId, 'position:fixed;z-index:2147483637;left:'+(x-14)+'px;top:'+(y-14)+'px;width:28px;height:28px;border-radius:50%;background:#3b82f6;color:#fff;font:bold 12px/28px sans-serif;text-align:center;pointer-events:auto;box-shadow:0 2px 10px rgba(59,130,246,0.5);cursor:grab;user-select:none;-webkit-user-select:none;transition:box-shadow 0.15s;');
    pin.textContent = pinNum + '';
    pin.dataset.ve = '1';
    pin.dataset.pinId = pinNum + '';

    /* Tooltip on hover */
    var tipEl = mk('div', tooltipId, 'position:fixed;z-index:2147483641;left:'+(x+18)+'px;top:'+(y-10)+'px;background:#1e293bee;color:#e2e8f0;font:11px/1.3 sans-serif;padding:4px 8px;border-radius:4px;border:1px solid #3b82f6;max-width:220px;word-wrap:break-word;pointer-events:none;display:none;');
    tipEl.textContent = promptText.length > 100 ? promptText.substring(0,100) + '...' : promptText;
    tipEl.dataset.ve = '1';

    pin.addEventListener('mouseenter', function() {
      tipEl.style.display = 'block';
      pin.style.boxShadow = '0 4px 16px rgba(59,130,246,0.7)';
    });
    pin.addEventListener('mouseleave', function() {
      tipEl.style.display = 'none';
      pin.style.boxShadow = '0 2px 10px rgba(59,130,246,0.5)';
    });

    /* Pin click -> notify parent */
    pin.addEventListener('click', function(e) {
      e.stopPropagation();
      emit('VOLTRON_PIN_CLICKED', { pinId: pinNum, prompt: promptText, x: parseInt(pin.style.left)+14, y: parseInt(pin.style.top)+14 });
    });

    /* Pin drag */
    var pinDrag = { active: false, startX: 0, startY: 0, origL: 0, origT: 0 };
    pin.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      pinDrag.active = true;
      pinDrag.startX = e.clientX;
      pinDrag.startY = e.clientY;
      pinDrag.origL = parseInt(pin.style.left);
      pinDrag.origT = parseInt(pin.style.top);
      pin.style.cursor = 'grabbing';
    });

    function onPinDragMove(e) {
      if (!pinDrag.active) return;
      var dx = e.clientX - pinDrag.startX;
      var dy = e.clientY - pinDrag.startY;
      var newL = pinDrag.origL + dx;
      var newT = pinDrag.origT + dy;
      pin.style.left = newL + 'px';
      pin.style.top = newT + 'px';
      tipEl.style.left = (newL + 32) + 'px';
      tipEl.style.top = (newT + 4) + 'px';
      /* Update connection line */
      var pinCX = newL + 14;
      var pinCY = newT + 14;
      lineEl.setAttribute('x1', pinCX + '');
      lineEl.setAttribute('y1', pinCY + '');
    }

    function onPinDragEnd(e) {
      if (!pinDrag.active) return;
      pinDrag.active = false;
      pin.style.cursor = 'grab';
      var newX = parseInt(pin.style.left) + 14;
      var newY = parseInt(pin.style.top) + 14;
      /* Update pinData position */
      for (var i = 0; i < S.promptPins.length; i++) {
        if (S.promptPins[i].num === pinNum) {
          S.promptPins[i].x = newX;
          S.promptPins[i].y = newY;
          break;
        }
      }
      emit('VOLTRON_PIN_MOVED', { pinId: pinNum, x: newX, y: newY });
    }

    document.addEventListener('mousemove', onPinDragMove, true);
    document.addEventListener('mouseup', onPinDragEnd, true);

    var pinData = {
      num: pinNum,
      x: x,
      y: y,
      prompt: promptText,
      pinEl: pin,
      tipEl: tipEl,
      svgEl: svgEl,
      lineEl: lineEl,
      nearestEl: nearestEl,
      dragMoveHandler: onPinDragMove,
      dragEndHandler: onPinDragEnd
    };
    S.promptPins.push(pinData);

    var sx = window.pageXOffset||0, sy = window.pageYOffset||0;
    addEdit({
      id: uid(), type: 'prompt_pin', selector: nearestEl ? getSelector(nearestEl) : 'viewport',
      desc: 'Prompt #' + pinNum + ': ' + promptText.substring(0, 60),
      coords: { x: Math.round(x+sx), y: Math.round(y+sy), w:28, h:28 },
      from: null,
      to: {
        type: 'prompt_pin',
        pinId: pinNum,
        prompt: promptText,
        viewportX: Math.round(x),
        viewportY: Math.round(y),
        pageX: Math.round(x+sx),
        pageY: Math.round(y+sy),
        nearestElement: nearestEl ? getSelector(nearestEl) : null
      }
    });

    emit('VOLTRON_CONTEXT_ACTION', { action: 'prompt_pin_added', pinId: pinNum, prompt: promptText, x: x, y: y });
  }

  function findNearestElement(x, y) {
    var el = document.elementFromPoint(x, y);
    if (el && !isOurs(el) && el !== document.body && el !== document.documentElement) return el;
    /* Scan nearby points in a spiral */
    var offsets = [[-20,0],[20,0],[0,-20],[0,20],[-30,-30],[30,-30],[-30,30],[30,30]];
    for (var i = 0; i < offsets.length; i++) {
      var testEl = document.elementFromPoint(x+offsets[i][0], y+offsets[i][1]);
      if (testEl && !isOurs(testEl) && testEl !== document.body && testEl !== document.documentElement) return testEl;
    }
    return null;
  }

  function toggleAllPins() {
    S.showAllPins = !S.showAllPins;
    for (var i = 0; i < S.promptPins.length; i++) {
      var p = S.promptPins[i];
      var vis = S.showAllPins ? 'block' : 'block'; /* pins always visible; toggle highlights */
      p.pinEl.style.display = vis;
      p.svgEl.style.display = vis;
      if (S.showAllPins) {
        p.tipEl.style.display = 'block';
        p.pinEl.style.boxShadow = '0 4px 16px rgba(59,130,246,0.7)';
      } else {
        p.tipEl.style.display = 'none';
        p.pinEl.style.boxShadow = '0 2px 10px rgba(59,130,246,0.5)';
      }
    }
    emit('VOLTRON_CONTEXT_ACTION', { action: 'toggle_all_pins', visible: S.showAllPins });
  }

  /* ═══ REFERENCE IMAGE OVERLAY ═══ */
  function setReferenceImage(dataUrl) {
    removeReferenceImage();

    var container = mk('div', '__ve_refimg', 'position:fixed;z-index:2147483628;left:20px;top:20px;width:300px;height:auto;border:2px solid #6366f1;border-radius:8px;overflow:hidden;opacity:0.5;pointer-events:auto;cursor:move;box-shadow:0 4px 24px rgba(0,0,0,0.3);');
    container.dataset.ve = '1';

    /* Image */
    var img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = 'width:100%;height:auto;display:block;pointer-events:none;user-select:none;-webkit-user-select:none;';
    img.draggable = false;
    container.appendChild(img);

    /* Control bar */
    var bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;top:0;right:0;display:flex;gap:2px;padding:4px;background:rgba(30,41,59,0.85);border-bottom-left-radius:6px;';
    bar.dataset.ve = '1';

    /* Opacity - */
    var opDown = document.createElement('button');
    opDown.textContent = '\\u2212';
    opDown.title = 'Opacity -';
    opDown.style.cssText = 'width:24px;height:24px;background:#334155;color:#e2e8f0;border:none;border-radius:3px;cursor:pointer;font:bold 14px/24px sans-serif;display:flex;align-items:center;justify-content:center;';
    opDown.dataset.ve = '1';
    opDown.addEventListener('click', function(e) {
      e.stopPropagation();
      var cur = parseFloat(container.style.opacity) || 0.5;
      container.style.opacity = Math.max(0.1, cur - 0.1) + '';
    });
    bar.appendChild(opDown);

    /* Opacity + */
    var opUp = document.createElement('button');
    opUp.textContent = '+';
    opUp.title = 'Opacity +';
    opUp.style.cssText = 'width:24px;height:24px;background:#334155;color:#e2e8f0;border:none;border-radius:3px;cursor:pointer;font:bold 14px/24px sans-serif;display:flex;align-items:center;justify-content:center;';
    opUp.dataset.ve = '1';
    opUp.addEventListener('click', function(e) {
      e.stopPropagation();
      var cur = parseFloat(container.style.opacity) || 0.5;
      container.style.opacity = Math.min(1.0, cur + 0.1) + '';
    });
    bar.appendChild(opUp);

    /* Toggle visibility */
    var toggleBtn = document.createElement('button');
    toggleBtn.textContent = '\\uD83D\\uDC41';
    toggleBtn.title = 'Toggle';
    toggleBtn.style.cssText = 'width:24px;height:24px;background:#334155;color:#e2e8f0;border:none;border-radius:3px;cursor:pointer;font:12px/24px sans-serif;display:flex;align-items:center;justify-content:center;';
    toggleBtn.dataset.ve = '1';
    var imgHidden = false;
    toggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      imgHidden = !imgHidden;
      img.style.display = imgHidden ? 'none' : 'block';
      container.style.background = imgHidden ? '#1e293b' : '';
      container.style.minHeight = imgHidden ? '40px' : '';
    });
    bar.appendChild(toggleBtn);

    /* Close */
    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\\u2715';
    closeBtn.title = 'Close';
    closeBtn.style.cssText = 'width:24px;height:24px;background:#ef4444;color:#fff;border:none;border-radius:3px;cursor:pointer;font:bold 12px/24px sans-serif;display:flex;align-items:center;justify-content:center;';
    closeBtn.dataset.ve = '1';
    closeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      removeReferenceImage();
    });
    bar.appendChild(closeBtn);

    container.appendChild(bar);

    /* Resize handle (bottom-right corner) */
    var resizeGrip = document.createElement('div');
    resizeGrip.style.cssText = 'position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,#6366f1 50%);border-bottom-right-radius:6px;';
    resizeGrip.dataset.ve = '1';
    container.appendChild(resizeGrip);

    /* Dragging the container */
    container.addEventListener('mousedown', function(e) {
      if (e.target === resizeGrip) return;
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      e.stopPropagation();
      S.refImageDragging = true;
      S.refImageDragStartX = e.clientX;
      S.refImageDragStartY = e.clientY;
      S.refImageOrigLeft = parseInt(container.style.left) || 20;
      S.refImageOrigTop = parseInt(container.style.top) || 20;
      container.style.cursor = 'grabbing';
    });

    /* Resizing from grip */
    resizeGrip.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
      S.refImageResizing = true;
      S.refImageDragStartX = e.clientX;
      S.refImageDragStartY = e.clientY;
      S.refImageOrigW = container.offsetWidth;
      S.refImageOrigH = container.offsetHeight;
    });

    S.refImageEl = container;
    S.refImage = { dataUrl: dataUrl };

    emit('VOLTRON_CONTEXT_ACTION', { action: 'reference_image_set' });
  }

  function removeReferenceImage() {
    if (S.refImageEl && S.refImageEl.parentElement) {
      S.refImageEl.parentElement.removeChild(S.refImageEl);
    }
    S.refImageEl = null;
    S.refImage = null;
  }

  function handleRefImageDrag(e) {
    if (S.refImageDragging && S.refImageEl) {
      var dx = e.clientX - S.refImageDragStartX;
      var dy = e.clientY - S.refImageDragStartY;
      S.refImageEl.style.left = (S.refImageOrigLeft + dx) + 'px';
      S.refImageEl.style.top = (S.refImageOrigTop + dy) + 'px';
    }
    if (S.refImageResizing && S.refImageEl) {
      var dx2 = e.clientX - S.refImageDragStartX;
      var dy2 = e.clientY - S.refImageDragStartY;
      var nw = Math.max(100, S.refImageOrigW + dx2);
      S.refImageEl.style.width = nw + 'px';
    }
  }

  function handleRefImageDragEnd() {
    if (S.refImageDragging) {
      S.refImageDragging = false;
      if (S.refImageEl) S.refImageEl.style.cursor = 'move';
    }
    if (S.refImageResizing) {
      S.refImageResizing = false;
    }
  }

  /* ═══ ADVANCED CONTEXT MENU ═══ */
  var COLOR_PALETTE = [
    '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e',
    '#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#a855f7',
    '#d946ef','#ec4899','#f43f5e','#ffffff','#e2e8f0','#94a3b8',
    '#64748b','#334155','#1e293b','#0f172a','#000000','transparent'
  ];

  var FONT_SIZES = ['12px','13px','14px','15px','16px','18px','20px','22px','24px','28px','32px','36px','40px','48px'];

  var SHADOW_PRESETS = [
    { label: 'shadowSm', value: '0 1px 2px rgba(0,0,0,0.05)' },
    { label: 'shadowMd', value: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)' },
    { label: 'shadowLg', value: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)' },
    { label: 'shadowXl', value: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' },
    { label: 'shadowInner', value: 'inset 0 2px 4px rgba(0,0,0,0.15)' },
    { label: 'shadowNone', value: 'none' }
  ];

  function showContextMenu(x, y) {
    hideContextMenu();
    S.contextX = x; S.contextY = y;

    var hasSelection = !!S.selected;
    var items = [];

    if (hasSelection) {
      /* ── Element selected menu ── */
      items.push({ type: 'section', label: 'secEdit' });
      items.push({ emoji: '\\u270F\\uFE0F', label: 'editText', action: 'startText' });
      items.push({ emoji: '\\uD83D\\uDCCB', label: 'copySelector', action: 'copySelector' });
      items.push({ type: 'section', label: 'secStyle' });
      items.push({ emoji: '\\uD83C\\uDFA8', label: 'changeColor', action: 'submenu', submenuType: 'color' });
      items.push({ emoji: '\\uD83D\\uDCCF', label: 'fontSize', action: 'submenu', submenuType: 'fontsize' });
      items.push({ emoji: '\\u2728', label: 'addEffect', action: 'submenu', submenuType: 'effect' });
      items.push({ type: 'section', label: 'secSize' });
      items.push({ emoji: '\\u2194\\uFE0F', label: 'expandShrink', action: 'expandShrink' });
      items.push({ type: 'section', label: 'secMark' });
      items.push({ emoji: '\\u2757', label: 'markError', action: 'annotate', annotationType: 'error' });
      items.push({ emoji: '\\u2795', label: 'addHere', action: 'annotate', annotationType: 'add' });
      items.push({ emoji: '\\uD83D\\uDCDD', label: 'leaveNote', action: 'annotate', annotationType: 'note' });
      items.push({ type: 'section', label: 'secPrompt' });
      items.push({ emoji: '\\uD83D\\uDCAC', label: 'addPrompt', action: 'promptPin' });
      items.push({ emoji: '\\uD83D\\uDCCC', label: S.showAllPins ? 'hideAllPins' : 'showAllPins', action: 'togglePins' });
    } else {
      /* ── No selection menu ── */
      items.push({ emoji: '\\uD83D\\uDCAC', label: 'addPrompt', action: 'promptPin' });
      items.push({ emoji: '\\uD83D\\uDCF7', label: 'addRefImage', action: 'refImage' });
      items.push({ emoji: '\\uD83D\\uDCCC', label: S.showAllPins ? 'hideAllPins' : 'showAllPins', action: 'togglePins' });
      items.push({ type: 'separator' });
      items.push({ emoji: '\\uD83E\\uDDF9', label: 'clearAll', action: 'clearAll', danger: true });
    }

    var menu = buildMenu(items, x, y);
    S.contextMenu = menu;
  }

  function buildMenu(items, x, y) {
    var menu = document.createElement('div');
    menu.id = '__ve_ctx';
    menu.style.cssText = 'position:fixed;z-index:2147483645;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:4px 0;min-width:200px;box-shadow:0 8px 30px rgba(0,0,0,0.5);pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    menu.dataset.ve = '1';

    /* Position: ensure within viewport */
    var menuW = 220;
    var menuH = items.length * 30 + 20; /* rough estimate */
    var posX = x;
    var posY = y;
    if (posX + menuW > window.innerWidth) posX = window.innerWidth - menuW - 8;
    if (posY + menuH > window.innerHeight) posY = Math.max(8, window.innerHeight - menuH - 8);
    if (posX < 8) posX = 8;
    if (posY < 8) posY = 8;
    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';

    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      if (item.type === 'separator') {
        var sep = document.createElement('div');
        sep.style.cssText = 'height:1px;background:#334155;margin:4px 8px;';
        sep.dataset.ve = '1';
        menu.appendChild(sep);
        continue;
      }

      if (item.type === 'section') {
        var sec = document.createElement('div');
        sec.style.cssText = 'padding:4px 14px 2px;font:bold 9px/1.2 sans-serif;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;';
        if (i > 0) {
          var divider = document.createElement('div');
          divider.style.cssText = 'height:1px;background:#334155;margin:4px 8px;';
          divider.dataset.ve = '1';
          menu.appendChild(divider);
        }
        sec.textContent = '\\u2500\\u2500 ' + t(item.label) + ' \\u2500\\u2500';
        sec.dataset.ve = '1';
        menu.appendChild(sec);
        continue;
      }

      var btn = document.createElement('div');
      btn.style.cssText = 'padding:5px 14px;font:12px/1.4 sans-serif;color:' + (item.danger ? '#ef4444' : '#e2e8f0') + ';cursor:pointer;display:flex;align-items:center;gap:8px;position:relative;';
      btn.dataset.ve = '1';
      btn.dataset.action = item.action || '';

      var emojiSpan = document.createElement('span');
      emojiSpan.style.cssText = 'font-size:14px;width:18px;text-align:center;flex-shrink:0;';
      emojiSpan.textContent = item.emoji || '';
      btn.appendChild(emojiSpan);

      var labelSpan = document.createElement('span');
      labelSpan.style.cssText = 'flex:1;';
      labelSpan.textContent = t(item.label);
      btn.appendChild(labelSpan);

      if (item.action === 'submenu') {
        var arrow = document.createElement('span');
        arrow.style.cssText = 'color:#64748b;font-size:10px;margin-left:auto;';
        arrow.textContent = '\\u25B6';
        btn.appendChild(arrow);
      }

      /* Hover effect */
      btn.addEventListener('mouseenter', (function(it, btnEl) {
        return function() {
          btnEl.style.background = '#334155';
          if (it.action === 'submenu') {
            clearSubmenuTimer();
            S.submenuTimer = setTimeout(function() {
              showSubmenu(btnEl, it.submenuType);
            }, 150);
          } else {
            /* Entering a non-submenu item -> close any open submenu after delay */
            clearSubmenuTimer();
            S.submenuTimer = setTimeout(function() {
              hideSubmenu();
            }, 150);
          }
        };
      })(item, btn));

      btn.addEventListener('mouseleave', (function(btnEl) {
        return function() {
          btnEl.style.background = '';
        };
      })(btn));

      /* Click handler */
      btn.addEventListener('click', (function(it) {
        return function(e) {
          e.stopPropagation();
          if (it.action === 'submenu') return; /* submenus open on hover */
          hideContextMenu();
          handleMenuAction(it);
        };
      })(item));

      menu.appendChild(btn);
    }

    document.body.appendChild(menu);
    return menu;
  }

  function handleMenuAction(item) {
    var action = item.action;

    if (action === 'startText') {
      if (S.selected) startText(S.selected);
      emit('VOLTRON_CONTEXT_ACTION', { action: 'edit_text', selector: S.selected ? getSelector(S.selected) : null });
    }
    else if (action === 'copySelector') {
      if (S.selected) {
        var sel = getSelector(S.selected);
        copyToClipboard(sel);
        showToast('Selector: ' + sel);
        emit('VOLTRON_CONTEXT_ACTION', { action: 'copy_selector', selector: sel });
      }
    }
    else if (action === 'expandShrink') {
      if (S.selected) {
        var curR = S.selected.getBoundingClientRect();
        var newW = prompt(t('enterWidth'), Math.round(curR.width) + '');
        if (newW !== null && newW.trim()) {
          var newH = prompt(t('enterHeight'), Math.round(curR.height) + '');
          if (newH !== null && newH.trim()) {
            var oldW = Math.round(curR.width);
            var oldH = Math.round(curR.height);
            var parsedW = parseInt(newW, 10);
            var parsedH = parseInt(newH, 10);
            if (!isNaN(parsedW) && !isNaN(parsedH) && parsedW > 0 && parsedH > 0) {
              S.selected.style.width = parsedW + 'px';
              S.selected.style.height = parsedH + 'px';
              S.selected.style.minWidth = parsedW + 'px';
              S.selected.style.minHeight = parsedH + 'px';
              var r2 = S.selected.getBoundingClientRect();
              addEdit({
                id: uid(), type: 'resize', selector: getSelector(S.selected),
                desc: 'Boyutla: ' + oldW + 'x' + oldH + ' \\u2192 ' + parsedW + 'x' + parsedH,
                coords: { x: Math.round(r2.x), y: Math.round(r2.y), w: parsedW, h: parsedH },
                from: { width: oldW, height: oldH },
                to: { width: parsedW, height: parsedH }
              });
              updateSel();
              emit('VOLTRON_CONTEXT_ACTION', { action: 'expand_shrink', selector: getSelector(S.selected), from: { width: oldW, height: oldH }, to: { width: parsedW, height: parsedH } });
            }
          }
        }
      }
    }
    else if (action === 'annotate') {
      var noteText = prompt(t('enterNote'));
      if (noteText !== null) {
        addAnnotation(S.contextX, S.contextY, item.annotationType, noteText);
        emit('VOLTRON_CONTEXT_ACTION', { action: 'annotate_' + item.annotationType, x: S.contextX, y: S.contextY, note: noteText });
      }
    }
    else if (action === 'promptPin') {
      addPromptPin(S.contextX, S.contextY);
    }
    else if (action === 'togglePins') {
      toggleAllPins();
    }
    else if (action === 'refImage') {
      triggerRefImageUpload();
    }
    else if (action === 'clearAll') {
      if (confirm(t('confirmClear'))) {
        clearAll();
        emit('VOLTRON_CONTEXT_ACTION', { action: 'clear_all' });
      }
    }
  }

  /* ═══ SUBMENUS ═══ */
  function showSubmenu(parentBtn, submenuType) {
    hideSubmenu();

    var parentRect = parentBtn.getBoundingClientRect();
    var sub = document.createElement('div');
    sub.id = '__ve_ctx_sub';
    sub.style.cssText = 'position:fixed;z-index:2147483646;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:4px 0;box-shadow:0 8px 30px rgba(0,0,0,0.5);pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    sub.dataset.ve = '1';

    if (submenuType === 'color') {
      buildColorSubmenu(sub);
    } else if (submenuType === 'fontsize') {
      buildFontSizeSubmenu(sub);
    } else if (submenuType === 'effect') {
      buildEffectSubmenu(sub);
    }

    document.body.appendChild(sub);

    /* Position submenu to the right of parent item */
    var subW = sub.offsetWidth || 200;
    var subH = sub.offsetHeight || 200;
    var subX = parentRect.right + 4;
    var subY = parentRect.top - 4;

    /* Smart positioning: if goes off-screen right, show left */
    if (subX + subW > window.innerWidth - 8) {
      subX = parentRect.left - subW - 4;
    }
    /* If goes off-screen bottom */
    if (subY + subH > window.innerHeight - 8) {
      subY = Math.max(8, window.innerHeight - subH - 8);
    }
    if (subX < 8) subX = 8;
    if (subY < 8) subY = 8;

    sub.style.left = subX + 'px';
    sub.style.top = subY + 'px';

    S.activeSubmenu = sub;
    S.activeSubmenuItem = parentBtn;

    /* Keep submenu open when hovering over it */
    sub.addEventListener('mouseenter', function() {
      clearSubmenuTimer();
    });

    sub.addEventListener('mouseleave', function() {
      clearSubmenuTimer();
      S.submenuTimer = setTimeout(function() {
        hideSubmenu();
      }, 150);
    });
  }

  function buildColorSubmenu(sub) {
    sub.style.minWidth = '180px';

    /* Text Color section */
    var targets = [
      { key: 'text', label: 'textColor', emoji: '\\uD83D\\uDD24' },
      { key: 'bg', label: 'bgColor', emoji: '\\uD83D\\uDDBC' },
      { key: 'border', label: 'borderColor', emoji: '\\u25A1' }
    ];

    for (var ti = 0; ti < targets.length; ti++) {
      var tgt = targets[ti];

      var header = document.createElement('div');
      header.style.cssText = 'padding:4px 12px 2px;font:bold 10px/1.2 sans-serif;color:#94a3b8;';
      header.textContent = tgt.emoji + ' ' + t(tgt.label);
      header.dataset.ve = '1';
      if (ti > 0) {
        var div = document.createElement('div');
        div.style.cssText = 'height:1px;background:#334155;margin:4px 8px;';
        div.dataset.ve = '1';
        sub.appendChild(div);
      }
      sub.appendChild(header);

      var grid = document.createElement('div');
      grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;padding:4px 10px 6px;';
      grid.dataset.ve = '1';

      for (var ci = 0; ci < COLOR_PALETTE.length; ci++) {
        var color = COLOR_PALETTE[ci];
        var swatch = document.createElement('div');
        var bgStyle = color === 'transparent' ? 'background:repeating-conic-gradient(#666 0% 25%, #999 0% 50%) 50% / 8px 8px' : 'background:' + color;
        swatch.style.cssText = 'width:20px;height:20px;border-radius:3px;cursor:pointer;' + bgStyle + ';border:1px solid ' + (color === '#ffffff' || color === '#e2e8f0' || color === 'transparent' ? '#475569' : 'rgba(255,255,255,0.1)') + ';transition:transform 0.1s;';
        swatch.dataset.ve = '1';
        swatch.title = color;
        swatch.addEventListener('mouseenter', function() { this.style.transform = 'scale(1.2)'; });
        swatch.addEventListener('mouseleave', function() { this.style.transform = ''; });
        swatch.addEventListener('click', (function(c, tgtKey) {
          return function(e) {
            e.stopPropagation();
            hideContextMenu();
            applyColor(c, tgtKey);
            emit('VOLTRON_CONTEXT_ACTION', { action: 'change_color', target: tgtKey, color: c });
          };
        })(color, tgt.key));
        grid.appendChild(swatch);
      }
      sub.appendChild(grid);
    }
  }

  function buildFontSizeSubmenu(sub) {
    sub.style.minWidth = '140px';
    sub.style.maxHeight = '320px';
    sub.style.overflowY = 'auto';

    for (var i = 0; i < FONT_SIZES.length; i++) {
      var size = FONT_SIZES[i];
      var numericSize = parseInt(size, 10);
      var item = document.createElement('div');
      item.style.cssText = 'padding:5px 14px;font:' + Math.min(numericSize, 18) + 'px/1.4 sans-serif;color:#e2e8f0;cursor:pointer;display:flex;align-items:center;gap:8px;';
      item.dataset.ve = '1';

      var sizeLabel = document.createElement('span');
      sizeLabel.style.cssText = 'font:12px/1.4 monospace;color:#94a3b8;width:36px;';
      sizeLabel.textContent = size;
      item.appendChild(sizeLabel);

      var preview = document.createElement('span');
      preview.style.cssText = 'font-size:' + Math.min(numericSize, 18) + 'px;';
      preview.textContent = 'Aa';
      item.appendChild(preview);

      item.addEventListener('mouseenter', function() { this.style.background = '#334155'; });
      item.addEventListener('mouseleave', function() { this.style.background = ''; });

      item.addEventListener('click', (function(s) {
        return function(e) {
          e.stopPropagation();
          hideContextMenu();
          applyFont({ size: s });
          emit('VOLTRON_CONTEXT_ACTION', { action: 'change_font_size', size: s });
        };
      })(size));

      sub.appendChild(item);
    }
  }

  function buildEffectSubmenu(sub) {
    sub.style.minWidth = '180px';

    for (var i = 0; i < SHADOW_PRESETS.length; i++) {
      var preset = SHADOW_PRESETS[i];
      var item = document.createElement('div');
      item.style.cssText = 'padding:6px 14px;font:12px/1.4 sans-serif;color:#e2e8f0;cursor:pointer;display:flex;align-items:center;gap:8px;';
      item.dataset.ve = '1';

      /* Shadow preview box */
      var previewBox = document.createElement('div');
      var previewShadow = preset.value === 'none' ? 'none' : preset.value;
      previewBox.style.cssText = 'width:20px;height:20px;background:#475569;border-radius:3px;box-shadow:' + previewShadow + ';flex-shrink:0;';
      item.appendChild(previewBox);

      var label = document.createElement('span');
      label.textContent = t(preset.label);
      item.appendChild(label);

      item.addEventListener('mouseenter', function() { this.style.background = '#334155'; });
      item.addEventListener('mouseleave', function() { this.style.background = ''; });

      item.addEventListener('click', (function(val) {
        return function(e) {
          e.stopPropagation();
          hideContextMenu();
          applyEffect({ shadow: val });
          emit('VOLTRON_CONTEXT_ACTION', { action: 'add_effect', shadow: val });
        };
      })(preset.value));

      sub.appendChild(item);
    }
  }

  function hideSubmenu() {
    if (S.activeSubmenu && S.activeSubmenu.parentElement) {
      S.activeSubmenu.parentElement.removeChild(S.activeSubmenu);
    }
    S.activeSubmenu = null;
    S.activeSubmenuItem = null;
  }

  function clearSubmenuTimer() {
    if (S.submenuTimer) {
      clearTimeout(S.submenuTimer);
      S.submenuTimer = null;
    }
  }

  function hideContextMenu() {
    clearSubmenuTimer();
    hideSubmenu();
    if (S.contextMenu && S.contextMenu.parentElement) S.contextMenu.parentElement.removeChild(S.contextMenu);
    S.contextMenu = null;
  }

  /* ═══ TOAST NOTIFICATION ═══ */
  function showToast(msg) {
    var toast = mk('div', '__ve_toast_' + Date.now(), 'position:fixed;z-index:2147483647;bottom:20px;left:50%;transform:translateX(-50%);background:#1e293bee;color:#e2e8f0;font:12px/1.4 sans-serif;padding:8px 16px;border-radius:6px;border:1px solid #334155;box-shadow:0 4px 12px rgba(0,0,0,0.3);pointer-events:none;transition:opacity 0.3s;');
    toast.textContent = msg;
    toast.dataset.ve = '1';
    setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 300);
    }, 2000);
  }

  /* ═══ REFERENCE IMAGE UPLOAD TRIGGER ═══ */
  function triggerRefImageUpload() {
    emit('VOLTRON_CONTEXT_ACTION', { action: 'request_reference_image' });
    /* Also create a local file input as fallback */
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
    inp.dataset.ve = '1';
    inp.addEventListener('change', function() {
      if (inp.files && inp.files[0]) {
        var reader = new FileReader();
        reader.onload = function(ev) {
          setReferenceImage(ev.target.result);
          emit('VOLTRON_CONTEXT_ACTION', { action: 'reference_image_uploaded', size: inp.files[0].size, name: inp.files[0].name });
        };
        reader.readAsDataURL(inp.files[0]);
      }
      if (inp.parentElement) inp.parentElement.removeChild(inp);
    });
    document.body.appendChild(inp);
    inp.click();
  }

  /* ═══ UNDO / CLEAR ═══ */
  function removeEdit(editId) {
    var idx = -1;
    for (var i = 0; i < S.edits.length; i++) {
      if (S.edits[i].id === editId) { idx = i; break; }
    }
    if (idx === -1) return;
    var edit = S.edits[idx];
    if (edit.type==='move' && edit.from) { var mel = document.querySelector(edit.selector); if(mel) mel.style.transform = edit.from.translateX||edit.from.translateY ? 'translate('+edit.from.translateX+'px,'+edit.from.translateY+'px)' : ''; }
    if (edit.type==='resize') { var rel = document.querySelector(edit.selector); if(rel) { rel.style.width=''; rel.style.height=''; rel.style.minWidth=''; rel.style.minHeight=''; } }
    if (edit.type==='recolor' && edit.from) { var cel = document.querySelector(edit.selector); if(cel) cel.style[edit.from.property] = edit.from.value; }
    if (edit.type==='refont') { var fel = document.querySelector(edit.selector); if(fel) { fel.style.fontSize=''; fel.style.fontFamily=''; fel.style.fontWeight=''; } }
    if (edit.type==='retext' && edit.from) { var tel = document.querySelector(edit.selector); if(tel) tel.textContent = edit.from.text; }
    if (edit.type==='effect' && edit.from) { var eel = document.querySelector(edit.selector); if(eel) { var keys = Object.keys(edit.from); for (var k = 0; k < keys.length; k++) { eel.style[keys[k]] = edit.from[keys[k]]; } } }
    S.edits.splice(idx, 1);
    emit('VOLTRON_EDIT_REMOVED', { editId: editId });
    updateSel();
  }

  function clearAll() {
    var reversedEdits = S.edits.slice().reverse();
    for (var i = 0; i < reversedEdits.length; i++) {
      removeEdit(reversedEdits[i].id);
    }
    /* Remove all annotation pins */
    for (var j = 0; j < S.annotations.length; j++) {
      if (S.annotations[j].parentElement) S.annotations[j].parentElement.removeChild(S.annotations[j]);
    }
    S.annotations = []; annCount = 0;
    /* Remove all prompt pins */
    for (var k = 0; k < S.promptPins.length; k++) {
      var pp = S.promptPins[k];
      if (pp.pinEl && pp.pinEl.parentElement) pp.pinEl.parentElement.removeChild(pp.pinEl);
      if (pp.tipEl && pp.tipEl.parentElement) pp.tipEl.parentElement.removeChild(pp.tipEl);
      if (pp.svgEl && pp.svgEl.parentElement) pp.svgEl.parentElement.removeChild(pp.svgEl);
      document.removeEventListener('mousemove', pp.dragMoveHandler, true);
      document.removeEventListener('mouseup', pp.dragEndHandler, true);
    }
    S.promptPins = []; S.promptPinCounter = 0;
    /* Remove reference image */
    removeReferenceImage();
    S.edits = [];
    emit('VOLTRON_EDITS_CLEARED', {});
  }

  /* ═══ EVENT HANDLERS ═══ */
  function onMouseMove(e) {
    if (!S.enabled) return;

    /* Ref image drag/resize */
    if (S.refImageDragging || S.refImageResizing) {
      handleRefImageDrag(e);
      return;
    }

    if (isOurs(e.target)) return;
    if (S.dragging) { doDrag(e); return; }
    if (S.resizing) { doResize(e); return; }

    /* Hover */
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOurs(el)) { hoverBox.style.display = 'none'; tooltip.style.display = 'none'; S.hovered = null; return; }
    S.hovered = el;
    if (el !== S.selected) {
      var r = el.getBoundingClientRect();
      posBox(hoverBox, r);
    } else {
      hoverBox.style.display = 'none';
    }
    /* Tooltip */
    var rr = el.getBoundingClientRect();
    tooltip.textContent = el.tagName.toLowerCase() + (el.id && !el.id.startsWith('__ve') ? '#'+el.id : '') + ' ' + Math.round(rr.width) + 'x' + Math.round(rr.height);
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(e.clientX + 12, window.innerWidth - 280) + 'px';
    tooltip.style.top = (e.clientY > 40 ? e.clientY - 22 : e.clientY + 16) + 'px';
  }

  function onMouseDown(e) {
    if (!S.enabled) return;
    hideContextMenu();

    /* Resize handle */
    if (e.target.dataset && e.target.dataset.handle && S.selected) {
      e.preventDefault();
      startResize(e.target.dataset.handle, e);
      return;
    }

    if (isOurs(e.target)) return;
    if (e.button !== 0) return;

    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOurs(el)) return;

    if (el !== S.selected) {
      select(el);
    }
    if (S.selected) {
      e.preventDefault();
      startDrag(e);
    }
  }

  function onMouseUp(e) {
    /* Ref image drag end */
    if (S.refImageDragging || S.refImageResizing) {
      handleRefImageDragEnd();
      return;
    }
    if (S.dragging) { endDrag(e); return; }
    if (S.resizing) { endResize(); return; }
  }

  function onClick(e) {
    if (!S.enabled) return;
    if (isOurs(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function onDblClick(e) {
    if (!S.enabled) return;
    if (isOurs(e.target)) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOurs(el)) return;
    e.preventDefault();
    e.stopPropagation();
    select(el);
    startText(el);
  }

  function onContextMenu(e) {
    if (!S.enabled) return;
    if (isOurs(e.target)) return;
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (S.textEditing) { finishText(); return; }
      hideContextMenu();
      select(null);
    }
    if (e.key === 'Enter' && S.textEditing && !e.shiftKey) { e.preventDefault(); finishText(); }
    /* Delete selected element annotation */
    if (e.key === 'Delete' && S.selected && !S.textEditing) {
      /* no-op: we don't delete actual elements, only edits */
    }
  }

  /* ═══ MESSAGES FROM PARENT ═══ */
  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data.type !== 'string') return;
    var d = e.data;
    switch(d.type) {
      case 'VOLTRON_SET_COLOR': applyColor(d.color, d.target||'text'); break;
      case 'VOLTRON_SET_FONT': applyFont(d); break;
      case 'VOLTRON_APPLY_EFFECT': applyEffect(d); break;
      case 'VOLTRON_REMOVE_EDIT': removeEdit(d.editId); break;
      case 'VOLTRON_CLEAR_EDITS': clearAll(); break;
      case 'VOLTRON_ADD_ANNOTATION': addAnnotation(d.x, d.y, d.annotationType||'note', d.note||''); break;
      case 'VOLTRON_SET_REFERENCE_IMAGE':
        if (d.dataUrl) { setReferenceImage(d.dataUrl); }
        else { removeReferenceImage(); }
        break;
      case 'VOLTRON_SET_LANG':
        if (d.lang && STRINGS[d.lang]) {
          S.lang = d.lang;
          document.documentElement.setAttribute('data-voltron-lang', d.lang);
        }
        break;
      case 'VOLTRON_ADD_PROMPT_PIN':
        if (d.pinId && d.prompt != null) {
          /* Create a pin from parent request */
          var px = d.x || 0, py = d.y || 0;
          var nearEl = findNearestElement(px, py);
          var pinNum = S.promptPins.length + 1;

          var pinEl = mk('div', '', 'position:fixed;z-index:2147483639;width:28px;height:28px;border-radius:50%;background:#3b82f6;color:#fff;font:bold 12px/28px sans-serif;text-align:center;cursor:grab;box-shadow:0 2px 10px rgba(59,130,246,0.5);pointer-events:auto;user-select:none;transition:box-shadow 0.2s;');
          pinEl.textContent = String(pinNum);
          pinEl.dataset.ve = '1';
          pinEl.style.left = (px - 14) + 'px';
          pinEl.style.top = (py - 14) + 'px';
          document.body.appendChild(pinEl);

          var svgNS = 'http://www.w3.org/2000/svg';
          var svgEl = document.createElementNS(svgNS, 'svg');
          svgEl.setAttribute('style', 'position:fixed;z-index:2147483638;left:0;top:0;width:100%;height:100%;pointer-events:none;');
          svgEl.dataset.ve = '1';
          var line = document.createElementNS(svgNS, 'line');
          line.setAttribute('stroke', '#3b82f6');
          line.setAttribute('stroke-width', '1');
          line.setAttribute('stroke-dasharray', '4,4');
          line.setAttribute('opacity', '0.5');
          svgEl.appendChild(line);
          document.body.appendChild(svgEl);

          var tipEl = mk('div', '', 'position:fixed;z-index:2147483640;display:none;max-width:220px;padding:6px 10px;background:#0f172a;color:#e2e8f0;font:11px/1.4 sans-serif;border-radius:6px;border:1px solid #334155;box-shadow:0 4px 12px rgba(0,0,0,0.3);pointer-events:none;word-wrap:break-word;');
          tipEl.textContent = d.prompt.length > 120 ? d.prompt.substring(0, 120) + '...' : d.prompt;
          tipEl.dataset.ve = '1';
          document.body.appendChild(tipEl);

          var pinData = { num: pinNum, parentId: d.pinId, pinEl: pinEl, svgEl: svgEl, line: line, tipEl: tipEl, x: px, y: py, prompt: d.prompt, nearestEl: nearEl };
          S.promptPins.push(pinData);
          /* Hover/click/drag for parent-created pins */
          pinEl.addEventListener('mouseenter', function() { tipEl.style.display = 'block'; tipEl.style.left = (parseInt(pinEl.style.left) + 32) + 'px'; tipEl.style.top = (parseInt(pinEl.style.top) + 4) + 'px'; pinEl.style.boxShadow = '0 4px 16px rgba(59,130,246,0.7)'; });
          pinEl.addEventListener('mouseleave', function() { tipEl.style.display = 'none'; pinEl.style.boxShadow = '0 2px 10px rgba(59,130,246,0.5)'; });
          pinEl.addEventListener('click', function(ev) { ev.stopPropagation(); emit('VOLTRON_PIN_CLICKED', { pinId: d.pinId, prompt: d.prompt, x: parseInt(pinEl.style.left)+14, y: parseInt(pinEl.style.top)+14 }); });
          /* Drag for parent-created pins */
          var ppDrag = { active: false, sx: 0, sy: 0, oL: 0, oT: 0 };
          pinEl.addEventListener('mousedown', function(ev) { if (ev.button !== 0) return; ev.preventDefault(); ev.stopPropagation(); ppDrag.active = true; ppDrag.sx = ev.clientX; ppDrag.sy = ev.clientY; ppDrag.oL = parseInt(pinEl.style.left); ppDrag.oT = parseInt(pinEl.style.top); pinEl.style.cursor = 'grabbing'; });
          document.addEventListener('mousemove', function(ev) { if (!ppDrag.active) return; var nL = ppDrag.oL + (ev.clientX - ppDrag.sx); var nT = ppDrag.oT + (ev.clientY - ppDrag.sy); pinEl.style.left = nL+'px'; pinEl.style.top = nT+'px'; tipEl.style.left = (nL+32)+'px'; tipEl.style.top = (nT+4)+'px'; line.setAttribute('x1', (nL+14)+''); line.setAttribute('y1', (nT+14)+''); }, true);
          document.addEventListener('mouseup', function() { if (!ppDrag.active) return; ppDrag.active = false; pinEl.style.cursor = 'grab'; emit('VOLTRON_PIN_MOVED', { pinId: d.pinId, x: parseInt(pinEl.style.left)+14, y: parseInt(pinEl.style.top)+14 }); }, true);
          /* Update SVG line to nearest element */
          if (nearEl) {
            var nrect = nearEl.getBoundingClientRect();
            var ncx = nrect.x + nrect.width/2;
            var ncy = nrect.y + nrect.height/2;
            line.setAttribute('x1', px + '');
            line.setAttribute('y1', py + '');
            line.setAttribute('x2', ncx + '');
            line.setAttribute('y2', ncy + '');
          }
        }
        break;
      case 'VOLTRON_REMOVE_PROMPT_PIN':
        if (d.pinId) {
          for (var rpi = 0; rpi < S.promptPins.length; rpi++) {
            if (S.promptPins[rpi].num === d.pinId || String(S.promptPins[rpi].num) === String(d.pinId)) {
              var rp = S.promptPins[rpi];
              if (rp.pinEl.parentElement) rp.pinEl.parentElement.removeChild(rp.pinEl);
              if (rp.svgEl.parentElement) rp.svgEl.parentElement.removeChild(rp.svgEl);
              if (rp.tipEl.parentElement) rp.tipEl.parentElement.removeChild(rp.tipEl);
              S.promptPins.splice(rpi, 1);
              break;
            }
          }
        }
        break;
      case 'VOLTRON_SET_TOOL': break;
      case 'VOLTRON_INSPECT_MODE': break;
    }
  });

  /* ═══ INIT ═══ */
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('dblclick', onDblClick, true);
  document.addEventListener('contextmenu', onContextMenu, true);
  document.addEventListener('keydown', onKeyDown, true);
})();
</script>`;
