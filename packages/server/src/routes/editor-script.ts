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
    activeSubmenuItem: null,
    subSubmenuTimer: null,
    activeSubSubmenu: null,
    activeSubSubmenuItem: null
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
      shadow2xl: 'Dev G\\u00F6lge',
      shadowInner: '\\u0130\\u00E7 G\\u00F6lge',
      shadowGlow: 'Mavi Parlama',
      shadowNeon: 'Neon Ye\\u015Fil',
      shadowNone: 'G\\u00F6lge Kald\\u0131r',
      secShadows: 'G\\u00F6lgeler',
      secFilters: 'CSS Filtreler',
      secTextShadow: 'Metin G\\u00F6lgesi',
      filterBlurSm: 'Hafif Bulan\\u0131k',
      filterBlurMd: 'Orta Bulan\\u0131k',
      filterBlurLg: '\\u00C7ok Bulan\\u0131k',
      filterBright: 'Parlak',
      filterDim: 'Karanl\\u0131k',
      filterContrast: 'Y\\u00FCksek Kontrast',
      filterSaturate: 'Canl\\u0131 Renkler',
      filterDesaturate: 'Soluk Renkler',
      filterGrayscale: 'Siyah-Beyaz',
      filterSepia: 'Sepia',
      filterHueRotate: 'Renk D\\u00F6nd\\u00FCr',
      filterInvert: 'Ters \\u00C7evir',
      filterNone: 'Filtre Kald\\u0131r',
      txtShadowSm: 'K\\u00FC\\u00E7\\u00FCk Metin G\\u00F6lgesi',
      txtShadowMd: 'Orta Metin G\\u00F6lgesi',
      txtShadowLg: 'B\\u00FCy\\u00FCk Metin G\\u00F6lgesi',
      txtGlowBlue: 'Mavi I\\u015F\\u0131lt\\u0131',
      txtGlowGreen: 'Ye\\u015Fil I\\u015F\\u0131lt\\u0131',
      txtGlowPurple: 'Mor I\\u015F\\u0131lt\\u0131',
      txtOutline: 'Metin D\\u0131\\u015F \\u00C7izgi',
      txtShadowNone: 'Metin G\\u00F6lgesi Kald\\u0131r',
      enterWidth: 'Geni\\u015Flik (px):',
      enterHeight: 'Y\\u00FCkseklik (px):',
      enterNote: 'Not giriniz:',
      enterPrompt: 'Prompt giriniz:',
      confirmClear: 'T\\u00FCm d\\u00FCzenlemeleri silmek istedi\\u011Finize emin misiniz?',
      padding: 'Padding...',
      margin: 'Margin...',
      border: 'Kenarl\\u0131k...',
      borderRadius: 'K\\u00F6\\u015Fe Yuvarlama...',
      opacity: 'Saydaml\\u0131k...',
      gradient: 'Gradient...',
      display: 'Display...',
      flexDirection: 'Flex Y\\u00F6n\\u00FC...',
      justifyContent: 'Justify Content...',
      alignItems: 'Align Items...',
      gap: 'Gap...',
      deleteElement: 'Elementi Sil',
      duplicateElement: 'Elementi \\u00C7o\\u011Falt',
      wrapInDiv: 'Div ile Sar',
      unwrapElement: 'Sar\\u0131ms\\u0131\\u011F\\u0131 \\u00C7\\u0131kar',
      toggleVisibility: 'G\\u00F6r\\u00FCn\\u00FCrl\\u00FC\\u011F\\u00FC De\\u011Fi\\u015Ftir',
      copyHtml: 'HTML Kopyala',
      copyStyles: 'Stilleri Kopyala',
      showComputed: 'Computed G\\u00F6ster',
      secLayout: 'Yerle\\u015Fim',
      secElement: 'Element',
      secInspector: '\\u0130nceleme',
      secTransition: 'Ge\\u00E7i\\u015Fler',
      transition: 'Transition D\\u00FCzenle...',
      animation: 'Animasyon D\\u00FCzenle...',
      transNone: 'Ge\\u00E7i\\u015F Kald\\u0131r',
      transCustom: '\\u00D6zel Transition...',
      animNone: 'Animasyonu Kald\\u0131r',
      animCustom: '\\u00D6zel Animasyon...',
      enterTransition: 'Transition de\\u011Feri (\\u00F6r: all 0.3s ease):',
      enterAnimation: 'Animasyon de\\u011Feri (\\u00F6r: bounce 1s infinite):',
      saveAndNotify: 'Kaydet & AI\\'ye G\\u00F6nder',
      editCount: ' d\\u00FCzenleme'
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
      shadow2xl: 'Huge Shadow',
      shadowInner: 'Inner Shadow',
      shadowGlow: 'Blue Glow',
      shadowNeon: 'Neon Green',
      shadowNone: 'Remove Shadow',
      secShadows: 'Shadows',
      secFilters: 'CSS Filters',
      secTextShadow: 'Text Shadow',
      filterBlurSm: 'Slight Blur',
      filterBlurMd: 'Medium Blur',
      filterBlurLg: 'Heavy Blur',
      filterBright: 'Brighten',
      filterDim: 'Dim',
      filterContrast: 'High Contrast',
      filterSaturate: 'Vivid Colors',
      filterDesaturate: 'Muted Colors',
      filterGrayscale: 'Grayscale',
      filterSepia: 'Sepia',
      filterHueRotate: 'Hue Rotate',
      filterInvert: 'Invert',
      filterNone: 'Remove Filter',
      txtShadowSm: 'Small Text Shadow',
      txtShadowMd: 'Medium Text Shadow',
      txtShadowLg: 'Large Text Shadow',
      txtGlowBlue: 'Blue Glow',
      txtGlowGreen: 'Green Glow',
      txtGlowPurple: 'Purple Glow',
      txtOutline: 'Text Outline',
      txtShadowNone: 'Remove Text Shadow',
      enterWidth: 'Width (px):',
      enterHeight: 'Height (px):',
      enterNote: 'Enter note:',
      enterPrompt: 'Enter prompt:',
      confirmClear: 'Are you sure you want to clear all edits?',
      padding: 'Padding...',
      margin: 'Margin...',
      border: 'Border...',
      borderRadius: 'Border Radius...',
      opacity: 'Opacity...',
      gradient: 'Gradient...',
      display: 'Display...',
      flexDirection: 'Flex Direction...',
      justifyContent: 'Justify Content...',
      alignItems: 'Align Items...',
      gap: 'Gap...',
      deleteElement: 'Delete Element',
      duplicateElement: 'Duplicate Element',
      wrapInDiv: 'Wrap in Div',
      unwrapElement: 'Unwrap Element',
      toggleVisibility: 'Toggle Visibility',
      copyHtml: 'Copy HTML',
      copyStyles: 'Copy Styles',
      showComputed: 'Show Computed',
      secLayout: 'Layout',
      secElement: 'Element',
      secInspector: 'Inspector',
      secTransition: 'Transitions',
      transition: 'Edit Transition...',
      animation: 'Edit Animation...',
      transNone: 'Remove Transition',
      transCustom: 'Custom Transition...',
      animNone: 'Remove Animation',
      animCustom: 'Custom Animation...',
      enterTransition: 'Transition value (e.g. all 0.3s ease):',
      enterAnimation: 'Animation value (e.g. bounce 1s infinite):',
      saveAndNotify: 'Save & Notify AI',
      editCount: ' edits'
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
    return { color: cs.color, colorHex: rgbToHex(cs.color), backgroundColor: cs.backgroundColor, backgroundColorHex: rgbToHex(cs.backgroundColor), borderColor: cs.borderColor, borderColorHex: rgbToHex(cs.borderColor), fontSize: cs.fontSize, fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, boxShadow: cs.boxShadow, borderRadius: cs.borderRadius, opacity: cs.opacity, display: cs.display, position: cs.position, padding: cs.padding, margin: cs.margin };
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

  /* ═══ PRECISION HELPERS ═══ */
  function px(val) { return Math.round(val * 100) / 100; }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent') return 'transparent';
    var m = rgb.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
    if (!m) return rgb;
    var r = parseInt(m[1],10), g = parseInt(m[2],10), b = parseInt(m[3],10);
    return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }

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

    /* ═══ INJECT ANIMATION KEYFRAMES ═══ */
    var styleSheet = document.createElement('style');
    styleSheet.dataset.ve = '1';
    styleSheet.textContent = [
      '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }',
      '@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }',
      '@keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }',
      '@keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }',
      '@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }',
      '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }',
      '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
      '@keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }',
      '@keyframes wiggle { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }',
      '@keyframes glowPulse { 0%, 100% { box-shadow: 0 0 8px rgba(59,130,246,0.4); } 50% { box-shadow: 0 0 20px rgba(59,130,246,0.8), 0 0 40px rgba(59,130,246,0.3); } }',
    ].join('\\n');
    document.head.appendChild(styleSheet);

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
      rect: { x: px(r.x), y: px(r.y), width: px(r.width), height: px(r.height) },
      boundingBox: { top: px(r.top), right: px(r.right), bottom: px(r.bottom), left: px(r.left) },
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
      desc: 'Tasi: (' + px(dx) + ', ' + px(dy) + ')px',
      coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) },
      from: { translateX: S.dragOrigTX, translateY: S.dragOrigTY },
      to: { translateX: S.dragOrigTX+dx, translateY: S.dragOrigTY+dy, deltaX: px(dx), deltaY: px(dy) }
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
    S.refImageDragging = false;
    S.refImageResizing = false;
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
    { label: 'shadow2xl', value: '0 25px 50px -12px rgba(0,0,0,0.25)' },
    { label: 'shadowInner', value: 'inset 0 2px 4px rgba(0,0,0,0.15)' },
    { label: 'shadowGlow', value: '0 0 15px rgba(59,130,246,0.5), 0 0 30px rgba(59,130,246,0.2)' },
    { label: 'shadowNeon', value: '0 0 5px #22c55e, 0 0 20px #22c55e, 0 0 40px rgba(34,197,94,0.3)' },
    { label: 'shadowNone', value: 'none' }
  ];

  var FILTER_PRESETS = [
    { label: 'filterBlurSm', prop: 'filter', value: 'blur(2px)' },
    { label: 'filterBlurMd', prop: 'filter', value: 'blur(4px)' },
    { label: 'filterBlurLg', prop: 'filter', value: 'blur(8px)' },
    { label: 'filterBright', prop: 'filter', value: 'brightness(1.25)' },
    { label: 'filterDim', prop: 'filter', value: 'brightness(0.7)' },
    { label: 'filterContrast', prop: 'filter', value: 'contrast(1.5)' },
    { label: 'filterSaturate', prop: 'filter', value: 'saturate(1.5)' },
    { label: 'filterDesaturate', prop: 'filter', value: 'saturate(0.3)' },
    { label: 'filterGrayscale', prop: 'filter', value: 'grayscale(1)' },
    { label: 'filterSepia', prop: 'filter', value: 'sepia(0.8)' },
    { label: 'filterHueRotate', prop: 'filter', value: 'hue-rotate(90deg)' },
    { label: 'filterInvert', prop: 'filter', value: 'invert(1)' },
    { label: 'filterNone', prop: 'filter', value: 'none' }
  ];

  var TEXT_SHADOW_PRESETS = [
    { label: 'txtShadowSm', value: '1px 1px 2px rgba(0,0,0,0.3)' },
    { label: 'txtShadowMd', value: '2px 2px 4px rgba(0,0,0,0.4)' },
    { label: 'txtShadowLg', value: '3px 3px 6px rgba(0,0,0,0.5)' },
    { label: 'txtGlowBlue', value: '0 0 10px rgba(59,130,246,0.6), 0 0 20px rgba(59,130,246,0.3)' },
    { label: 'txtGlowGreen', value: '0 0 10px rgba(34,197,94,0.6), 0 0 20px rgba(34,197,94,0.3)' },
    { label: 'txtGlowPurple', value: '0 0 10px rgba(168,85,247,0.6), 0 0 20px rgba(168,85,247,0.3)' },
    { label: 'txtOutline', value: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' },
    { label: 'txtShadowNone', value: 'none' }
  ];

  function showContextMenu(x, y) {
    hideContextMenu();
    S.contextX = x; S.contextY = y;

    var hasSelection = !!S.selected;
    var items = [];

    if (hasSelection) {
      /* ── Direct edit actions ── */
      items.push({ emoji: '\\u270F\\uFE0F', label: 'editText', action: 'startText' });
      items.push({ emoji: '\\uD83D\\uDCCB', label: 'copySelector', action: 'copySelector' });
      items.push({ type: 'separator' });

      /* ── Category submenus (grouped) ── */
      items.push({ emoji: '\\uD83C\\uDFA8', label: 'secStyle', action: 'submenu', submenuType: 'catStyle' });
      items.push({ emoji: '\\uD83D\\uDCD0', label: 'secLayout', action: 'submenu', submenuType: 'catLayout' });
      items.push({ emoji: '\\uD83D\\uDCE6', label: 'secElement', action: 'submenu', submenuType: 'catElement' });
      items.push({ emoji: '\\uD83D\\uDD0D', label: 'secInspector', action: 'submenu', submenuType: 'catInspector' });

      /* Conditional transition category */
      if (S.selected) {
        var elCs = window.getComputedStyle(S.selected);
        var hasTrans = elCs.transition && elCs.transition !== 'none' && elCs.transition !== 'all 0s ease 0s';
        var hasAnim = elCs.animationName && elCs.animationName !== 'none';
        if (hasTrans || hasAnim) {
          items.push({ emoji: '\\u23F1', label: 'secTransition', action: 'submenu', submenuType: 'catTransition' });
        }
      }

      items.push({ type: 'separator' });

      /* ── Mark / Annotate ── */
      items.push({ emoji: '\\u2757', label: 'markError', action: 'annotate', annotationType: 'error' });
      items.push({ emoji: '\\u2795', label: 'addHere', action: 'annotate', annotationType: 'add' });
      items.push({ emoji: '\\uD83D\\uDCDD', label: 'leaveNote', action: 'annotate', annotationType: 'note' });
      items.push({ type: 'separator' });

      /* ── Prompt / Pin ── */
      items.push({ emoji: '\\uD83D\\uDCAC', label: 'addPrompt', action: 'promptPin' });
      items.push({ emoji: '\\uD83D\\uDCCC', label: S.showAllPins ? 'hideAllPins' : 'showAllPins', action: 'togglePins' });

      /* ── Save & Notify AI ── */
      if (S.edits.length > 0) {
        items.push({ type: 'separator' });
        items.push({ emoji: '\\uD83D\\uDCBE', label: 'saveAndNotify', action: 'saveAndNotify', highlight: true, badge: S.edits.length });
      }
    } else {
      /* ── No selection menu ── */
      items.push({ emoji: '\\uD83D\\uDCAC', label: 'addPrompt', action: 'promptPin' });
      items.push({ emoji: '\\uD83D\\uDCF7', label: 'addRefImage', action: 'refImage' });
      items.push({ emoji: '\\uD83D\\uDCCC', label: S.showAllPins ? 'hideAllPins' : 'showAllPins', action: 'togglePins' });
      items.push({ type: 'separator' });
      items.push({ emoji: '\\uD83E\\uDDF9', label: 'clearAll', action: 'clearAll', danger: true });

      /* ── Save & Notify AI (also in no-selection) ── */
      if (S.edits.length > 0) {
        items.push({ type: 'separator' });
        items.push({ emoji: '\\uD83D\\uDCBE', label: 'saveAndNotify', action: 'saveAndNotify', highlight: true, badge: S.edits.length });
      }
    }

    var menu = buildMenu(items, x, y);
    S.contextMenu = menu;
  }

  function buildMenu(items, x, y) {
    var menu = document.createElement('div');
    menu.id = '__ve_ctx';
    menu.style.cssText = 'position:fixed;z-index:2147483645;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(51,65,85,0.8);border-radius:10px;padding:4px 0;min-width:210px;max-height:calc(100vh - 24px);overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(148,163,184,0.05);pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;scrollbar-width:thin;scrollbar-color:#334155 transparent;';
    menu.dataset.ve = '1';

    /* Position: ensure within viewport */
    var menuW = 230;
    var menuH = items.length * 30 + 20;
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
        sep.style.cssText = 'height:1px;background:rgba(51,65,85,0.6);margin:3px 10px;';
        sep.dataset.ve = '1';
        menu.appendChild(sep);
        continue;
      }

      if (item.type === 'section') {
        var sec = document.createElement('div');
        sec.style.cssText = 'padding:4px 14px 2px;font:bold 9px/1.2 sans-serif;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;';
        if (i > 0) {
          var divider = document.createElement('div');
          divider.style.cssText = 'height:1px;background:rgba(51,65,85,0.6);margin:3px 10px;';
          divider.dataset.ve = '1';
          menu.appendChild(divider);
        }
        sec.textContent = t(item.label);
        sec.dataset.ve = '1';
        menu.appendChild(sec);
        continue;
      }

      var btn = document.createElement('div');
      var btnBg = item.highlight ? 'background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(139,92,246,0.15));' : '';
      var btnColor = item.danger ? '#ef4444' : item.highlight ? '#60a5fa' : '#e2e8f0';
      btn.style.cssText = 'padding:4px 12px;font:12px/1.4 sans-serif;color:' + btnColor + ';cursor:pointer;display:flex;align-items:center;gap:7px;position:relative;border-radius:4px;margin:0 4px;transition:background 0.1s;' + btnBg;
      btn.dataset.ve = '1';
      btn.dataset.action = item.action || '';

      var emojiSpan = document.createElement('span');
      emojiSpan.style.cssText = 'font-size:13px;width:18px;text-align:center;flex-shrink:0;';
      emojiSpan.textContent = item.emoji || '';
      btn.appendChild(emojiSpan);

      var labelSpan = document.createElement('span');
      labelSpan.style.cssText = 'flex:1;white-space:nowrap;';
      labelSpan.textContent = t(item.label);
      btn.appendChild(labelSpan);

      /* Badge for edit count */
      if (item.badge) {
        var badgeSpan = document.createElement('span');
        badgeSpan.style.cssText = 'background:#3b82f6;color:#fff;font:bold 10px/1 sans-serif;padding:2px 6px;border-radius:9px;min-width:16px;text-align:center;';
        badgeSpan.textContent = item.badge;
        btn.appendChild(badgeSpan);
      }

      if (item.action === 'submenu') {
        var arrow = document.createElement('span');
        arrow.style.cssText = 'color:#64748b;font-size:9px;margin-left:auto;';
        arrow.textContent = '\\u25B6';
        btn.appendChild(arrow);
      }

      /* Hover effect */
      btn.addEventListener('mouseenter', (function(it, btnEl) {
        return function() {
          btnEl.style.background = it.highlight ? 'linear-gradient(135deg,rgba(59,130,246,0.3),rgba(139,92,246,0.3))' : 'rgba(51,65,85,0.5)';
          if (it.action === 'submenu') {
            clearSubmenuTimer();
            S.submenuTimer = setTimeout(function() {
              showSubmenu(btnEl, it.submenuType);
            }, 150);
          } else {
            clearSubmenuTimer();
          }
        };
      })(item, btn));

      btn.addEventListener('mouseleave', (function(it, btnEl) {
        return function() {
          btnEl.style.background = it.highlight ? 'linear-gradient(135deg,rgba(59,130,246,0.15),rgba(139,92,246,0.15))' : '';
        };
      })(item, btn));

      /* Click handler */
      btn.addEventListener('click', (function(it) {
        return function(e) {
          e.stopPropagation();
          if (it.action === 'submenu') return;
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
    else if (action === 'deleteElement') {
      if (S.selected && S.selected.parentElement) {
        var delEl = S.selected;
        var delSelector = getSelector(delEl);
        var delHtml = delEl.outerHTML.substring(0, 300);
        var r = delEl.getBoundingClientRect();
        delEl.parentElement.removeChild(delEl);
        addEdit({ id: uid(), type: 'delete_element', selector: delSelector, desc: 'Sil: ' + delSelector, coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }, from: { html: delHtml }, to: null });
        select(null);
        emit('VOLTRON_CONTEXT_ACTION', { action: 'delete_element', selector: delSelector });
      }
    }
    else if (action === 'duplicateElement') {
      if (S.selected && S.selected.parentElement) {
        var clone = S.selected.cloneNode(true);
        S.selected.parentElement.insertBefore(clone, S.selected.nextSibling);
        var cloneR = clone.getBoundingClientRect();
        addEdit({ id: uid(), type: 'duplicate_element', selector: getSelector(S.selected), desc: 'Cogalt: ' + getSelector(S.selected), coords: { x: px(cloneR.x), y: px(cloneR.y), w: px(cloneR.width), h: px(cloneR.height) }, from: null, to: { action: 'clone_after' } });
        select(clone);
        emit('VOLTRON_CONTEXT_ACTION', { action: 'duplicate_element', selector: getSelector(S.selected) });
      }
    }
    else if (action === 'wrapInDiv') {
      if (S.selected && S.selected.parentElement) {
        var wrapper = document.createElement('div');
        S.selected.parentElement.insertBefore(wrapper, S.selected);
        wrapper.appendChild(S.selected);
        var wR = wrapper.getBoundingClientRect();
        addEdit({ id: uid(), type: 'wrap_in_div', selector: getSelector(S.selected), desc: 'Div ile sar: ' + getSelector(S.selected), coords: { x: px(wR.x), y: px(wR.y), w: px(wR.width), h: px(wR.height) }, from: null, to: { action: 'wrap' } });
        select(wrapper);
        emit('VOLTRON_CONTEXT_ACTION', { action: 'wrap_in_div' });
      }
    }
    else if (action === 'unwrapElement') {
      if (S.selected && S.selected.parentElement && S.selected.children.length > 0) {
        var parent = S.selected.parentElement;
        var children = Array.from(S.selected.childNodes);
        for (var ui = 0; ui < children.length; ui++) {
          parent.insertBefore(children[ui], S.selected);
        }
        var unwrapSel = getSelector(S.selected);
        parent.removeChild(S.selected);
        addEdit({ id: uid(), type: 'unwrap_element', selector: unwrapSel, desc: 'Unwrap: ' + unwrapSel, coords: { x: 0, y: 0, w: 0, h: 0 }, from: null, to: { action: 'unwrap' } });
        select(null);
        emit('VOLTRON_CONTEXT_ACTION', { action: 'unwrap_element', selector: unwrapSel });
      }
    }
    else if (action === 'toggleVisibility') {
      if (S.selected) {
        var cs = window.getComputedStyle(S.selected);
        var isHidden = cs.display === 'none';
        S.selected.style.display = isHidden ? '' : 'none';
        var tvR = S.selected.getBoundingClientRect();
        addEdit({ id: uid(), type: 'effect', selector: getSelector(S.selected), desc: 'display: ' + (isHidden ? 'visible' : 'none'), coords: { x: px(tvR.x), y: px(tvR.y), w: px(tvR.width), h: px(tvR.height) }, from: { display: cs.display }, to: { display: isHidden ? '' : 'none' } });
        if (!isHidden) select(null);
        emit('VOLTRON_CONTEXT_ACTION', { action: 'toggle_visibility' });
      }
    }
    else if (action === 'copyHtml') {
      if (S.selected) {
        copyToClipboard(S.selected.outerHTML);
        showToast('HTML copied');
        emit('VOLTRON_CONTEXT_ACTION', { action: 'copy_html' });
      }
    }
    else if (action === 'copyStyles') {
      if (S.selected) {
        var comp = getComp(S.selected);
        var styleText = Object.keys(comp).map(function(k) { return k + ': ' + comp[k]; }).join('\\n');
        copyToClipboard(styleText);
        showToast('Styles copied');
        emit('VOLTRON_CONTEXT_ACTION', { action: 'copy_styles' });
      }
    }
    else if (action === 'showComputed') {
      if (S.selected) {
        var allComp = window.getComputedStyle(S.selected);
        var importantProps = ['display','position','width','height','padding','margin','color','backgroundColor','fontSize','fontFamily','fontWeight','borderRadius','boxShadow','opacity','overflow','flexDirection','justifyContent','alignItems','gap','border','zIndex','top','right','bottom','left'];
        var lines = [];
        for (var pi = 0; pi < importantProps.length; pi++) {
          var pName = importantProps[pi];
          lines.push(pName + ': ' + allComp[pName]);
        }
        var overlay = mk('div', '__ve_computed_overlay', 'position:fixed;z-index:2147483647;top:50%;left:50%;transform:translate(-50%,-50%);width:400px;max-height:500px;overflow-y:auto;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px;color:#e2e8f0;font:11px/1.6 monospace;box-shadow:0 20px 50px rgba(0,0,0,0.7);');
        overlay.dataset.ve = '1';
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #334155;';
        header.innerHTML = '<span style="font:bold 13px/1 sans-serif;color:#3b82f6;">Computed Styles</span>';
        var closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'background:#334155;border:none;color:#e2e8f0;width:24px;height:24px;border-radius:4px;cursor:pointer;font:bold 14px/1 sans-serif;';
        closeBtn.textContent = 'X';
        closeBtn.dataset.ve = '1';
        closeBtn.addEventListener('click', function() { if (overlay.parentElement) overlay.parentElement.removeChild(overlay); });
        header.appendChild(closeBtn);
        overlay.appendChild(header);
        var content = document.createElement('pre');
        content.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-all;';
        content.textContent = lines.join('\\n');
        overlay.appendChild(content);
        emit('VOLTRON_CONTEXT_ACTION', { action: 'show_computed', selector: getSelector(S.selected) });
      }
    }
    else if (action === 'clearAll') {
      if (confirm(t('confirmClear'))) {
        clearAll();
        emit('VOLTRON_CONTEXT_ACTION', { action: 'clear_all' });
      }
    }
    else if (action === 'saveAndNotify') {
      var editSummary = S.edits.map(function(e) {
        return { id: e.id, type: e.type, selector: e.selector, desc: e.desc, from: e.from, to: e.to, coords: e.coords };
      });
      /* Serialize annotations — extract data from DOM elements, not the elements themselves */
      var annData = S.annotations.map(function(ann) {
        return {
          id: ann.id || '',
          text: ann.textContent || '',
          title: ann.title || '',
          x: parseInt(ann.style.left, 10) || 0,
          y: parseInt(ann.style.top, 10) || 0
        };
      });
      var pinData = S.promptPins.map(function(p) {
        return { id: p.id, prompt: p.prompt, x: p.x, y: p.y };
      });
      var payload = {
        edits: editSummary,
        editCount: S.edits.length,
        timestamp: Date.now(),
        annotations: annData,
        promptPins: pinData,
        referenceImage: S.refImage ? { dataUrl: S.refImage.dataUrl } : null
      };
      emit('VOLTRON_SAVE_AND_NOTIFY', payload);

      /* Success overlay */
      var successEl = mk('div', '__ve_save_success', 'position:fixed;z-index:2147483647;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.8);background:rgba(15,23,42,0.95);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(34,197,94,0.4);border-radius:16px;padding:24px 36px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5),0 0 40px rgba(34,197,94,0.1);opacity:0;transition:all 0.3s ease;');
      successEl.dataset.ve = '1';
      successEl.innerHTML = '<div style="font-size:36px;margin-bottom:8px;">\\u2705</div><div style="color:#22c55e;font:bold 16px/1.4 sans-serif;">' + S.edits.length + t('editCount') + '</div><div style="color:#94a3b8;font:12px/1.4 sans-serif;margin-top:4px;">AI\\'ye g\\u00F6nderildi</div>';
      setTimeout(function() { successEl.style.opacity = '1'; successEl.style.transform = 'translate(-50%,-50%) scale(1)'; }, 10);
      setTimeout(function() {
        successEl.style.opacity = '0';
        successEl.style.transform = 'translate(-50%,-50%) scale(0.9)';
        setTimeout(function() { if (successEl.parentElement) successEl.parentElement.removeChild(successEl); }, 300);
      }, 2000);

      /* Tell parent to navigate to agent feed */
      emit('VOLTRON_NAVIGATE', { target: 'feed', reason: 'save_and_notify' });
    }
  }

  /* ═══ SUBMENUS ═══ */
  function showSubmenu(parentBtn, submenuType) {
    hideSubmenu();

    var parentRect = parentBtn.getBoundingClientRect();
    var sub = document.createElement('div');
    sub.id = '__ve_ctx_sub';
    sub.style.cssText = 'position:fixed;z-index:2147483646;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(51,65,85,0.8);border-radius:10px;padding:4px 0;box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(148,163,184,0.05);pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    sub.dataset.ve = '1';

    /* ── Category submenus (grouped items with sub-submenus) ── */
    if (submenuType === 'catStyle' || submenuType === 'catLayout' || submenuType === 'catElement' || submenuType === 'catInspector' || submenuType === 'catTransition') {
      buildCategorySubmenu(sub, submenuType);
    /* ── Direct value submenus (used as 3rd level from categories) ── */
    } else if (submenuType === 'color') {
      buildColorSubmenu(sub);
    } else if (submenuType === 'fontsize') {
      buildFontSizeSubmenu(sub);
    } else if (submenuType === 'effect') {
      buildEffectSubmenu(sub);
    } else if (submenuType === 'padding') {
      buildSpacingSubmenu(sub, 'padding');
    } else if (submenuType === 'margin') {
      buildSpacingSubmenu(sub, 'margin');
    } else if (submenuType === 'border') {
      buildBorderSubmenu(sub);
    } else if (submenuType === 'borderRadius') {
      buildValueListSubmenu(sub, 'borderRadius', ['0','2px','4px','8px','12px','16px','9999px']);
    } else if (submenuType === 'opacity') {
      buildValueListSubmenu(sub, 'opacity', ['1','0.9','0.8','0.7','0.6','0.5','0.4','0.3','0.2','0.1','0']);
    } else if (submenuType === 'gradient') {
      buildGradientSubmenu(sub);
    } else if (submenuType === 'display') {
      buildValueListSubmenu(sub, 'display', ['block','flex','grid','inline-flex','inline-block','none']);
    } else if (submenuType === 'flexDirection') {
      buildValueListSubmenu(sub, 'flexDirection', ['row','column','row-reverse','column-reverse']);
    } else if (submenuType === 'justifyContent') {
      buildValueListSubmenu(sub, 'justifyContent', ['flex-start','center','flex-end','space-between','space-around','space-evenly']);
    } else if (submenuType === 'alignItems') {
      buildValueListSubmenu(sub, 'alignItems', ['flex-start','center','flex-end','stretch','baseline']);
    } else if (submenuType === 'gap') {
      buildValueListSubmenu(sub, 'gap', ['0','4px','8px','12px','16px','24px','32px']);
    } else if (submenuType === 'transition') {
      buildTransitionSubmenu(sub);
    } else if (submenuType === 'animation') {
      buildAnimationSubmenu(sub);
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
      }, 300);
    });
  }

  function buildCategorySubmenu(sub, catType) {
    sub.style.minWidth = '180px';
    var catItems = [];

    if (catType === 'catStyle') {
      catItems = [
        { emoji: '\\uD83C\\uDFA8', label: 'changeColor', subType: 'color' },
        { emoji: '\\uD83D\\uDCCF', label: 'fontSize', subType: 'fontsize' },
        { emoji: '\\u2728', label: 'addEffect', subType: 'effect' },
        { emoji: '\\uD83D\\uDCE6', label: 'padding', subType: 'padding' },
        { emoji: '\\u2B1C', label: 'margin', subType: 'margin' },
        { emoji: '\\u25A1', label: 'border', subType: 'border' },
        { emoji: '\\u25EF', label: 'borderRadius', subType: 'borderRadius' },
        { emoji: '\\uD83D\\uDCA7', label: 'opacity', subType: 'opacity' },
        { emoji: '\\uD83C\\uDF08', label: 'gradient', subType: 'gradient' }
      ];
    } else if (catType === 'catLayout') {
      catItems = [
        { emoji: '\\uD83D\\uDCE4', label: 'display', subType: 'display' },
        { emoji: '\\u2194\\uFE0F', label: 'flexDirection', subType: 'flexDirection' },
        { emoji: '\\u2696\\uFE0F', label: 'justifyContent', subType: 'justifyContent' },
        { emoji: '\\u2195\\uFE0F', label: 'alignItems', subType: 'alignItems' },
        { emoji: '\\u2506', label: 'gap', subType: 'gap' },
        { emoji: '\\u2194\\uFE0F', label: 'expandShrink', action: 'expandShrink' }
      ];
    } else if (catType === 'catElement') {
      catItems = [
        { emoji: '\\u274C', label: 'deleteElement', action: 'deleteElement', danger: true },
        { emoji: '\\uD83D\\uDCC4', label: 'duplicateElement', action: 'duplicateElement' },
        { emoji: '\\uD83D\\uDCE6', label: 'wrapInDiv', action: 'wrapInDiv' },
        { emoji: '\\uD83E\\uDDC5', label: 'unwrapElement', action: 'unwrapElement' },
        { emoji: '\\uD83D\\uDC41', label: 'toggleVisibility', action: 'toggleVisibility' }
      ];
    } else if (catType === 'catInspector') {
      catItems = [
        { emoji: '\\uD83D\\uDCCB', label: 'copyHtml', action: 'copyHtml' },
        { emoji: '\\uD83C\\uDFA8', label: 'copyStyles', action: 'copyStyles' },
        { emoji: '\\uD83D\\uDD0D', label: 'showComputed', action: 'showComputed' }
      ];
    } else if (catType === 'catTransition') {
      catItems = [
        { emoji: '\\u23F1', label: 'transition', subType: 'transition' }
      ];
      if (S.selected) {
        var cs = window.getComputedStyle(S.selected);
        if (cs.animationName && cs.animationName !== 'none') {
          catItems.push({ emoji: '\\uD83C\\uDFAC', label: 'animation', subType: 'animation' });
        }
      }
    }

    for (var i = 0; i < catItems.length; i++) {
      var ci = catItems[i];
      var btn = document.createElement('div');
      btn.style.cssText = 'padding:4px 12px;font:12px/1.4 sans-serif;color:' + (ci.danger ? '#ef4444' : '#e2e8f0') + ';cursor:pointer;display:flex;align-items:center;gap:7px;border-radius:4px;margin:0 4px;transition:background 0.1s;';
      btn.dataset.ve = '1';

      var emoSpan = document.createElement('span');
      emoSpan.style.cssText = 'font-size:13px;width:18px;text-align:center;flex-shrink:0;';
      emoSpan.textContent = ci.emoji || '';
      btn.appendChild(emoSpan);

      var lblSpan = document.createElement('span');
      lblSpan.style.cssText = 'flex:1;white-space:nowrap;';
      lblSpan.textContent = t(ci.label);
      btn.appendChild(lblSpan);

      if (ci.subType) {
        var arr = document.createElement('span');
        arr.style.cssText = 'color:#64748b;font-size:9px;margin-left:auto;';
        arr.textContent = '\\u25B6';
        btn.appendChild(arr);
      }

      btn.addEventListener('mouseenter', (function(it, btnEl) {
        return function() {
          btnEl.style.background = 'rgba(51,65,85,0.5)';
          if (it.subType) {
            clearSubSubmenuTimer();
            S.subSubmenuTimer = setTimeout(function() {
              showSubSubmenu(btnEl, it.subType);
            }, 150);
          } else {
            clearSubSubmenuTimer();
            hideSubSubmenu();
          }
        };
      })(ci, btn));

      btn.addEventListener('mouseleave', (function(btnEl) {
        return function() { btnEl.style.background = ''; };
      })(btn));

      btn.addEventListener('click', (function(it) {
        return function(e) {
          e.stopPropagation();
          if (it.subType) return;
          hideContextMenu();
          handleMenuAction(it);
        };
      })(ci));

      sub.appendChild(btn);
    }
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
    sub.style.minWidth = '200px';
    sub.style.maxHeight = '420px';
    sub.style.overflowY = 'auto';
    sub.style.scrollbarWidth = 'thin';
    sub.style.scrollbarColor = '#334155 transparent';

    function addSectionHeader(text) {
      var hdr = document.createElement('div');
      hdr.style.cssText = 'padding:5px 12px 2px;font:bold 9px/1.2 sans-serif;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;';
      hdr.textContent = t(text);
      hdr.dataset.ve = '1';
      sub.appendChild(hdr);
    }

    function addSeparator() {
      var sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:rgba(51,65,85,0.6);margin:3px 10px;';
      sep.dataset.ve = '1';
      sub.appendChild(sep);
    }

    /* ── Section 1: Box Shadows ── */
    addSectionHeader('secShadows');
    for (var i = 0; i < SHADOW_PRESETS.length; i++) {
      var preset = SHADOW_PRESETS[i];
      var item = document.createElement('div');
      item.style.cssText = 'padding:4px 12px;font:12px/1.4 sans-serif;color:#e2e8f0;cursor:pointer;display:flex;align-items:center;gap:8px;border-radius:4px;margin:0 4px;';
      item.dataset.ve = '1';
      var previewBox = document.createElement('div');
      var previewShadow = preset.value === 'none' ? 'none' : preset.value;
      previewBox.style.cssText = 'width:20px;height:20px;background:#475569;border-radius:3px;box-shadow:' + previewShadow + ';flex-shrink:0;';
      item.appendChild(previewBox);
      var label = document.createElement('span');
      label.textContent = t(preset.label);
      item.appendChild(label);
      item.addEventListener('mouseenter', function() { this.style.background = 'rgba(51,65,85,0.5)'; });
      item.addEventListener('mouseleave', function() { this.style.background = ''; });
      item.addEventListener('click', (function(val) {
        return function(e) {
          e.stopPropagation();
          hideContextMenu();
          applyEffect({ shadow: val });
          emit('VOLTRON_CONTEXT_ACTION', { action: 'add_effect', effect: 'boxShadow', value: val });
        };
      })(preset.value));
      sub.appendChild(item);
    }

    /* ── Section 2: CSS Filters ── */
    addSeparator();
    addSectionHeader('secFilters');
    for (var fi = 0; fi < FILTER_PRESETS.length; fi++) {
      var fp = FILTER_PRESETS[fi];
      var fItem = document.createElement('div');
      fItem.style.cssText = 'padding:4px 12px;font:12px/1.4 sans-serif;color:#e2e8f0;cursor:pointer;display:flex;align-items:center;gap:8px;border-radius:4px;margin:0 4px;';
      fItem.dataset.ve = '1';
      var fPreview = document.createElement('div');
      var fPreviewFilter = fp.value === 'none' ? '' : fp.value;
      fPreview.style.cssText = 'width:20px;height:20px;background:linear-gradient(135deg,#3b82f6,#a855f7);border-radius:3px;flex-shrink:0;filter:' + fPreviewFilter + ';';
      fItem.appendChild(fPreview);
      var fLabel = document.createElement('span');
      fLabel.textContent = t(fp.label);
      fItem.appendChild(fLabel);
      fItem.addEventListener('mouseenter', function() { this.style.background = 'rgba(51,65,85,0.5)'; });
      fItem.addEventListener('mouseleave', function() { this.style.background = ''; });
      fItem.addEventListener('click', (function(preset) {
        return function(e) {
          e.stopPropagation();
          hideContextMenu();
          if (!S.selected) return;
          var cs = window.getComputedStyle(S.selected);
          var oldVal = cs[preset.prop] || 'none';
          S.selected.style[preset.prop] = preset.value;
          var r = S.selected.getBoundingClientRect();
          var fromObj = {}; fromObj[preset.prop] = oldVal;
          var toObj = {}; toObj[preset.prop] = preset.value;
          addEdit({ id: uid(), type: 'effect', selector: getSelector(S.selected), desc: preset.prop + ': ' + preset.value, coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }, from: fromObj, to: toObj });
          updateSel();
          emit('VOLTRON_CONTEXT_ACTION', { action: 'add_effect', effect: 'filter', value: preset.value });
        };
      })(fp));
      sub.appendChild(fItem);
    }

    /* ── Section 3: Text Shadows ── */
    addSeparator();
    addSectionHeader('secTextShadow');
    for (var ti = 0; ti < TEXT_SHADOW_PRESETS.length; ti++) {
      var tp = TEXT_SHADOW_PRESETS[ti];
      var tItem = document.createElement('div');
      tItem.style.cssText = 'padding:4px 12px;font:12px/1.4 sans-serif;color:#e2e8f0;cursor:pointer;display:flex;align-items:center;gap:8px;border-radius:4px;margin:0 4px;';
      tItem.dataset.ve = '1';
      var tPreview = document.createElement('span');
      tPreview.style.cssText = 'font:bold 14px/1 sans-serif;color:#e2e8f0;text-shadow:' + (tp.value === 'none' ? 'none' : tp.value) + ';width:20px;text-align:center;flex-shrink:0;';
      tPreview.textContent = 'A';
      tItem.appendChild(tPreview);
      var tLabel = document.createElement('span');
      tLabel.textContent = t(tp.label);
      tItem.appendChild(tLabel);
      tItem.addEventListener('mouseenter', function() { this.style.background = 'rgba(51,65,85,0.5)'; });
      tItem.addEventListener('mouseleave', function() { this.style.background = ''; });
      tItem.addEventListener('click', (function(val) {
        return function(e) {
          e.stopPropagation();
          hideContextMenu();
          if (!S.selected) return;
          var cs = window.getComputedStyle(S.selected);
          var oldVal = cs.textShadow || 'none';
          S.selected.style.textShadow = val;
          var r = S.selected.getBoundingClientRect();
          addEdit({ id: uid(), type: 'effect', selector: getSelector(S.selected), desc: 'textShadow: ' + val, coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }, from: { textShadow: oldVal }, to: { textShadow: val } });
          updateSel();
          emit('VOLTRON_CONTEXT_ACTION', { action: 'add_effect', effect: 'textShadow', value: val });
        };
      })(tp.value));
      sub.appendChild(tItem);
    }
  }

  function buildSpacingSubmenu(sub, prop) {
    var values = ['0','4px','8px','12px','16px','24px','32px','48px'];
    sub.style.minWidth = '120px';
    for (var i = 0; i < values.length; i++) {
      var val = values[i];
      var item = document.createElement('div');
      item.style.cssText = 'padding:5px 14px;font:12px/1.4 monospace;color:#e2e8f0;cursor:pointer;';
      item.dataset.ve = '1';
      item.textContent = val;
      item.addEventListener('mouseenter', function() { this.style.background = '#334155'; });
      item.addEventListener('mouseleave', function() { this.style.background = ''; });
      item.addEventListener('click', (function(v, p) {
        return function(ev) {
          ev.stopPropagation();
          hideContextMenu();
          if (!S.selected) return;
          var cs = window.getComputedStyle(S.selected);
          var oldVal = cs[p];
          S.selected.style[p] = v;
          var r = S.selected.getBoundingClientRect();
          var fromObj = {}; fromObj[p] = oldVal;
          var toObj = {}; toObj[p] = v;
          addEdit({ id: uid(), type: 'effect', selector: getSelector(S.selected), desc: p + ': ' + v, coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }, from: fromObj, to: toObj });
          updateSel();
        };
      })(val, prop));
      sub.appendChild(item);
    }
  }

  function buildBorderSubmenu(sub) {
    sub.style.minWidth = '160px';
    var widths = ['none','1px solid','2px solid','3px solid','4px solid','1px dashed','2px dashed','1px dotted'];
    for (var i = 0; i < widths.length; i++) {
      var val = widths[i];
      var item = document.createElement('div');
      item.style.cssText = 'padding:5px 14px;font:12px/1.4 sans-serif;color:#e2e8f0;cursor:pointer;display:flex;align-items:center;gap:8px;';
      item.dataset.ve = '1';
      var preview = document.createElement('div');
      if (val === 'none') {
        preview.style.cssText = 'width:40px;height:16px;background:#334155;border-radius:2px;';
      } else {
        preview.style.cssText = 'width:40px;height:16px;border:' + val + ' #94a3b8;border-radius:2px;';
      }
      item.appendChild(preview);
      var label = document.createElement('span');
      label.textContent = val;
      item.appendChild(label);
      item.addEventListener('mouseenter', function() { this.style.background = '#334155'; });
      item.addEventListener('mouseleave', function() { this.style.background = ''; });
      item.addEventListener('click', (function(v) {
        return function(ev) {
          ev.stopPropagation();
          hideContextMenu();
          if (!S.selected) return;
          var cs = window.getComputedStyle(S.selected);
          var oldBorder = cs.border;
          if (v === 'none') {
            S.selected.style.border = 'none';
          } else {
            S.selected.style.border = v + ' ' + (cs.borderColor || '#94a3b8');
          }
          var r = S.selected.getBoundingClientRect();
          addEdit({ id: uid(), type: 'effect', selector: getSelector(S.selected), desc: 'border: ' + v, coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }, from: { border: oldBorder }, to: { border: v } });
          updateSel();
        };
      })(val));
      sub.appendChild(item);
    }
  }

  function buildValueListSubmenu(sub, cssProp, values) {
    sub.style.minWidth = '140px';
    sub.style.maxHeight = '320px';
    sub.style.overflowY = 'auto';
    for (var i = 0; i < values.length; i++) {
      var val = values[i];
      var item = document.createElement('div');
      item.style.cssText = 'padding:5px 14px;font:12px/1.4 monospace;color:#e2e8f0;cursor:pointer;';
      item.dataset.ve = '1';
      item.textContent = val;
      item.addEventListener('mouseenter', function() { this.style.background = '#334155'; });
      item.addEventListener('mouseleave', function() { this.style.background = ''; });
      item.addEventListener('click', (function(v, p) {
        return function(ev) {
          ev.stopPropagation();
          hideContextMenu();
          if (!S.selected) return;
          var cs = window.getComputedStyle(S.selected);
          var oldVal = cs[p];
          S.selected.style[p] = v;
          var r = S.selected.getBoundingClientRect();
          var fromObj = {}; fromObj[p] = oldVal;
          var toObj = {}; toObj[p] = v;
          addEdit({ id: uid(), type: 'effect', selector: getSelector(S.selected), desc: p + ': ' + v, coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }, from: fromObj, to: toObj });
          updateSel();
        };
      })(val, cssProp));
      sub.appendChild(item);
    }
  }

  function buildGradientSubmenu(sub) {
    sub.style.minWidth = '200px';
    sub.style.maxHeight = '380px';
    sub.style.overflowY = 'auto';
    sub.style.scrollbarWidth = 'thin';
    sub.style.scrollbarColor = '#334155 transparent';
    var gradients = [
      /* Linear */
      { label: 'Blue \\u2192 Purple', value: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' },
      { label: 'Green \\u2192 Blue', value: 'linear-gradient(135deg, #22c55e, #06b6d4)' },
      { label: 'Orange \\u2192 Pink', value: 'linear-gradient(135deg, #f97316, #ec4899)' },
      { label: 'Red \\u2192 Yellow', value: 'linear-gradient(135deg, #ef4444, #eab308)' },
      { label: 'Dark \\u2192 Light', value: 'linear-gradient(180deg, #0f172a, #334155)' },
      { label: 'Sunset', value: 'linear-gradient(135deg, #f97316, #ef4444, #8b5cf6)' },
      { label: 'Ocean', value: 'linear-gradient(135deg, #0ea5e9, #6366f1, #a855f7)' },
      { label: 'Aurora', value: 'linear-gradient(135deg, #22c55e, #06b6d4, #8b5cf6)' },
      { label: 'Fire', value: 'linear-gradient(135deg, #dc2626, #f97316, #eab308)' },
      { label: 'Midnight', value: 'linear-gradient(135deg, #1e1b4b, #312e81, #4c1d95)' },
      { label: 'Rose Gold', value: 'linear-gradient(135deg, #be185d, #e11d48, #f59e0b)' },
      { label: 'Ice', value: 'linear-gradient(135deg, #e0f2fe, #bae6fd, #7dd3fc)' },
      { label: 'Forest', value: 'linear-gradient(135deg, #14532d, #166534, #15803d)' },
      { label: 'Candy', value: 'linear-gradient(135deg, #ec4899, #f472b6, #f9a8d4)' },
      /* Radial */
      { label: 'Radial Blue', value: 'radial-gradient(circle, #3b82f6, #1e3a8a)' },
      { label: 'Radial Glow', value: 'radial-gradient(circle, rgba(139,92,246,0.4), transparent)' },
      { label: 'Spotlight', value: 'radial-gradient(ellipse at center, #fbbf24, #f97316, #1e293b)' },
      /* Conic */
      { label: 'Rainbow', value: 'conic-gradient(#ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444)' },
      /* Remove */
      { label: 'None', value: 'none' }
    ];
    for (var i = 0; i < gradients.length; i++) {
      var g = gradients[i];
      var item = document.createElement('div');
      item.style.cssText = 'padding:5px 14px;font:12px/1.4 sans-serif;color:#e2e8f0;cursor:pointer;display:flex;align-items:center;gap:8px;';
      item.dataset.ve = '1';
      var preview = document.createElement('div');
      preview.style.cssText = 'width:32px;height:16px;border-radius:3px;background:' + g.value + ';flex-shrink:0;';
      item.appendChild(preview);
      var label = document.createElement('span');
      label.textContent = g.label;
      item.appendChild(label);
      item.addEventListener('mouseenter', function() { this.style.background = '#334155'; });
      item.addEventListener('mouseleave', function() { this.style.background = ''; });
      item.addEventListener('click', (function(v) {
        return function(ev) {
          ev.stopPropagation();
          hideContextMenu();
          if (!S.selected) return;
          var cs = window.getComputedStyle(S.selected);
          var oldBg = cs.background;
          S.selected.style.background = v;
          var r = S.selected.getBoundingClientRect();
          addEdit({ id: uid(), type: 'effect', selector: getSelector(S.selected), desc: 'gradient', coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }, from: { background: oldBg }, to: { background: v } });
          updateSel();
        };
      })(g.value));
      sub.appendChild(item);
    }
  }

  function buildTransitionSubmenu(sub) {
    sub.style.minWidth = '220px';
    if (!S.selected) return;
    var cs = window.getComputedStyle(S.selected);
    var rawTrans = cs.transition || '';

    /* Show current value */
    var curHeader = document.createElement('div');
    curHeader.style.cssText = 'padding:4px 12px 2px;font:bold 10px/1.2 sans-serif;color:#94a3b8;';
    curHeader.textContent = '\\u23F1 ' + (rawTrans && rawTrans !== 'all 0s ease 0s' ? rawTrans : '(yok)');
    curHeader.dataset.ve = '1';
    sub.appendChild(curHeader);

    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:#334155;margin:4px 8px;';
    sep.dataset.ve = '1';
    sub.appendChild(sep);

    /* Parse individual transitions */
    var parts = rawTrans.split(',');
    for (var pi = 0; pi < parts.length; pi++) {
      var part = parts[pi].trim();
      if (!part || part === 'all 0s ease 0s') continue;
      var layerItem = document.createElement('div');
      layerItem.style.cssText = 'padding:5px 14px;font:11px/1.4 monospace;color:#67e8f9;cursor:default;display:flex;align-items:center;gap:6px;';
      layerItem.dataset.ve = '1';
      var dot = document.createElement('span');
      dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:#06b6d4;flex-shrink:0;';
      layerItem.appendChild(dot);
      var lbl = document.createElement('span');
      lbl.textContent = part;
      layerItem.appendChild(lbl);
      sub.appendChild(layerItem);
    }

    /* Preset transitions */
    var presets = [
      { label: 'Fade (0.3s)', value: 'opacity 0.3s ease' },
      { label: 'Slide (0.3s)', value: 'transform 0.3s ease' },
      { label: 'All (0.3s ease)', value: 'all 0.3s ease' },
      { label: 'All (0.5s ease-in-out)', value: 'all 0.5s ease-in-out' },
      { label: 'Color (0.2s)', value: 'color 0.2s, background-color 0.2s' },
      { label: 'Bounce (0.4s)', value: 'all 0.4s cubic-bezier(0.68,-0.55,0.265,1.55)' }
    ];

    var sep2 = document.createElement('div');
    sep2.style.cssText = 'height:1px;background:#334155;margin:4px 8px;';
    sep2.dataset.ve = '1';
    sub.appendChild(sep2);

    for (var i = 0; i < presets.length; i++) {
      var pr = presets[i];
      var item = document.createElement('div');
      item.style.cssText = 'padding:5px 14px;font:12px/1.4 sans-serif;color:#e2e8f0;cursor:pointer;';
      item.dataset.ve = '1';
      item.textContent = pr.label;
      item.addEventListener('mouseenter', function() { this.style.background = '#334155'; });
      item.addEventListener('mouseleave', function() { this.style.background = ''; });
      item.addEventListener('click', (function(v) {
        return function(ev) {
          ev.stopPropagation();
          hideContextMenu();
          if (!S.selected) return;
          var old = window.getComputedStyle(S.selected).transition || '';
          S.selected.style.transition = v;
          var r = S.selected.getBoundingClientRect();
          addEdit({ id: uid(), type: 'effect', selector: getSelector(S.selected), desc: 'transition: ' + v, coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }, from: { transition: old }, to: { transition: v } });
          updateSel();
        };
      })(pr.value));
      sub.appendChild(item);
    }

    /* Custom + Remove */
    var sep3 = document.createElement('div');
    sep3.style.cssText = 'height:1px;background:#334155;margin:4px 8px;';
    sep3.dataset.ve = '1';
    sub.appendChild(sep3);

    var customItem = document.createElement('div');
    customItem.style.cssText = 'padding:5px 14px;font:12px/1.4 sans-serif;color:#a78bfa;cursor:pointer;';
    customItem.dataset.ve = '1';
    customItem.textContent = '\\u270F ' + t('transCustom');
    customItem.addEventListener('mouseenter', function() { this.style.background = '#334155'; });
    customItem.addEventListener('mouseleave', function() { this.style.background = ''; });
    customItem.addEventListener('click', function(ev) {
      ev.stopPropagation();
      hideContextMenu();
      if (!S.selected) return;
      var val = prompt(t('enterTransition'), rawTrans !== 'all 0s ease 0s' ? rawTrans : 'all 0.3s ease');
      if (val === null) return;
      var old = window.getComputedStyle(S.selected).transition || '';
      S.selected.style.transition = val;
      var r = S.selected.getBoundingClientRect();
      addEdit({ id: uid(), type: 'effect', selector: getSelector(S.selected), desc: 'transition: ' + val, coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }, from: { transition: old }, to: { transition: val } });
      updateSel();
    });
    sub.appendChild(customItem);

    var removeItem = document.createElement('div');
    removeItem.style.cssText = 'padding:5px 14px;font:12px/1.4 sans-serif;color:#f87171;cursor:pointer;';
    removeItem.dataset.ve = '1';
    removeItem.textContent = '\\u2716 ' + t('transNone');
    removeItem.addEventListener('mouseenter', function() { this.style.background = '#334155'; });
    removeItem.addEventListener('mouseleave', function() { this.style.background = ''; });
    removeItem.addEventListener('click', function(ev) {
      ev.stopPropagation();
      hideContextMenu();
      if (!S.selected) return;
      var old = window.getComputedStyle(S.selected).transition || '';
      S.selected.style.transition = 'none';
      var r = S.selected.getBoundingClientRect();
      addEdit({ id: uid(), type: 'effect', selector: getSelector(S.selected), desc: 'transition: none', coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }, from: { transition: old }, to: { transition: 'none' } });
      updateSel();
    });
    sub.appendChild(removeItem);
  }

  function buildAnimationSubmenu(sub) {
    sub.style.minWidth = '220px';
    if (!S.selected) return;
    var cs = window.getComputedStyle(S.selected);
    var rawAnim = cs.animationName || 'none';
    var rawDur = cs.animationDuration || '0s';
    var rawTiming = cs.animationTimingFunction || 'ease';
    var rawIter = cs.animationIterationCount || '1';
    var rawDir = cs.animationDirection || 'normal';

    /* Show current value */
    var curHeader = document.createElement('div');
    curHeader.style.cssText = 'padding:4px 12px 2px;font:bold 10px/1.2 sans-serif;color:#94a3b8;';
    curHeader.textContent = '\\uD83C\\uDFAC ' + (rawAnim !== 'none' ? rawAnim + ' ' + rawDur + ' ' + rawTiming : '(yok)');
    curHeader.dataset.ve = '1';
    sub.appendChild(curHeader);

    if (rawAnim !== 'none') {
      /* Show animation details as info rows */
      var details = [
        { label: 'name', value: rawAnim },
        { label: 'duration', value: rawDur },
        { label: 'timing', value: rawTiming },
        { label: 'iteration', value: rawIter },
        { label: 'direction', value: rawDir }
      ];
      for (var di = 0; di < details.length; di++) {
        var row = document.createElement('div');
        row.style.cssText = 'padding:2px 14px;font:10px/1.4 monospace;color:#67e8f9;display:flex;gap:8px;';
        row.dataset.ve = '1';
        var k = document.createElement('span');
        k.style.color = '#94a3b8';
        k.textContent = details[di].label + ':';
        row.appendChild(k);
        var v = document.createElement('span');
        v.textContent = details[di].value;
        row.appendChild(v);
        sub.appendChild(row);
      }
    }

    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:#334155;margin:4px 8px;';
    sep.dataset.ve = '1';
    sub.appendChild(sep);

    /* Preset animations */
    var presets = [
      { label: 'Pulse', value: 'pulse 2s ease-in-out infinite' },
      { label: 'Bounce', value: 'bounce 1s ease infinite' },
      { label: 'Spin', value: 'spin 1s linear infinite' },
      { label: 'Ping', value: 'ping 1s cubic-bezier(0,0,0.2,1) infinite' },
      { label: 'Fade In', value: 'fadeIn 0.5s ease forwards' },
      { label: 'Slide Up', value: 'slideUp 0.5s ease forwards' }
    ];

    for (var i = 0; i < presets.length; i++) {
      var pr = presets[i];
      var item = document.createElement('div');
      item.style.cssText = 'padding:5px 14px;font:12px/1.4 sans-serif;color:#e2e8f0;cursor:pointer;';
      item.dataset.ve = '1';
      item.textContent = pr.label;
      item.addEventListener('mouseenter', function() { this.style.background = '#334155'; });
      item.addEventListener('mouseleave', function() { this.style.background = ''; });
      item.addEventListener('click', (function(v) {
        return function(ev) {
          ev.stopPropagation();
          hideContextMenu();
          if (!S.selected) return;
          var old = window.getComputedStyle(S.selected).animation || '';
          S.selected.style.animation = v;
          var r = S.selected.getBoundingClientRect();
          addEdit({ id: uid(), type: 'effect', selector: getSelector(S.selected), desc: 'animation: ' + v, coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }, from: { animation: old }, to: { animation: v } });
          updateSel();
        };
      })(pr.value));
      sub.appendChild(item);
    }

    /* Custom + Remove */
    var sep2 = document.createElement('div');
    sep2.style.cssText = 'height:1px;background:#334155;margin:4px 8px;';
    sep2.dataset.ve = '1';
    sub.appendChild(sep2);

    var customItem = document.createElement('div');
    customItem.style.cssText = 'padding:5px 14px;font:12px/1.4 sans-serif;color:#a78bfa;cursor:pointer;';
    customItem.dataset.ve = '1';
    customItem.textContent = '\\u270F ' + t('animCustom');
    customItem.addEventListener('mouseenter', function() { this.style.background = '#334155'; });
    customItem.addEventListener('mouseleave', function() { this.style.background = ''; });
    customItem.addEventListener('click', function(ev) {
      ev.stopPropagation();
      hideContextMenu();
      if (!S.selected) return;
      var val = prompt(t('enterAnimation'), rawAnim !== 'none' ? rawAnim + ' ' + rawDur + ' ' + rawTiming : 'bounce 1s infinite');
      if (val === null) return;
      var old = window.getComputedStyle(S.selected).animation || '';
      S.selected.style.animation = val;
      var r = S.selected.getBoundingClientRect();
      addEdit({ id: uid(), type: 'effect', selector: getSelector(S.selected), desc: 'animation: ' + val, coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }, from: { animation: old }, to: { animation: val } });
      updateSel();
    });
    sub.appendChild(customItem);

    var removeItem = document.createElement('div');
    removeItem.style.cssText = 'padding:5px 14px;font:12px/1.4 sans-serif;color:#f87171;cursor:pointer;';
    removeItem.dataset.ve = '1';
    removeItem.textContent = '\\u2716 ' + t('animNone');
    removeItem.addEventListener('mouseenter', function() { this.style.background = '#334155'; });
    removeItem.addEventListener('mouseleave', function() { this.style.background = ''; });
    removeItem.addEventListener('click', function(ev) {
      ev.stopPropagation();
      hideContextMenu();
      if (!S.selected) return;
      var old = window.getComputedStyle(S.selected).animation || '';
      S.selected.style.animation = 'none';
      var r = S.selected.getBoundingClientRect();
      addEdit({ id: uid(), type: 'effect', selector: getSelector(S.selected), desc: 'animation: none', coords: { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }, from: { animation: old }, to: { animation: 'none' } });
      updateSel();
    });
    sub.appendChild(removeItem);
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
    clearSubSubmenuTimer();
    hideSubSubmenu();
    clearSubmenuTimer();
    hideSubmenu();
    if (S.contextMenu && S.contextMenu.parentElement) S.contextMenu.parentElement.removeChild(S.contextMenu);
    S.contextMenu = null;
  }

  function showSubSubmenu(parentBtn, submenuType) {
    hideSubSubmenu();
    var parentRect = parentBtn.getBoundingClientRect();
    var sub = document.createElement('div');
    sub.id = '__ve_ctx_sub2';
    sub.style.cssText = 'position:fixed;z-index:2147483647;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(51,65,85,0.8);border-radius:8px;padding:4px 0;box-shadow:0 8px 32px rgba(0,0,0,0.5);pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    sub.dataset.ve = '1';

    if (submenuType === 'color') buildColorSubmenu(sub);
    else if (submenuType === 'fontsize') buildFontSizeSubmenu(sub);
    else if (submenuType === 'effect') buildEffectSubmenu(sub);
    else if (submenuType === 'padding') buildSpacingSubmenu(sub, 'padding');
    else if (submenuType === 'margin') buildSpacingSubmenu(sub, 'margin');
    else if (submenuType === 'border') buildBorderSubmenu(sub);
    else if (submenuType === 'borderRadius') buildValueListSubmenu(sub, 'borderRadius', ['0','2px','4px','8px','12px','16px','9999px']);
    else if (submenuType === 'opacity') buildValueListSubmenu(sub, 'opacity', ['1','0.9','0.8','0.7','0.6','0.5','0.4','0.3','0.2','0.1','0']);
    else if (submenuType === 'gradient') buildGradientSubmenu(sub);
    else if (submenuType === 'display') buildValueListSubmenu(sub, 'display', ['block','flex','grid','inline-flex','inline-block','none']);
    else if (submenuType === 'flexDirection') buildValueListSubmenu(sub, 'flexDirection', ['row','column','row-reverse','column-reverse']);
    else if (submenuType === 'justifyContent') buildValueListSubmenu(sub, 'justifyContent', ['flex-start','center','flex-end','space-between','space-around','space-evenly']);
    else if (submenuType === 'alignItems') buildValueListSubmenu(sub, 'alignItems', ['flex-start','center','flex-end','stretch','baseline']);
    else if (submenuType === 'gap') buildValueListSubmenu(sub, 'gap', ['0','4px','8px','12px','16px','24px','32px']);
    else if (submenuType === 'transition') buildTransitionSubmenu(sub);
    else if (submenuType === 'animation') buildAnimationSubmenu(sub);

    document.body.appendChild(sub);

    var subW = sub.offsetWidth || 200;
    var subH = sub.offsetHeight || 200;
    var subX = parentRect.right + 4;
    var subY = parentRect.top - 4;
    if (subX + subW > window.innerWidth - 8) subX = parentRect.left - subW - 4;
    if (subY + subH > window.innerHeight - 8) subY = Math.max(8, window.innerHeight - subH - 8);
    if (subX < 8) subX = 8;
    if (subY < 8) subY = 8;
    sub.style.left = subX + 'px';
    sub.style.top = subY + 'px';

    S.activeSubSubmenu = sub;
    S.activeSubSubmenuItem = parentBtn;

    sub.addEventListener('mouseenter', function() { clearSubSubmenuTimer(); });
    sub.addEventListener('mouseleave', function() {
      clearSubSubmenuTimer();
      S.subSubmenuTimer = setTimeout(function() { hideSubSubmenu(); }, 300);
    });
  }

  function hideSubSubmenu() {
    if (S.activeSubSubmenu && S.activeSubSubmenu.parentElement) {
      S.activeSubSubmenu.parentElement.removeChild(S.activeSubSubmenu);
    }
    S.activeSubSubmenu = null;
    S.activeSubSubmenuItem = null;
  }

  function clearSubSubmenuTimer() {
    if (S.subSubmenuTimer) {
      clearTimeout(S.subSubmenuTimer);
      S.subSubmenuTimer = null;
    }
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
    /* Undo restyle — restore all original style properties */
    if (edit.type==='restyle' && edit.from) { var rsel = document.querySelector(edit.selector); if(rsel) { var rkeys = Object.keys(edit.from); for (var rk = 0; rk < rkeys.length; rk++) { try { rsel.style[rkeys[rk]] = edit.from[rkeys[rk]]; } catch(e){} } } }
    /* Undo delete — restore element visibility */
    if (edit.type==='delete' && edit.from) { var del = document.querySelector(edit.selector); if(del) { del.style.display = edit.from.display || ''; del.style.opacity = edit.from.opacity || '1'; } }
    /* Undo duplicate — remove cloned element */
    if (edit.type==='duplicate' && edit.to && edit.to.cloneSelector) { var dup = document.querySelector(edit.to.cloneSelector); if(dup && dup.parentElement) dup.parentElement.removeChild(dup); }
    /* Undo visibility toggle — restore original visibility/opacity */
    if (edit.type==='visibility' && edit.from) { var vel = document.querySelector(edit.selector); if(vel) { vel.style.visibility = edit.from.visibility || ''; vel.style.opacity = edit.from.opacity || '1'; } }
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
    tooltip.textContent = el.tagName.toLowerCase() + (el.id && !el.id.startsWith('__ve') ? '#'+el.id : '') + ' ' + px(rr.width) + 'x' + px(rr.height) + ' @(' + px(rr.x) + ',' + px(rr.y) + ')';
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(e.clientX + 12, window.innerWidth - 280) + 'px';
    tooltip.style.top = (e.clientY > 40 ? e.clientY - 22 : e.clientY + 16) + 'px';
  }

  function onMouseDown(e) {
    if (!S.enabled) return;

    /* Resize handle */
    if (e.target.dataset && e.target.dataset.handle && S.selected) {
      hideContextMenu();
      e.preventDefault();
      startResize(e.target.dataset.handle, e);
      return;
    }

    /* Let our UI elements (context menu items, etc.) handle their own clicks.
       Do NOT call hideContextMenu() here — the menu item's click handler
       needs the DOM element alive to fire. It calls hideContextMenu() itself. */
    if (isOurs(e.target)) return;

    hideContextMenu();
    if (e.button !== 0) return;

    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOurs(el)) return;

    /* Click on body/html = deselect current element */
    if (el === document.body || el === document.documentElement) {
      if (S.selected) { select(null); }
      return;
    }

    if (el !== S.selected) {
      select(el);
    }
    /* If text editing is active on this element, let the browser handle cursor/selection */
    if (S.textEditing && S.textEditing === el) return;
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
    /* Allow clicks inside contentEditable text editing */
    if (S.textEditing) return;
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
    e.preventDefault();
    if (isOurs(e.target)) return;
    /* Auto-select element under cursor so full menu appears */
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && !isOurs(el) && el !== document.body && el !== document.documentElement) {
      select(el);
    } else if (el === document.body || el === document.documentElement) {
      /* Right-click on empty area: deselect, still show minimal menu */
      if (S.selected) select(null);
    }
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
          S.promptPinCounter++;
          var pinNum = S.promptPinCounter;

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
      /* ═══ UNIVERSAL STYLE APPLICATION (from DesignContextMenu) ═══ */
      case 'VOLTRON_APPLY_STYLE':
        (function() {
          var target = null;
          if (d.selector) target = document.querySelector(d.selector);
          if (!target) target = S.selected;
          if (!target || !d.styles || typeof d.styles !== 'object') return;
          var cs = window.getComputedStyle(target);
          var from = {}, to = {};
          var keys = Object.keys(d.styles);
          for (var si = 0; si < keys.length; si++) {
            var prop = keys[si];
            var val = d.styles[prop];
            try {
              from[prop] = cs[prop] || target.style[prop] || '';
              target.style[prop] = val;
              to[prop] = val;
            } catch(e) { /* skip invalid props */ }
          }
          if (Object.keys(to).length > 0) {
            var r = target.getBoundingClientRect();
            addEdit({
              id: uid(), type: 'restyle', selector: getSelector(target),
              desc: 'Style: ' + Object.keys(to).join(', '),
              coords: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
              from: from, to: to
            });
            updateSel();
            /* Flash feedback on element */
            var origOutline = target.style.outline;
            target.style.outline = '2px solid rgba(59,130,246,0.6)';
            setTimeout(function() { target.style.outline = origOutline || ''; }, 150);
          }
          emit('VOLTRON_STYLE_APPLIED', { selector: getSelector(target), styles: to });
        })();
        break;

      /* ═══ TEXT EDITING (from context menu "Edit Text") ═══ */
      case 'VOLTRON_EDIT_TEXT':
        (function() {
          var target = null;
          if (d.selector) target = document.querySelector(d.selector);
          if (!target) target = S.selected;
          if (!target || d.text == null) return;
          var oldText = target.textContent || '';
          target.textContent = d.text;
          var r = target.getBoundingClientRect();
          addEdit({
            id: uid(), type: 'retext', selector: getSelector(target),
            desc: 'Text: ' + d.text.substring(0, 60),
            coords: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            from: { text: oldText }, to: { text: d.text }
          });
          updateSel();
          emit('VOLTRON_TEXT_EDITED', { selector: getSelector(target), oldText: oldText, newText: d.text });
        })();
        break;

      /* ═══ DELETE ELEMENT (visual hide + record) ═══ */
      case 'VOLTRON_DELETE_ELEMENT':
        (function() {
          var target = null;
          if (d.selector) target = document.querySelector(d.selector);
          if (!target) target = S.selected;
          if (!target || target === document.body || target === document.documentElement) return;
          var cs = window.getComputedStyle(target);
          var r = target.getBoundingClientRect();
          var oldDisplay = cs.display;
          var oldOpacity = cs.opacity;
          /* Animate out then hide */
          target.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
          target.style.opacity = '0';
          target.style.transform = 'scale(0.95)';
          var sel = getSelector(target);
          setTimeout(function() {
            target.style.display = 'none';
            target.style.transition = '';
            target.style.transform = '';
            if (S.selected === target) { S.selected = null; updateSel(); }
          }, 160);
          addEdit({
            id: uid(), type: 'delete', selector: sel,
            desc: 'Delete: ' + target.tagName.toLowerCase(),
            coords: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            from: { display: oldDisplay, opacity: oldOpacity }, to: { display: 'none' }
          });
          emit('VOLTRON_ELEMENT_DELETED', { selector: sel });
        })();
        break;

      /* ═══ DUPLICATE ELEMENT ═══ */
      case 'VOLTRON_DUPLICATE_ELEMENT':
        (function() {
          var target = null;
          if (d.selector) target = document.querySelector(d.selector);
          if (!target) target = S.selected;
          if (!target || target === document.body || target === document.documentElement) return;
          var clone = target.cloneNode(true);
          /* Remove any voltron internal attributes from clone */
          clone.removeAttribute('id');
          if (target.parentElement) {
            target.parentElement.insertBefore(clone, target.nextSibling);
            /* Animate in */
            clone.style.opacity = '0';
            clone.style.transition = 'opacity 0.2s ease';
            setTimeout(function() { clone.style.opacity = '1'; }, 10);
            setTimeout(function() { clone.style.transition = ''; }, 250);
          }
          var r = target.getBoundingClientRect();
          var cloneSel = getSelector(clone);
          addEdit({
            id: uid(), type: 'duplicate', selector: getSelector(target),
            desc: 'Duplicate: ' + target.tagName.toLowerCase(),
            coords: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            from: null, to: { cloneSelector: cloneSel }
          });
          /* Select the clone */
          S.selected = clone;
          updateSel();
          emit('VOLTRON_ELEMENT_DUPLICATED', { originalSelector: getSelector(target), cloneSelector: cloneSel });
        })();
        break;

      /* ═══ TOGGLE VISIBILITY ═══ */
      case 'VOLTRON_TOGGLE_VISIBILITY':
        (function() {
          var target = null;
          if (d.selector) target = document.querySelector(d.selector);
          if (!target) target = S.selected;
          if (!target) return;
          var cs = window.getComputedStyle(target);
          var isHidden = cs.visibility === 'hidden' || cs.opacity === '0';
          var r = target.getBoundingClientRect();
          if (isHidden) {
            target.style.visibility = 'visible';
            target.style.opacity = '1';
          } else {
            target.style.visibility = 'hidden';
            target.style.opacity = '0';
          }
          addEdit({
            id: uid(), type: 'visibility', selector: getSelector(target),
            desc: (isHidden ? 'Show' : 'Hide') + ': ' + target.tagName.toLowerCase(),
            coords: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            from: { visibility: cs.visibility, opacity: cs.opacity },
            to: { visibility: isHidden ? 'visible' : 'hidden', opacity: isHidden ? '1' : '0' }
          });
          updateSel();
          emit('VOLTRON_VISIBILITY_TOGGLED', { selector: getSelector(target), visible: isHidden });
        })();
        break;

      case 'VOLTRON_SET_TOOL': break;
      case 'VOLTRON_INSPECT_MODE': break;
      case 'VOLTRON_GET_DOM_TREE':
        (function() {
          function buildTree(el, depth) {
            if (depth > 8 || !el || !el.tagName) return null;
            if (el.hasAttribute && el.hasAttribute('data-voltron-editor')) return null;
            var tag = el.tagName.toLowerCase();
            var id = el.id || null;
            var cls = el.className ? (typeof el.className === 'string' ? el.className.split(' ').filter(function(c){return c;}).slice(0,4) : []) : [];
            var rect = null;
            try { var r = el.getBoundingClientRect(); rect = {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}; } catch(e){}
            var ch = [];
            for (var i = 0; i < el.children.length && i < 50; i++) {
              var c = buildTree(el.children[i], depth + 1);
              if (c) ch.push(c);
            }
            return { tag: tag, id: id, classes: cls, children: ch, rect: rect, selector: getSelector(el) };
          }
          var tree = buildTree(document.body, 0);
          emit('VOLTRON_DOM_TREE', { tree: tree });
        })();
        break;
      case 'VOLTRON_REPLAY_EDITS':
        if (d.edits && Array.isArray(d.edits)) {
          for (var ri = 0; ri < d.edits.length; ri++) {
            var re = d.edits[ri];
            if (re && re.selector && re.to) {
              var rel = document.querySelector(re.selector);
              if (rel && re.to) {
                var keys = Object.keys(re.to);
                for (var rk = 0; rk < keys.length; rk++) {
                  try { rel.style[keys[rk]] = re.to[keys[rk]]; } catch(e){}
                }
              }
            }
            addEdit(re);
          }
        }
        break;
    }
  });

  /* ═══ INIT ═══ */
  function initAndBind() {
    init();
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('dblclick', onDblClick, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('keydown', onKeyDown, true);
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initAndBind); }
  else { initAndBind(); }
})();
</script>`;
