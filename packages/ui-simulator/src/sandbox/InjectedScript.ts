/**
 * InjectedScript - JavaScript source code that gets injected into the sandboxed iframe.
 * This script sets up:
 * - MutationObserver for DOM change tracking
 * - Click interception for element selection mode
 * - Message handlers for INJECT_STYLES, UPDATE_LAYOUT, UPDATE_PROPS
 * - Outbound messages: ELEMENT_SELECTED, DOM_MUTATED, STATE_SNAPSHOT
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

  // ---------- Utilities ----------

  /**
   * Generate a unique CSS selector for an element.
   */
  function generateSelector(el) {
    if (!el || el === document.body || el === document.documentElement) {
      return el ? el.tagName.toLowerCase() : 'body';
    }

    // ID selector (most specific)
    if (el.id) {
      return '#' + CSS.escape(el.id);
    }

    // Build path-based selector
    const parts = [];
    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = '#' + CSS.escape(current.id);
        parts.unshift(selector);
        break;
      }

      // Add meaningful classes (filter out dynamic/generated ones)
      const classes = Array.from(current.classList || [])
        .filter(function(c) { return !c.match(/^(js-|is-|has-|__)/); })
        .slice(0, 2);
      if (classes.length > 0) {
        selector += '.' + classes.map(function(c) { return CSS.escape(c); }).join('.');
      }

      // Add nth-child if needed for uniqueness
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children)
          .filter(function(s) { return s.tagName === current.tagName; });
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
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
      'z-index: 2147483647',
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

  // ---------- Element Selection ----------

  function handleMouseOver(e) {
    if (!selectionMode) return;
    var target = e.target;
    if (target.id === '__voltron-hover-overlay') return;
    showOverlay(target);
  }

  function handleMouseOut() {
    if (!selectionMode) return;
    hideOverlay();
  }

  function handleClick(e) {
    if (!selectionMode) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var target = e.target;
    if (target.id === '__voltron-hover-overlay') return;

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
        // Skip our own overlay changes
        if (m.target && m.target.id === '__voltron-hover-overlay') continue;

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

  // ---------- Message Handlers ----------

  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || data.source !== 'voltron-host') return;

    switch (data.type) {
      case 'INJECT_STYLES': {
        var p = data.payload;
        var targets = document.querySelectorAll(p.selector);
        for (var i = 0; i < targets.length; i++) {
          targets[i].style.setProperty(p.property, p.value);
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
          document.body.style.cursor = '';
        }
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
