/**
 * CSS value parsing utilities.
 * Handles common CSS value formats: colors, dimensions, shorthand properties.
 */

export interface ParsedDimension {
  value: number;
  unit: string;
}

export interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a: number;
  format: 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'named';
  original: string;
}

export interface ParsedBoxModel {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

/**
 * Parse a CSS dimension value (e.g., "16px", "1.5rem", "100%", "auto").
 */
export function parseDimension(value: string): ParsedDimension | null {
  if (!value || value === 'auto' || value === 'none' || value === 'initial' || value === 'inherit') {
    return null;
  }

  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*(px|em|rem|%|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pt|pc)$/);
  if (!match) return null;

  return {
    value: parseFloat(match[1]),
    unit: match[2],
  };
}

/**
 * Format a dimension back to CSS string.
 */
export function formatDimension(value: number, unit: string): string {
  if (unit === 'px') {
    return `${Math.round(value)}px`;
  }
  return `${Number(value.toFixed(2))}${unit}`;
}

/**
 * Check if a CSS value represents a color.
 */
export function isColorValue(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();

  // Hex
  if (/^#([0-9a-f]{3,8})$/.test(trimmed)) return true;
  // RGB/RGBA
  if (/^rgba?\(/.test(trimmed)) return true;
  // HSL/HSLA
  if (/^hsla?\(/.test(trimmed)) return true;
  // Named colors (common ones)
  const namedColors = new Set([
    'transparent', 'currentcolor', 'black', 'white', 'red', 'green', 'blue',
    'yellow', 'orange', 'purple', 'pink', 'cyan', 'magenta', 'gray', 'grey',
    'silver', 'gold', 'navy', 'teal', 'maroon', 'olive', 'lime', 'aqua',
    'fuchsia', 'indigo', 'violet', 'coral', 'salmon', 'tomato', 'crimson',
  ]);
  return namedColors.has(trimmed);
}

/**
 * Parse shorthand margin/padding values into individual sides.
 * Handles 1-value, 2-value, 3-value, and 4-value shorthands.
 */
export function parseBoxShorthand(value: string): ParsedBoxModel {
  if (!value || value === 'auto') {
    return { top: '0px', right: '0px', bottom: '0px', left: '0px' };
  }

  const parts = value.trim().split(/\s+/);

  switch (parts.length) {
    case 1:
      return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    case 2:
      return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    case 3:
      return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
    case 4:
      return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
    default:
      return { top: '0px', right: '0px', bottom: '0px', left: '0px' };
  }
}

/**
 * Format box model values back to shorthand.
 */
export function formatBoxShorthand(box: ParsedBoxModel): string {
  if (box.top === box.right && box.right === box.bottom && box.bottom === box.left) {
    return box.top;
  }
  if (box.top === box.bottom && box.right === box.left) {
    return `${box.top} ${box.right}`;
  }
  if (box.right === box.left) {
    return `${box.top} ${box.right} ${box.bottom}`;
  }
  return `${box.top} ${box.right} ${box.bottom} ${box.left}`;
}

/**
 * Get the numeric value from a CSS value, stripping the unit.
 */
export function getNumericValue(value: string): number | null {
  const parsed = parseDimension(value);
  return parsed ? parsed.value : null;
}

/**
 * List of CSS properties grouped by category for the property editor.
 */
export const CSS_PROPERTY_GROUPS: Record<string, string[]> = {
  'Typography': [
    'color', 'font-size', 'font-weight', 'font-family', 'line-height',
    'text-align', 'text-decoration', 'letter-spacing', 'text-transform',
  ],
  'Background': [
    'background-color', 'background', 'background-image',
    'background-size', 'background-position', 'background-repeat',
  ],
  'Spacing': [
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  ],
  'Size': [
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  ],
  'Border': [
    'border', 'border-radius', 'border-color', 'border-width',
    'border-style',
  ],
  'Layout': [
    'display', 'position', 'top', 'right', 'bottom', 'left',
    'flex-direction', 'justify-content', 'align-items', 'gap',
    'z-index', 'overflow',
  ],
  'Effects': [
    'opacity', 'box-shadow', 'transition', 'transform', 'cursor', 'visibility',
  ],
};

/**
 * Get the category for a CSS property.
 */
export function getPropertyCategory(property: string): string {
  for (const [category, props] of Object.entries(CSS_PROPERTY_GROUPS)) {
    if (props.includes(property)) return category;
  }
  return 'Other';
}

/**
 * Check if a CSS property typically accepts color values.
 */
export function isColorProperty(property: string): boolean {
  const colorProps = new Set([
    'color', 'background-color', 'border-color', 'border-top-color',
    'border-right-color', 'border-bottom-color', 'border-left-color',
    'outline-color', 'text-decoration-color', 'column-rule-color',
    'caret-color', 'accent-color',
  ]);
  return colorProps.has(property);
}
