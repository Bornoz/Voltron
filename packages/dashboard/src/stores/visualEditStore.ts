import { create } from 'zustand';

/**
 * A single design change applied to an element in a specific file.
 */
export interface DesignChange {
  selector: string;
  tagName: string;
  property: string; // CSS property, or '__textContent', '__delete', '__duplicate'
  value: string;
  timestamp: number;
}

/**
 * Multi-file visual edit store.
 * Accumulates design changes per file path so they survive file navigation.
 * All changes can be sent to the AI agent in a single batch.
 */
interface VisualEditState {
  /** Changes keyed by file path */
  changesByFile: Record<string, DesignChange[]>;

  /** Add a change for a specific file */
  addChange: (filePath: string, change: DesignChange) => void;

  /** Remove the last change for a specific file (undo) */
  undoLastChange: (filePath: string) => void;

  /** Clear all changes for a specific file */
  clearFile: (filePath: string) => void;

  /** Clear all changes across all files (after send) */
  clearAll: () => void;

  /** Get total change count across all files */
  totalCount: () => number;

  /** Get list of files that have pending changes */
  filesWithChanges: () => string[];
}

export const useVisualEditStore = create<VisualEditState>()((set, get) => ({
  changesByFile: {},

  addChange: (filePath, change) =>
    set((state) => ({
      changesByFile: {
        ...state.changesByFile,
        [filePath]: [...(state.changesByFile[filePath] ?? []), change],
      },
    })),

  undoLastChange: (filePath) =>
    set((state) => {
      const current = state.changesByFile[filePath];
      if (!current || current.length === 0) return state;
      const updated = current.slice(0, -1);
      if (updated.length === 0) {
        const { [filePath]: _, ...rest } = state.changesByFile;
        return { changesByFile: rest };
      }
      return { changesByFile: { ...state.changesByFile, [filePath]: updated } };
    }),

  clearFile: (filePath) =>
    set((state) => {
      const { [filePath]: _, ...rest } = state.changesByFile;
      return { changesByFile: rest };
    }),

  clearAll: () => set({ changesByFile: {} }),

  totalCount: () => {
    const all = get().changesByFile;
    let count = 0;
    for (const changes of Object.values(all)) count += changes.length;
    return count;
  },

  filesWithChanges: () => {
    const all = get().changesByFile;
    return Object.keys(all).filter((f) => all[f].length > 0);
  },
}));

/**
 * Generate a unified prompt from ALL pending changes across all files.
 */
export function generateMultiFilePrompt(changesByFile: Record<string, DesignChange[]>): string {
  const files = Object.entries(changesByFile).filter(([, changes]) => changes.length > 0);
  if (files.length === 0) return '';

  const lines: string[] = [
    `=== VOLTRON ÇOKLU DOSYA TASARIM DEĞİŞİKLİKLERİ ===`,
    `Tarih: ${new Date().toISOString()}`,
    `Toplam Dosya: ${files.length}`,
    `Toplam Değişiklik: ${files.reduce((sum, [, c]) => sum + c.length, 0)}`,
    '',
  ];

  for (const [filePath, changes] of files) {
    lines.push(`━━━ DOSYA: ${filePath} ━━━`);
    lines.push('');

    // Group changes by selector
    const grouped: Record<string, { tagName: string; styles: Record<string, string>; textChange?: string }> = {};
    for (const ch of changes) {
      if (!grouped[ch.selector]) {
        grouped[ch.selector] = { tagName: ch.tagName, styles: {} };
      }
      if (ch.property === '__textContent') {
        grouped[ch.selector].textChange = ch.value;
      } else if (ch.property === '__delete') {
        grouped[ch.selector].styles['__action'] = 'DELETE';
      } else if (ch.property === '__duplicate') {
        grouped[ch.selector].styles['__action'] = 'DUPLICATE';
      } else {
        grouped[ch.selector].styles[ch.property] = ch.value;
      }
    }

    for (const [selector, data] of Object.entries(grouped)) {
      lines.push(`## Element: <${data.tagName}> — Selector: "${selector}"`);

      if (data.styles['__action'] === 'DELETE') {
        lines.push('  - Bu elementi tamamen sil');
      } else if (data.styles['__action'] === 'DUPLICATE') {
        lines.push('  - Bu elementi kopyala (clone edip hemen sonrasına ekle)');
      }

      if (data.textChange !== undefined) {
        lines.push(`  - Metin içeriğini değiştir: "${data.textChange}"`);
      }

      const styleEntries = Object.entries(data.styles).filter(([k]) => !k.startsWith('__'));
      if (styleEntries.length > 0) {
        lines.push('  CSS Stilleri:');
        for (const [prop, val] of styleEntries) {
          const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          lines.push(`    - ${cssProp}: ${val}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('Bu değişiklikleri doğrudan kaynak kodda uygula. Inline style yerine mümkünse Tailwind class veya CSS class kullan.');

  return lines.join('\n');
}
