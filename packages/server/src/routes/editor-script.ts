/**
 * Voltron Visual Editor — iframe-injected script.
 *
 * UX: Zero toolbar. Everything is mouse-driven:
 *   - Hover: highlight element
 *   - Click: select → property panel appears in parent
 *   - Drag: move element
 *   - Double-click: edit text inline
 *   - Right-click: context menu (mark error, add here, note)
 *   - Resize handles appear on selection
 *
 * All edits accumulate. Parent collects them and sends to AI.
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
    enabled: true
  };

  function uid() { return 've_' + (++S.editIdCounter) + '_' + Math.random().toString(36).slice(2,6); }

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

  /* ═══ OVERLAY UI ═══ */
  var hoverBox, selBox, handleEls = {}, tooltip;
  var HS = 8;
  var HPOS = ['nw','n','ne','e','se','s','sw','w'];

  function init() {
    // Hover highlight
    hoverBox = mk('div', '__ve_hover', 'position:fixed;pointer-events:none;z-index:2147483630;border:1.5px dashed rgba(59,130,246,0.5);display:none;transition:all 0.05s;');

    // Selection box
    selBox = mk('div', '__ve_sel', 'position:fixed;pointer-events:none;z-index:2147483631;border:2px solid #3b82f6;background:rgba(59,130,246,0.05);display:none;');

    // Resize handles
    HPOS.forEach(function(pos) {
      var cursors = {nw:'nwse-resize',n:'ns-resize',ne:'nesw-resize',e:'ew-resize',se:'nwse-resize',s:'ns-resize',sw:'nesw-resize',w:'ew-resize'};
      var h = mk('div', '__ve_h_' + pos, 'position:fixed;z-index:2147483632;width:'+HS+'px;height:'+HS+'px;background:#3b82f6;border:1px solid #fff;border-radius:1px;display:none;pointer-events:auto;cursor:'+cursors[pos]+';');
      h.dataset.ve = '1';
      h.dataset.handle = pos;
      handleEls[pos] = h;
    });

    // Tooltip
    tooltip = mk('div', '__ve_tip', 'position:fixed;z-index:2147483640;pointer-events:none;background:#0f172aee;color:#e2e8f0;font:10px/1.3 ui-monospace,monospace;padding:2px 6px;border-radius:3px;display:none;white-space:nowrap;');

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
    var t = cs.transform;
    S.dragOrigTX = 0; S.dragOrigTY = 0;
    if (t && t !== 'none') {
      var m = t.match(/matrix\\(([^)]+)\\)/);
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
      desc: 'Boyutla: ' + o.w + 'x' + o.h + ' → ' + nw + 'x' + nh,
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
        desc: 'Metin: "' + S.textOriginal.substring(0,30) + '" → "' + newText.substring(0,30) + '"',
        coords: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        from: { text: S.textOriginal }, to: { text: newText }
      });
    }
    S.textEditing = null; S.textOriginal = '';
  }

  /* ═══ COLOR / FONT / EFFECT (from parent) ═══ */
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

  /* ═══ CONTEXT MENU (right-click) ═══ */
  function showContextMenu(x, y) {
    hideContextMenu();
    S.contextX = x; S.contextY = y;
    var menu = mk('div', '__ve_ctx', 'position:fixed;z-index:2147483645;left:'+x+'px;top:'+y+'px;background:#1e293b;border:1px solid #334155;border-radius:6px;padding:4px 0;min-width:160px;box-shadow:0 8px 24px rgba(0,0,0,0.4);pointer-events:auto;');
    menu.dataset.ve = '1';
    var items = [
      { label: '! Hata Isaretle', type: 'error', color: '#ef4444' },
      { label: '+ Buraya Ekle', type: 'add', color: '#22c55e' },
      { label: '# Not Birak', type: 'note', color: '#f59e0b' },
    ];
    items.forEach(function(item) {
      var btn = document.createElement('div');
      btn.style.cssText = 'padding:6px 14px;font:12px/1.3 sans-serif;color:#e2e8f0;cursor:pointer;display:flex;align-items:center;gap:8px;';
      btn.innerHTML = '<span style="color:'+item.color+';font-weight:bold;font-size:14px;">'+item.label.charAt(0)+'</span>' + item.label.substring(2);
      btn.dataset.ve = '1';
      btn.addEventListener('mouseenter', function(){ btn.style.background='#334155'; });
      btn.addEventListener('mouseleave', function(){ btn.style.background=''; });
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        hideContextMenu();
        emit('VOLTRON_ANNOTATION_REQUEST', { type: item.type, x: S.contextX, y: S.contextY, pageX: S.contextX+(window.pageXOffset||0), pageY: S.contextY+(window.pageYOffset||0), nearestElement: S.hovered ? { selector: getSelector(S.hovered), tag: S.hovered.tagName.toLowerCase(), text: (S.hovered.textContent||'').trim().substring(0,80) } : null });
      });
      menu.appendChild(btn);
    });
    S.contextMenu = menu;
  }

  function hideContextMenu() {
    if (S.contextMenu && S.contextMenu.parentElement) S.contextMenu.parentElement.removeChild(S.contextMenu);
    S.contextMenu = null;
  }

  /* ═══ UNDO / CLEAR ═══ */
  function removeEdit(editId) {
    var idx = S.edits.findIndex(function(e){ return e.id === editId; });
    if (idx === -1) return;
    var edit = S.edits[idx];
    if (edit.type==='move' && edit.from) { var mel = document.querySelector(edit.selector); if(mel) mel.style.transform = edit.from.translateX||edit.from.translateY ? 'translate('+edit.from.translateX+'px,'+edit.from.translateY+'px)' : ''; }
    if (edit.type==='resize') { var rel = document.querySelector(edit.selector); if(rel) { rel.style.width=''; rel.style.height=''; rel.style.minWidth=''; rel.style.minHeight=''; } }
    if (edit.type==='recolor' && edit.from) { var cel = document.querySelector(edit.selector); if(cel) cel.style[edit.from.property] = edit.from.value; }
    if (edit.type==='refont') { var fel = document.querySelector(edit.selector); if(fel) { fel.style.fontSize=''; fel.style.fontFamily=''; fel.style.fontWeight=''; } }
    if (edit.type==='retext' && edit.from) { var tel = document.querySelector(edit.selector); if(tel) tel.textContent = edit.from.text; }
    if (edit.type==='effect' && edit.from) { var eel = document.querySelector(edit.selector); if(eel) Object.keys(edit.from).forEach(function(k){ eel.style[k] = edit.from[k]; }); }
    S.edits.splice(idx, 1);
    emit('VOLTRON_EDIT_REMOVED', { editId: editId });
    updateSel();
  }

  function clearAll() {
    S.edits.slice().reverse().forEach(function(e){ removeEdit(e.id); });
    S.annotations.forEach(function(el){ if(el.parentElement) el.parentElement.removeChild(el); });
    S.annotations = []; annCount = 0;
    S.edits = [];
    emit('VOLTRON_EDITS_CLEARED', {});
  }

  /* ═══ EVENT HANDLERS ═══ */
  function onMouseMove(e) {
    if (!S.enabled) return;
    if (isOurs(e.target)) return;

    if (S.dragging) { doDrag(e); return; }
    if (S.resizing) { doResize(e); return; }

    // Hover
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOurs(el)) { hoverBox.style.display = 'none'; tooltip.style.display = 'none'; S.hovered = null; return; }
    S.hovered = el;
    if (el !== S.selected) {
      var r = el.getBoundingClientRect();
      posBox(hoverBox, r);
    } else {
      hoverBox.style.display = 'none';
    }
    // Tooltip
    var rr = el.getBoundingClientRect();
    tooltip.textContent = el.tagName.toLowerCase() + (el.id && !el.id.startsWith('__ve') ? '#'+el.id : '') + ' ' + Math.round(rr.width) + 'x' + Math.round(rr.height);
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(e.clientX + 12, window.innerWidth - 280) + 'px';
    tooltip.style.top = (e.clientY > 40 ? e.clientY - 22 : e.clientY + 16) + 'px';
  }

  function onMouseDown(e) {
    if (!S.enabled) return;
    hideContextMenu();

    // Resize handle
    if (e.target.dataset && e.target.dataset.handle && S.selected) {
      e.preventDefault();
      startResize(e.target.dataset.handle, e);
      return;
    }

    if (isOurs(e.target)) return;
    if (e.button !== 0) return; // left click only for drag

    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOurs(el)) return;

    // Select
    if (el !== S.selected) {
      select(el);
    }
    // Start drag (move)
    if (S.selected) {
      e.preventDefault();
      startDrag(e);
    }
  }

  function onMouseUp(e) {
    if (S.dragging) { endDrag(e); return; }
    if (S.resizing) { endResize(); return; }
  }

  function onClick(e) {
    if (!S.enabled) return;
    if (isOurs(e.target)) return;
    // click is handled by mousedown/mouseup
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
      case 'VOLTRON_SET_TOOL': break; // no-op, tools are automatic now
      case 'VOLTRON_INSPECT_MODE': break; // legacy
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
