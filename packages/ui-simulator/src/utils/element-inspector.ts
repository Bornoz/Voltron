/**
 * Utilities for inspecting DOM elements.
 * Used for extracting computed styles, generating CSS selectors,
 * and calculating element dimensions.
 */

/**
 * Common CSS properties to extract for the property editor.
 */
export const INSPECTABLE_PROPERTIES = [
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
] as const;

export type InspectableProperty = typeof INSPECTABLE_PROPERTIES[number];

/**
 * Generate a CSS selector for an element, working from the host side.
 * This mirrors the logic in InjectedScript but runs in the host context.
 */
export function generateSelector(element: Element): string {
  if (element === document.body) return 'body';
  if (element === document.documentElement) return 'html';

  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    const classes = Array.from(current.classList)
      .filter((c) => !c.match(/^(js-|is-|has-|__)/))
      .slice(0, 2);

    if (classes.length > 0) {
      selector += '.' + classes.map((c) => CSS.escape(c)).join('.');
    }

    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children)
        .filter((s) => s.tagName === current!.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Get computed styles for a set of CSS properties.
 */
export function getComputedStyles(
  element: Element,
  properties: readonly string[] = INSPECTABLE_PROPERTIES,
): Record<string, string> {
  const computed = window.getComputedStyle(element);
  const result: Record<string, string> = {};

  for (const prop of properties) {
    result[prop] = computed.getPropertyValue(prop);
  }

  return result;
}

/**
 * Get the bounding box of an element.
 */
export function getElementBounds(element: Element): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Get the box model dimensions (margin, padding, border) of an element.
 */
export function getBoxModel(element: Element): {
  margin: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
  border: { top: number; right: number; bottom: number; left: number };
  content: { width: number; height: number };
} {
  const computed = window.getComputedStyle(element);

  return {
    margin: {
      top: parseFloat(computed.marginTop) || 0,
      right: parseFloat(computed.marginRight) || 0,
      bottom: parseFloat(computed.marginBottom) || 0,
      left: parseFloat(computed.marginLeft) || 0,
    },
    padding: {
      top: parseFloat(computed.paddingTop) || 0,
      right: parseFloat(computed.paddingRight) || 0,
      bottom: parseFloat(computed.paddingBottom) || 0,
      left: parseFloat(computed.paddingLeft) || 0,
    },
    border: {
      top: parseFloat(computed.borderTopWidth) || 0,
      right: parseFloat(computed.borderRightWidth) || 0,
      bottom: parseFloat(computed.borderBottomWidth) || 0,
      left: parseFloat(computed.borderLeftWidth) || 0,
    },
    content: {
      width: element.clientWidth
        - (parseFloat(computed.paddingLeft) || 0)
        - (parseFloat(computed.paddingRight) || 0),
      height: element.clientHeight
        - (parseFloat(computed.paddingTop) || 0)
        - (parseFloat(computed.paddingBottom) || 0),
    },
  };
}

/**
 * Build the element breadcrumb path (tag#id.class > tag.class > ...).
 */
export function getElementPath(element: Element): string[] {
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    let tag = current.tagName.toLowerCase();
    if (current.id) {
      tag += `#${current.id}`;
    } else if (current.classList.length > 0) {
      tag += '.' + Array.from(current.classList).slice(0, 2).join('.');
    }
    path.unshift(tag);
    current = current.parentElement;
  }

  return path;
}

/**
 * Get all HTML attributes of an element.
 */
export function getElementAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

/**
 * Extract data-* attributes from an element.
 */
export function getDataAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    if (attr.name.startsWith('data-')) {
      attrs[attr.name] = attr.value;
    }
  }
  return attrs;
}
