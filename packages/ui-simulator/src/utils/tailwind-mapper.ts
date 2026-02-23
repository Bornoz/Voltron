/**
 * Tailwind CSS <-> raw CSS mapping utilities.
 * Maps common CSS values to Tailwind v4 classes and vice versa.
 */

// Spacing scale (Tailwind default, in px)
const SPACING_SCALE: Record<string, string> = {
  '0': '0px', '0.5': '2px', '1': '4px', '1.5': '6px',
  '2': '8px', '2.5': '10px', '3': '12px', '3.5': '14px',
  '4': '16px', '5': '20px', '6': '24px', '7': '28px',
  '8': '32px', '9': '36px', '10': '40px', '11': '44px',
  '12': '48px', '14': '56px', '16': '64px', '20': '80px',
  '24': '96px', '28': '112px', '32': '128px', '36': '144px',
  '40': '160px', '44': '176px', '48': '192px', '52': '208px',
  '56': '224px', '60': '240px', '64': '256px', '72': '288px',
  '80': '320px', '96': '384px',
};

const SPACING_REVERSE = new Map<string, string>();
for (const [key, val] of Object.entries(SPACING_SCALE)) {
  SPACING_REVERSE.set(val, key);
}

// Font size scale
const FONT_SIZE_SCALE: Record<string, string> = {
  'xs': '12px', 'sm': '14px', 'base': '16px', 'lg': '18px',
  'xl': '20px', '2xl': '24px', '3xl': '30px', '4xl': '36px',
  '5xl': '48px', '6xl': '60px', '7xl': '72px', '8xl': '96px', '9xl': '128px',
};

const FONT_SIZE_REVERSE = new Map<string, string>();
for (const [key, val] of Object.entries(FONT_SIZE_SCALE)) {
  FONT_SIZE_REVERSE.set(val, key);
}

// Font weight scale
const FONT_WEIGHT_SCALE: Record<string, string> = {
  'thin': '100', 'extralight': '200', 'light': '300', 'normal': '400',
  'medium': '500', 'semibold': '600', 'bold': '700', 'extrabold': '800', 'black': '900',
};

const FONT_WEIGHT_REVERSE = new Map<string, string>();
for (const [key, val] of Object.entries(FONT_WEIGHT_SCALE)) {
  FONT_WEIGHT_REVERSE.set(val, key);
}

// Border radius scale
const BORDER_RADIUS_SCALE: Record<string, string> = {
  'none': '0px', 'sm': '2px', '': '4px', 'md': '6px',
  'lg': '8px', 'xl': '12px', '2xl': '16px', '3xl': '24px', 'full': '9999px',
};

const BORDER_RADIUS_REVERSE = new Map<string, string>();
for (const [key, val] of Object.entries(BORDER_RADIUS_SCALE)) {
  BORDER_RADIUS_REVERSE.set(val, key);
}

// Display values
const DISPLAY_MAP: Record<string, string> = {
  'block': 'block', 'inline-block': 'inline-block', 'inline': 'inline',
  'flex': 'flex', 'inline-flex': 'inline-flex', 'grid': 'grid',
  'inline-grid': 'inline-grid', 'none': 'hidden',
  'table': 'table', 'table-row': 'table-row', 'table-cell': 'table-cell',
};

// Position values
const POSITION_MAP: Record<string, string> = {
  'static': 'static', 'fixed': 'fixed', 'absolute': 'absolute',
  'relative': 'relative', 'sticky': 'sticky',
};

// Flex direction
const FLEX_DIRECTION_MAP: Record<string, string> = {
  'row': 'flex-row', 'row-reverse': 'flex-row-reverse',
  'column': 'flex-col', 'column-reverse': 'flex-col-reverse',
};

// Justify content
const JUSTIFY_CONTENT_MAP: Record<string, string> = {
  'normal': 'justify-normal', 'flex-start': 'justify-start', 'flex-end': 'justify-end',
  'center': 'justify-center', 'space-between': 'justify-between',
  'space-around': 'justify-around', 'space-evenly': 'justify-evenly',
  'stretch': 'justify-stretch',
};

// Align items
const ALIGN_ITEMS_MAP: Record<string, string> = {
  'flex-start': 'items-start', 'flex-end': 'items-end',
  'center': 'items-center', 'baseline': 'items-baseline',
  'stretch': 'items-stretch',
};

/**
 * Convert a CSS property+value pair to the corresponding Tailwind class.
 * Returns null if no mapping exists.
 */
export function cssToTailwind(property: string, value: string): string | null {
  const trimValue = value.trim();

  switch (property) {
    // Display
    case 'display':
      return DISPLAY_MAP[trimValue] ?? null;

    // Position
    case 'position':
      return POSITION_MAP[trimValue] ?? null;

    // Flex direction
    case 'flex-direction':
      return FLEX_DIRECTION_MAP[trimValue] ?? null;

    // Justify content
    case 'justify-content':
      return JUSTIFY_CONTENT_MAP[trimValue] ?? null;

    // Align items
    case 'align-items':
      return ALIGN_ITEMS_MAP[trimValue] ?? null;

    // Font size
    case 'font-size': {
      const fsKey = FONT_SIZE_REVERSE.get(trimValue);
      return fsKey ? `text-${fsKey}` : null;
    }

    // Font weight
    case 'font-weight': {
      const fwKey = FONT_WEIGHT_REVERSE.get(trimValue);
      return fwKey ? `font-${fwKey}` : null;
    }

    // Border radius
    case 'border-radius': {
      const brKey = BORDER_RADIUS_REVERSE.get(trimValue);
      if (brKey === undefined) return null;
      return brKey === '' ? 'rounded' : `rounded-${brKey}`;
    }

    // Width
    case 'width': {
      const wKey = SPACING_REVERSE.get(trimValue);
      if (wKey) return `w-${wKey}`;
      if (trimValue === '100%') return 'w-full';
      if (trimValue === 'auto') return 'w-auto';
      if (trimValue === '100vw') return 'w-screen';
      return null;
    }

    // Height
    case 'height': {
      const hKey = SPACING_REVERSE.get(trimValue);
      if (hKey) return `h-${hKey}`;
      if (trimValue === '100%') return 'h-full';
      if (trimValue === 'auto') return 'h-auto';
      if (trimValue === '100vh') return 'h-screen';
      return null;
    }

    // Margin
    case 'margin-top': {
      const mtKey = SPACING_REVERSE.get(trimValue);
      return mtKey ? `mt-${mtKey}` : null;
    }
    case 'margin-right': {
      const mrKey = SPACING_REVERSE.get(trimValue);
      return mrKey ? `mr-${mrKey}` : null;
    }
    case 'margin-bottom': {
      const mbKey = SPACING_REVERSE.get(trimValue);
      return mbKey ? `mb-${mbKey}` : null;
    }
    case 'margin-left': {
      const mlKey = SPACING_REVERSE.get(trimValue);
      return mlKey ? `ml-${mlKey}` : null;
    }

    // Padding
    case 'padding-top': {
      const ptKey = SPACING_REVERSE.get(trimValue);
      return ptKey ? `pt-${ptKey}` : null;
    }
    case 'padding-right': {
      const prKey = SPACING_REVERSE.get(trimValue);
      return prKey ? `pr-${prKey}` : null;
    }
    case 'padding-bottom': {
      const pbKey = SPACING_REVERSE.get(trimValue);
      return pbKey ? `pb-${pbKey}` : null;
    }
    case 'padding-left': {
      const plKey = SPACING_REVERSE.get(trimValue);
      return plKey ? `pl-${plKey}` : null;
    }

    // Gap
    case 'gap': {
      const gKey = SPACING_REVERSE.get(trimValue);
      return gKey ? `gap-${gKey}` : null;
    }

    // Opacity
    case 'opacity': {
      const pct = Math.round(parseFloat(trimValue) * 100);
      if ([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100].includes(pct)) {
        return `opacity-${pct}`;
      }
      return null;
    }

    // Text align
    case 'text-align':
      if (['left', 'center', 'right', 'justify', 'start', 'end'].includes(trimValue)) {
        return `text-${trimValue}`;
      }
      return null;

    // Overflow
    case 'overflow':
      if (['auto', 'hidden', 'visible', 'scroll', 'clip'].includes(trimValue)) {
        return `overflow-${trimValue}`;
      }
      return null;

    // Cursor
    case 'cursor':
      if (['auto', 'default', 'pointer', 'wait', 'text', 'move', 'not-allowed', 'crosshair', 'grab', 'grabbing'].includes(trimValue)) {
        return `cursor-${trimValue}`;
      }
      return null;

    default:
      return null;
  }
}

/**
 * Convert a Tailwind class to a CSS property+value pair.
 * Returns null if not recognized.
 */
export function tailwindToCss(className: string): { property: string; value: string } | null {
  const cls = className.trim();

  // Display
  for (const [cssVal, twCls] of Object.entries(DISPLAY_MAP)) {
    if (cls === twCls) return { property: 'display', value: cssVal };
  }

  // Position
  for (const [cssVal, twCls] of Object.entries(POSITION_MAP)) {
    if (cls === twCls) return { property: 'position', value: cssVal };
  }

  // Text size
  const textSizeMatch = cls.match(/^text-(xs|sm|base|lg|xl|[2-9]xl)$/);
  if (textSizeMatch) {
    const size = FONT_SIZE_SCALE[textSizeMatch[1]];
    if (size) return { property: 'font-size', value: size };
  }

  // Font weight
  const fontWeightMatch = cls.match(/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/);
  if (fontWeightMatch) {
    const weight = FONT_WEIGHT_SCALE[fontWeightMatch[1]];
    if (weight) return { property: 'font-weight', value: weight };
  }

  // Width
  const widthMatch = cls.match(/^w-(.+)$/);
  if (widthMatch) {
    if (widthMatch[1] === 'full') return { property: 'width', value: '100%' };
    if (widthMatch[1] === 'auto') return { property: 'width', value: 'auto' };
    if (widthMatch[1] === 'screen') return { property: 'width', value: '100vw' };
    const px = SPACING_SCALE[widthMatch[1]];
    if (px) return { property: 'width', value: px };
  }

  // Height
  const heightMatch = cls.match(/^h-(.+)$/);
  if (heightMatch) {
    if (heightMatch[1] === 'full') return { property: 'height', value: '100%' };
    if (heightMatch[1] === 'auto') return { property: 'height', value: 'auto' };
    if (heightMatch[1] === 'screen') return { property: 'height', value: '100vh' };
    const px = SPACING_SCALE[heightMatch[1]];
    if (px) return { property: 'height', value: px };
  }

  // Spacing: margin and padding
  const spacingPrefixes: Record<string, string> = {
    'mt': 'margin-top', 'mr': 'margin-right', 'mb': 'margin-bottom', 'ml': 'margin-left',
    'pt': 'padding-top', 'pr': 'padding-right', 'pb': 'padding-bottom', 'pl': 'padding-left',
  };

  for (const [prefix, prop] of Object.entries(spacingPrefixes)) {
    const match = cls.match(new RegExp(`^${prefix}-(.+)$`));
    if (match) {
      const px = SPACING_SCALE[match[1]];
      if (px) return { property: prop, value: px };
    }
  }

  // Gap
  const gapMatch = cls.match(/^gap-(.+)$/);
  if (gapMatch) {
    const px = SPACING_SCALE[gapMatch[1]];
    if (px) return { property: 'gap', value: px };
  }

  // Rounded
  if (cls === 'rounded') return { property: 'border-radius', value: '4px' };
  const roundedMatch = cls.match(/^rounded-(.+)$/);
  if (roundedMatch) {
    const val = BORDER_RADIUS_SCALE[roundedMatch[1]];
    if (val) return { property: 'border-radius', value: val };
  }

  // Opacity
  const opacityMatch = cls.match(/^opacity-(\d+)$/);
  if (opacityMatch) {
    return { property: 'opacity', value: String(parseInt(opacityMatch[1]) / 100) };
  }

  // Text align
  const textAlignMatch = cls.match(/^text-(left|center|right|justify|start|end)$/);
  if (textAlignMatch) {
    return { property: 'text-align', value: textAlignMatch[1] };
  }

  return null;
}

/**
 * Extract Tailwind-equivalent classes from a set of computed styles.
 * Returns an array of Tailwind class names.
 */
export function computedStylesToTailwind(styles: Record<string, string>): string[] {
  const classes: string[] = [];

  for (const [property, value] of Object.entries(styles)) {
    const tw = cssToTailwind(property, value);
    if (tw) classes.push(tw);
  }

  return classes;
}
