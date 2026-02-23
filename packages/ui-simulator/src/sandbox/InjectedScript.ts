/**
 * InjectedScript - JavaScript source code that gets injected into the sandboxed iframe.
 * This script sets up:
 * - MutationObserver for DOM change tracking
 * - Click interception for element selection mode
 * - Message handlers for INJECT_STYLES, UPDATE_LAYOUT, UPDATE_PROPS
 * - Drag & drop for element repositioning
 * - Element add/delete/duplicate operations
 * - Floating toolbar on selected elements
 * - Design snapshot serialization
 * - Outbound messages: ELEMENT_SELECTED, DOM_MUTATED, STATE_SNAPSHOT, etc.
 * - CSS selector generation and computed style extraction
 */
export const INJECTED_SCRIPT = `
(function() {
  'use strict';

  // Prevent double-injection
  if (window.__voltronInjected) return;
  window.__voltronInjected = true;

  let selectionMode = false;
  let hoverOverlay = null;
  let mutationObserver = null;

  // ── Drag State ──
  let dragMode = false;
  let dragElement = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOrigLeft = 0;
  let dragOrigTop = 0;
  let dragOrigPosition = '';

  // ── Change Tracking (for design snapshots) ──
  var addedElements = [];
  var deletedElements = [];
  var movedElements = [];
  var styleChanges = [];

  // ---------- Utilities ----------

  /**
   * Generate a unique CSS selector for an element.
   */
  function generateSelector(el) {
    if (!el || el === document.body || el === document.documentElement) {
      return el ? el.tagName.toLowerCase() : 'body';
    }

    // ID selector (most specific)
    if (el.id && el.id.indexOf('__voltron') === -1) {
      return '#' + CSS.escape(el.id);
    }

    // Build path-based selector
    var parts = [];
    var current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      var selector = current.tagName.toLowerCase();

      if (current.id && current.id.indexOf('__voltron') === -1) {
        selector = '#' + CSS.escape(current.id);
        parts.unshift(selector);
        break;
      }

      // Add meaningful classes (filter out dynamic/generated ones)
      var classes = Array.from(current.classList || [])
        .filter(function(c) { return !c.match(/^(js-|is-|has-|__)/); })
        .slice(0, 2);
      if (classes.length > 0) {
        selector += '.' + classes.map(function(c) { return CSS.escape(c); }).join('.');
      }

      // Add nth-child if needed for uniqueness
      if (current.parentElement) {
        var siblings = Array.from(current.parentElement.children)
          .filter(function(s) { return s.tagName === current.tagName; });
        if (siblings.length > 1) {
          var index = siblings.indexOf(current) + 1;
          selector += ':nth-child(' + index + ')';
        }
      }

      parts.unshift(selector);
      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  /**
   * Generate the element path (breadcrumb).
   */
  function getElementPath(el) {
    var path = [];
    var current = el;
    while (current && current !== document.documentElement) {
      var tag = current.tagName.toLowerCase();
      if (current.id) {
        tag += '#' + current.id;
      } else if (current.classList.length > 0) {
        tag += '.' + Array.from(current.classList).slice(0, 2).join('.');
      }
      path.unshift(tag);
      current = current.parentElement;
    }
    return path;
  }

  /**
   * Extract computed styles for common CSS properties.
   */
  function getComputedStylesForElement(el) {
    var computed = window.getComputedStyle(el);
    var props = [
      'color', 'background-color', 'background',
      'font-size', 'font-weight', 'font-family', 'line-height',
      'text-align', 'text-decoration',
      'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
      'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'border', 'border-radius', 'border-color', 'border-width',
      'display', 'position', 'top', 'right', 'bottom', 'left',
      'flex-direction', 'justify-content', 'align-items', 'gap',
      'opacity', 'overflow', 'z-index', 'box-shadow',
      'transition', 'transform', 'cursor', 'visibility',
    ];
    var result = {};
    for (var i = 0; i < props.length; i++) {
      result[props[i]] = computed.getPropertyValue(props[i]);
    }
    return result;
  }

  /**
   * Get all HTML attributes of an element.
   */
  function getAttributes(el) {
    var attrs = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var attr = el.attributes[i];
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  /**
   * Check if an element is a Voltron internal element.
   */
  function isVoltronElement(el) {
    if (!el) return false;
    if (el.id && el.id.indexOf('__voltron') === 0) return true;
    var current = el;
    while (current) {
      if (current.id && current.id.indexOf('__voltron') === 0) return true;
      current = current.parentElement;
    }
    return false;
  }

  /**
   * Send a message to the parent window.
   */
  function sendToHost(type, payload) {
    window.parent.postMessage({
      source: 'voltron-iframe',
      type: type,
      payload: payload,
      timestamp: Date.now(),
      id: 'iframe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    }, '*');
  }

  // ---------- Hover Overlay ----------

  function createHoverOverlay() {
    if (hoverOverlay) return;
    hoverOverlay = document.createElement('div');
    hoverOverlay.id = '__voltron-hover-overlay';
    hoverOverlay.style.cssText = [
      'position: fixed',
      'pointer-events: none',
      'border: 2px solid #3b82f6',
      'background: rgba(59, 130, 246, 0.1)',
      'z-index: 2147483646',
      'transition: all 0.1s ease',
      'display: none',
    ].join(';');
    document.body.appendChild(hoverOverlay);
  }

  function showOverlay(el) {
    if (!hoverOverlay) createHoverOverlay();
    var rect = el.getBoundingClientRect();
    hoverOverlay.style.top = rect.top + 'px';
    hoverOverlay.style.left = rect.left + 'px';
    hoverOverlay.style.width = rect.width + 'px';
    hoverOverlay.style.height = rect.height + 'px';
    hoverOverlay.style.display = 'block';
  }

  function hideOverlay() {
    if (hoverOverlay) {
      hoverOverlay.style.display = 'none';
    }
  }

  // ---------- Floating Toolbar ----------

  var elementToolbar = null;
  var toolbarTarget = null;

  function createToolbar() {
    if (elementToolbar) return;
    elementToolbar = document.createElement('div');
    elementToolbar.id = '__voltron-element-toolbar';
    elementToolbar.style.cssText = [
      'position: fixed',
      'display: none',
      'z-index: 2147483647',
      'background: rgba(17, 17, 27, 0.92)',
      'backdrop-filter: blur(8px)',
      'border: 1px solid rgba(139, 92, 246, 0.3)',
      'border-radius: 8px',
      'padding: 4px',
      'gap: 2px',
      'flex-direction: row',
      'align-items: center',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.4)',
      'font-family: system-ui, -apple-system, sans-serif',
    ].join(';');

    var buttons = [
      { action: 'move', label: '\\u2725', title: 'Move (drag)' },
      { action: 'duplicate', label: '\\u2398', title: 'Duplicate' },
      { action: 'delete', label: '\\u2715', title: 'Delete' },
    ];

    buttons.forEach(function(btn) {
      var b = document.createElement('button');
      b.textContent = btn.label;
      b.title = btn.title;
      b.dataset.action = btn.action;
      b.style.cssText = [
        'background: transparent',
        'border: none',
        'color: #e2e8f0',
        'cursor: pointer',
        'padding: 4px 8px',
        'border-radius: 4px',
        'font-size: 14px',
        'line-height: 1',
        'transition: background 0.15s',
      ].join(';');
      b.addEventListener('mouseenter', function() {
        b.style.background = 'rgba(139, 92, 246, 0.3)';
      });
      b.addEventListener('mouseleave', function() {
        b.style.background = 'transparent';
      });
      b.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (toolbarTarget) {
          sendToHost('TOOLBAR_ACTION', {
            action: btn.action,
            selector: generateSelector(toolbarTarget),
          });
          if (btn.action === 'move') {
            enableDragOnElement(toolbarTarget);
          } else if (btn.action === 'duplicate') {
            duplicateElement(toolbarTarget);
          } else if (btn.action === 'delete') {
            deleteElement(toolbarTarget);
          }
        }
      });
      elementToolbar.appendChild(b);
    });

    document.body.appendChild(elementToolbar);
  }

  function showToolbar(el) {
    if (!el || isVoltronElement(el)) return;
    createToolbar();
    toolbarTarget = el;
    var rect = el.getBoundingClientRect();
    elementToolbar.style.display = 'flex';
    elementToolbar.style.top = Math.max(0, rect.top - 36) + 'px';
    elementToolbar.style.left = rect.left + 'px';
  }

  function hideToolbar() {
    if (elementToolbar) {
      elementToolbar.style.display = 'none';
    }
    toolbarTarget = null;
  }

  // ---------- Drag & Drop System ----------

  function enableDragOnElement(el) {
    if (!el || isVoltronElement(el)) return;
    dragMode = true;
    dragElement = el;
    el.style.cursor = 'grabbing';
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }

  function startDrag(el, clientX, clientY) {
    dragElement = el;
    dragStartX = clientX;
    dragStartY = clientY;

    var computed = window.getComputedStyle(el);
    dragOrigPosition = computed.position;

    // Make static elements relative so they can be moved
    if (dragOrigPosition === 'static') {
      el.style.position = 'relative';
    }

    dragOrigLeft = parseFloat(computed.left) || 0;
    dragOrigTop = parseFloat(computed.top) || 0;

    el.style.cursor = 'grabbing';
    el.style.zIndex = '10000';
    el.style.opacity = '0.85';
    el.style.transition = 'none';
  }

  function handleDragMove(e) {
    if (!dragElement) return;
    e.preventDefault();

    var dx = e.clientX - dragStartX;
    var dy = e.clientY - dragStartY;

    dragElement.style.left = (dragOrigLeft + dx) + 'px';
    dragElement.style.top = (dragOrigTop + dy) + 'px';
  }

  function handleDragEnd(e) {
    if (!dragElement) return;

    var dx = e.clientX - dragStartX;
    var dy = e.clientY - dragStartY;

    dragElement.style.cursor = '';
    dragElement.style.zIndex = '';
    dragElement.style.opacity = '';
    dragElement.style.transition = '';

    var selector = generateSelector(dragElement);

    // Track for design snapshot
    movedElements.push({
      selector: selector,
      deltaX: dx,
      deltaY: dy,
    });

    sendToHost('ELEMENT_MOVED', {
      selector: selector,
      from: { x: dragOrigLeft, y: dragOrigTop },
      to: { x: dragOrigLeft + dx, y: dragOrigTop + dy },
      deltaX: dx,
      deltaY: dy,
    });

    dragElement = null;
    dragMode = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  document.addEventListener('mousemove', function(e) {
    if (dragElement) {
      handleDragMove(e);
    }
  }, true);

  document.addEventListener('mouseup', function(e) {
    if (dragElement) {
      handleDragEnd(e);
    }
  }, true);

  // ---------- Element Operations ----------

  function addElement(config) {
    var parent = document.querySelector(config.parentSelector);
    if (!parent) return;

    var el = document.createElement(config.tagName);
    el.setAttribute('data-voltron-added', 'true');

    if (config.attributes) {
      for (var key in config.attributes) {
        el.setAttribute(key, config.attributes[key]);
      }
    }
    if (config.styles) {
      for (var prop in config.styles) {
        el.style.setProperty(prop, config.styles[prop]);
      }
    }
    if (config.innerHTML) {
      el.innerHTML = config.innerHTML;
    } else if (config.textContent) {
      el.textContent = config.textContent;
    }

    switch (config.position) {
      case 'prepend':
        parent.prepend(el);
        break;
      case 'before':
        parent.parentElement && parent.parentElement.insertBefore(el, parent);
        break;
      case 'after':
        parent.parentElement && parent.parentElement.insertBefore(el, parent.nextSibling);
        break;
      default: // append
        parent.appendChild(el);
    }

    var selector = generateSelector(el);
    addedElements.push({
      selector: selector,
      html: el.outerHTML,
      parentSelector: config.parentSelector,
    });

    sendToHost('ELEMENT_ADDED', {
      selector: selector,
      tagName: config.tagName,
      parentSelector: config.parentSelector,
      html: el.outerHTML,
    });
  }

  function deleteElement(el) {
    if (!el || isVoltronElement(el) || el === document.body || el === document.documentElement) return;

    var selector = generateSelector(el);
    var parentSelector = el.parentElement ? generateSelector(el.parentElement) : 'body';
    var indexInParent = el.parentElement ? Array.from(el.parentElement.children).indexOf(el) : 0;
    var outerHTML = el.outerHTML;

    deletedElements.push({
      selector: selector,
      outerHTML: outerHTML,
      parentSelector: parentSelector,
    });

    el.remove();
    hideToolbar();

    sendToHost('ELEMENT_DELETED', {
      selector: selector,
      outerHTML: outerHTML,
      parentSelector: parentSelector,
      indexInParent: indexInParent,
    });
  }

  function duplicateElement(el) {
    if (!el || isVoltronElement(el) || el === document.body || el === document.documentElement) return;

    var clone = el.cloneNode(true);
    clone.setAttribute('data-voltron-added', 'true');
    // Remove ID to avoid duplication
    clone.removeAttribute('id');

    // Offset the clone slightly
    var computed = window.getComputedStyle(el);
    if (computed.position === 'static') {
      clone.style.position = 'relative';
    }
    clone.style.top = '8px';
    clone.style.left = '8px';

    el.parentElement.insertBefore(clone, el.nextSibling);

    var originalSelector = generateSelector(el);
    var newSelector = generateSelector(clone);

    addedElements.push({
      selector: newSelector,
      html: clone.outerHTML,
      parentSelector: generateSelector(el.parentElement),
    });

    sendToHost('ELEMENT_DUPLICATED', {
      originalSelector: originalSelector,
      newSelector: newSelector,
      html: clone.outerHTML,
    });
  }

  // ---------- Element Selection ----------

  function handleMouseOver(e) {
    if (!selectionMode || dragElement) return;
    var target = e.target;
    if (isVoltronElement(target)) return;
    showOverlay(target);
  }

  function handleMouseOut() {
    if (!selectionMode || dragElement) return;
    hideOverlay();
  }

  function handleClick(e) {
    if (!selectionMode || dragElement) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var target = e.target;
    if (isVoltronElement(target)) return;

    var rect = target.getBoundingClientRect();

    sendToHost('ELEMENT_SELECTED', {
      selector: generateSelector(target),
      tagName: target.tagName.toLowerCase(),
      id: target.id || '',
      classList: Array.from(target.classList || []),
      computedStyles: getComputedStylesForElement(target),
      bounds: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      textContent: (target.textContent || '').trim().substring(0, 200),
      attributes: getAttributes(target),
      parentSelector: target.parentElement ? generateSelector(target.parentElement) : null,
      childCount: target.children.length,
      elementPath: getElementPath(target),
    });

    // Show toolbar on selected element
    showToolbar(target);
  }

  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('click', handleClick, true);

  // ---------- MutationObserver ----------

  function setupMutationObserver() {
    if (mutationObserver) mutationObserver.disconnect();

    mutationObserver = new MutationObserver(function(mutations) {
      var mutationRecords = [];
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        // Skip Voltron internal element changes
        if (m.target && isVoltronElement(m.target)) continue;

        // Check added/removed nodes for voltron elements
        var hasVoltronChild = false;
        for (var j = 0; j < m.addedNodes.length; j++) {
          if (isVoltronElement(m.addedNodes[j])) { hasVoltronChild = true; break; }
        }
        for (var k = 0; k < m.removedNodes.length; k++) {
          if (isVoltronElement(m.removedNodes[k])) { hasVoltronChild = true; break; }
        }
        if (hasVoltronChild && m.addedNodes.length + m.removedNodes.length <= 1) continue;

        mutationRecords.push({
          type: m.type,
          target: m.target && m.target.nodeType === 1 ? generateSelector(m.target) : 'text-node',
          addedNodes: m.addedNodes.length,
          removedNodes: m.removedNodes.length,
          attributeName: m.attributeName || undefined,
          oldValue: m.oldValue || undefined,
          newValue: m.attributeName && m.target.nodeType === 1
            ? m.target.getAttribute(m.attributeName)
            : undefined,
        });
      }

      if (mutationRecords.length > 0) {
        sendToHost('DOM_MUTATED', { mutations: mutationRecords });
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      characterData: true,
    });
  }

  // ---------- Design Snapshot ----------

  function buildDesignSnapshot() {
    return {
      addedElements: addedElements.slice(),
      deletedElements: deletedElements.slice(),
      movedElements: movedElements.slice(),
      styleChanges: styleChanges.slice(),
      timestamp: Date.now(),
    };
  }

  // ---------- Message Handlers ----------

  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || data.source !== 'voltron-host') return;

    switch (data.type) {
      case 'INJECT_STYLES': {
        var p = data.payload;
        var targets = document.querySelectorAll(p.selector);
        for (var i = 0; i < targets.length; i++) {
          // Track style changes for snapshot
          var oldVal = targets[i].style.getPropertyValue(p.property);
          targets[i].style.setProperty(p.property, p.value);
          styleChanges.push({
            selector: p.selector,
            property: p.property,
            oldValue: oldVal,
            newValue: p.value,
          });
        }
        sendToHost('STYLE_APPLIED', {
          selector: p.selector,
          property: p.property,
          value: p.value,
          success: targets.length > 0,
        });
        break;
      }

      case 'UPDATE_LAYOUT': {
        var lp = data.payload;
        var layoutTargets = document.querySelectorAll(lp.selector);
        for (var j = 0; j < layoutTargets.length; j++) {
          var el = layoutTargets[j];
          var changes = lp.changes;
          if (changes.width) el.style.width = changes.width;
          if (changes.height) el.style.height = changes.height;
          if (changes.top) el.style.top = changes.top;
          if (changes.left) el.style.left = changes.left;
          if (changes.position) el.style.position = changes.position;
        }
        var lrect = layoutTargets[0] ? layoutTargets[0].getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 };
        sendToHost('LAYOUT_APPLIED', {
          selector: lp.selector,
          bounds: { x: lrect.x, y: lrect.y, width: lrect.width, height: lrect.height },
          success: layoutTargets.length > 0,
        });
        break;
      }

      case 'UPDATE_PROPS': {
        var pp = data.payload;
        var propTargets = document.querySelectorAll(pp.selector);
        for (var k = 0; k < propTargets.length; k++) {
          var pel = propTargets[k];
          var attrs = pp.attributes;
          for (var name in attrs) {
            if (name === 'textContent') {
              pel.textContent = attrs[name];
            } else if (attrs[name] === null || attrs[name] === '') {
              pel.removeAttribute(name);
            } else {
              pel.setAttribute(name, attrs[name]);
            }
          }
        }
        break;
      }

      case 'REQUEST_SNAPSHOT': {
        var styles = {};
        var allElements = document.querySelectorAll('[style]');
        for (var s = 0; s < allElements.length; s++) {
          if (isVoltronElement(allElements[s])) continue;
          var sel = generateSelector(allElements[s]);
          styles[sel] = getComputedStylesForElement(allElements[s]);
        }
        sendToHost('STATE_SNAPSHOT', {
          html: document.documentElement.outerHTML,
          styles: styles,
          viewport: { width: window.innerWidth, height: window.innerHeight },
        });
        break;
      }

      case 'SELECT_ELEMENT': {
        selectionMode = !!data.payload.enabled;
        if (selectionMode) {
          createHoverOverlay();
          document.body.style.cursor = 'crosshair';
        } else {
          hideOverlay();
          hideToolbar();
          document.body.style.cursor = '';
        }
        break;
      }

      case 'ENABLE_DRAG_MODE': {
        dragMode = !!data.payload.enabled;
        if (!dragMode) {
          dragElement = null;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
        break;
      }

      case 'ADD_ELEMENT': {
        addElement(data.payload);
        break;
      }

      case 'DELETE_ELEMENT': {
        var delTarget = document.querySelector(data.payload.selector);
        if (delTarget) deleteElement(delTarget);
        break;
      }

      case 'DUPLICATE_ELEMENT': {
        var dupTarget = document.querySelector(data.payload.selector);
        if (dupTarget) duplicateElement(dupTarget);
        break;
      }

      case 'SHOW_ELEMENT_TOOLBAR': {
        if (data.payload.selector) {
          var tbTarget = document.querySelector(data.payload.selector);
          if (tbTarget) showToolbar(tbTarget);
        } else {
          hideToolbar();
        }
        break;
      }

      case 'REQUEST_DESIGN_SNAPSHOT': {
        sendToHost('DESIGN_SNAPSHOT', buildDesignSnapshot());
        // Clear tracked changes after sending
        addedElements = [];
        deletedElements = [];
        movedElements = [];
        styleChanges = [];
        break;
      }
    }
  });

  // ---------- Init ----------

  setupMutationObserver();
  createHoverOverlay();
  selectionMode = true;

  sendToHost('BRIDGE_READY', { timestamp: Date.now() });
})();
`;
