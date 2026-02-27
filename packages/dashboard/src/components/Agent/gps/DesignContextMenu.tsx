import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Type, Palette, Move, Sparkles, Layers, Copy, Trash2, Eye, EyeOff,
  Maximize2, AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  Square, Circle, ChevronRight, RotateCcw, Paintbrush, Grid3X3,
  BoxSelect, Minus, Plus, SunDim, Underline, Columns,
} from 'lucide-react';
import type { ContextMenuEventData } from './LivePreviewFrame';

/* ═══ Types ═══ */
interface DesignAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  category: string;
  action: () => void;
  danger?: boolean;
  accent?: boolean;
}

interface DesignContextMenuProps {
  data: ContextMenuEventData | null;
  frameOffset: { x: number; y: number };
  onClose: () => void;
  onApplyStyle: (selector: string, styles: Record<string, string>) => void;
  onEditText: (selector: string) => void;
  onDeleteElement: (selector: string) => void;
  onDuplicateElement: (selector: string) => void;
  onToggleVisibility: (selector: string) => void;
}

/* ═══ Categories ═══ */
const CATEGORIES = [
  { id: 'content', label: 'Icerik', icon: <Type size={12} /> },
  { id: 'appearance', label: 'Gorunum', icon: <Palette size={12} /> },
  { id: 'layout', label: 'Yerlesim', icon: <Grid3X3 size={12} /> },
  { id: 'effects', label: 'Efektler', icon: <Sparkles size={12} /> },
  { id: 'structure', label: 'Yapi', icon: <Layers size={12} /> },
];

/* ═══ Component ═══ */
export const DesignContextMenu = memo(function DesignContextMenu({
  data, frameOffset, onClose, onApplyStyle, onEditText, onDeleteElement, onDuplicateElement, onToggleVisibility,
}: DesignContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [colorPickerTarget, setColorPickerTarget] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState('#3b82f6');

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const applyStyle = useCallback((prop: string, value: string) => {
    if (!data) return;
    onApplyStyle(data.selector, { [prop]: value });
  }, [data, onApplyStyle]);

  if (!data) return null;

  const menuX = data.x + frameOffset.x;
  const menuY = data.y + frameOffset.y;

  /* ─── Build action list ─── */
  const actions: DesignAction[] = [
    // ── CONTENT ──
    {
      id: 'edit-text', category: 'content',
      icon: <Type size={13} />,
      label: 'Metni Duzenle',
      description: 'Elementin ic metnini degistir. Cift tiklayarak da duzenleyebilirsin.',
      action: () => { onEditText(data.selector); onClose(); },
      accent: true,
    },
    {
      id: 'bold', category: 'content',
      icon: <Bold size={13} />,
      label: 'Kalin Yazi',
      description: 'Font kalinligini bold/normal arasinda degistir.',
      action: () => { applyStyle('fontWeight', data.styles.fontWeight === '700' || data.styles.fontWeight === 'bold' ? 'normal' : 'bold'); },
    },
    {
      id: 'italic', category: 'content',
      icon: <Italic size={13} />,
      label: 'Italik',
      description: 'Yaziyi italik yap veya normal\'e dondur.',
      action: () => { applyStyle('fontStyle', data.styles.fontWeight === 'italic' ? 'normal' : 'italic'); },
    },
    {
      id: 'underline', category: 'content',
      icon: <Underline size={13} />,
      label: 'Alti Cizili',
      description: 'Yazi altina cizgi ekle veya kaldir.',
      action: () => { applyStyle('textDecoration', data.styles.fontWeight === 'underline' ? 'none' : 'underline'); },
    },
    {
      id: 'font-increase', category: 'content',
      icon: <Plus size={13} />,
      label: 'Yazl Boyutu +',
      description: 'Font boyutunu 2px artir.',
      action: () => {
        const current = parseInt(data.styles.fontSize) || 14;
        applyStyle('fontSize', `${current + 2}px`);
      },
    },
    {
      id: 'font-decrease', category: 'content',
      icon: <Minus size={13} />,
      label: 'Yazi Boyutu -',
      description: 'Font boyutunu 2px azalt.',
      action: () => {
        const current = parseInt(data.styles.fontSize) || 14;
        applyStyle('fontSize', `${Math.max(8, current - 2)}px`);
      },
    },
    {
      id: 'align-left', category: 'content',
      icon: <AlignLeft size={13} />,
      label: 'Sola Hizala',
      description: 'Metni sola hizala.',
      action: () => { applyStyle('textAlign', 'left'); },
    },
    {
      id: 'align-center', category: 'content',
      icon: <AlignCenter size={13} />,
      label: 'Ortala',
      description: 'Metni ortaya hizala.',
      action: () => { applyStyle('textAlign', 'center'); },
    },
    {
      id: 'align-right', category: 'content',
      icon: <AlignRight size={13} />,
      label: 'Saga Hizala',
      description: 'Metni saga hizala.',
      action: () => { applyStyle('textAlign', 'right'); },
    },

    // ── APPEARANCE ──
    {
      id: 'text-color', category: 'appearance',
      icon: <Paintbrush size={13} />,
      label: 'Yazi Rengi',
      description: 'Elementin metin rengini degistir. Mevcut: ' + data.styles.color,
      action: () => { setColorPickerTarget('color'); setActiveCategory('appearance'); },
      accent: true,
    },
    {
      id: 'bg-color', category: 'appearance',
      icon: <Square size={13} />,
      label: 'Arka Plan Rengi',
      description: 'Elementin arka plan rengini degistir. Mevcut: ' + data.styles.backgroundColor,
      action: () => { setColorPickerTarget('backgroundColor'); setActiveCategory('appearance'); },
      accent: true,
    },
    {
      id: 'opacity-up', category: 'appearance',
      icon: <SunDim size={13} />,
      label: 'Opakligi Artir',
      description: 'Elementin opakligi %10 artir.',
      action: () => {
        const current = parseFloat(data.styles.opacity) || 1;
        applyStyle('opacity', String(Math.min(1, current + 0.1)));
      },
    },
    {
      id: 'opacity-down', category: 'appearance',
      icon: <SunDim size={13} />,
      label: 'Opakligi Azalt',
      description: 'Elementin opakligi %10 azalt. Seffaflik efekti icin.',
      action: () => {
        const current = parseFloat(data.styles.opacity) || 1;
        applyStyle('opacity', String(Math.max(0, current - 0.1)));
      },
    },
    {
      id: 'border-radius-add', category: 'appearance',
      icon: <Circle size={13} />,
      label: 'Koseler Yuvarla',
      description: 'Border-radius\'u 4px artir. Daha yuvarlak koseler.',
      action: () => {
        const current = parseInt(data.styles.borderRadius) || 0;
        applyStyle('borderRadius', `${current + 4}px`);
      },
    },
    {
      id: 'border-radius-remove', category: 'appearance',
      icon: <BoxSelect size={13} />,
      label: 'Koseleri Duzlestir',
      description: 'Border-radius\'u sifirla. Kare koseler.',
      action: () => { applyStyle('borderRadius', '0'); },
    },
    {
      id: 'border-add', category: 'appearance',
      icon: <Square size={13} />,
      label: 'Cerceve Ekle',
      description: 'Elementin etrafina 1px solid cerceve ekle.',
      action: () => { applyStyle('border', '1px solid rgba(255,255,255,0.2)'); },
    },

    // ── LAYOUT ──
    {
      id: 'display-flex', category: 'layout',
      icon: <Columns size={13} />,
      label: 'Flex Yap',
      description: 'Display\'i flex yap. Cocuk elementleri yan yana dizer.',
      action: () => { applyStyle('display', 'flex'); },
      accent: true,
    },
    {
      id: 'display-grid', category: 'layout',
      icon: <Grid3X3 size={13} />,
      label: 'Grid Yap',
      description: 'Display\'i grid yap. CSS Grid layout kullan.',
      action: () => { applyStyle('display', 'grid'); },
    },
    {
      id: 'display-block', category: 'layout',
      icon: <Maximize2 size={13} />,
      label: 'Blok Yap',
      description: 'Display\'i block yap. Her element yeni satirda.',
      action: () => { applyStyle('display', 'block'); },
    },
    {
      id: 'display-none', category: 'layout',
      icon: <EyeOff size={13} />,
      label: 'Gizle (Display None)',
      description: 'Elementi display:none ile tamamen gizle.',
      action: () => { applyStyle('display', 'none'); },
    },
    {
      id: 'center-flex', category: 'layout',
      icon: <AlignCenter size={13} />,
      label: 'Flex ile Ortala',
      description: 'Display flex + align-items center + justify-content center.',
      action: () => {
        onApplyStyle(data.selector, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        });
      },
    },
    {
      id: 'padding-add', category: 'layout',
      icon: <Plus size={13} />,
      label: 'Padding Artir',
      description: 'Ic boslugu (padding) 8px artir.',
      action: () => {
        const current = parseInt(data.styles.padding) || 0;
        applyStyle('padding', `${current + 8}px`);
      },
    },
    {
      id: 'padding-remove', category: 'layout',
      icon: <Minus size={13} />,
      label: 'Padding Azalt',
      description: 'Ic boslugu (padding) 8px azalt.',
      action: () => {
        const current = parseInt(data.styles.padding) || 0;
        applyStyle('padding', `${Math.max(0, current - 8)}px`);
      },
    },
    {
      id: 'margin-add', category: 'layout',
      icon: <Plus size={13} />,
      label: 'Margin Artir',
      description: 'Dis boslugu (margin) 8px artir.',
      action: () => {
        const current = parseInt(data.styles.margin) || 0;
        applyStyle('margin', `${current + 8}px`);
      },
    },
    {
      id: 'width-100', category: 'layout',
      icon: <Maximize2 size={13} />,
      label: 'Tam Genislik',
      description: 'Width\'i %100 yap. Elementin tum genisligi kaplamasini saglar.',
      action: () => { applyStyle('width', '100%'); },
    },
    {
      id: 'position-relative', category: 'layout',
      icon: <Move size={13} />,
      label: 'Position: Relative',
      description: 'Pozisyonu relative yap. Top/left ile kaydirmak icin.',
      action: () => { applyStyle('position', 'relative'); },
    },
    {
      id: 'position-absolute', category: 'layout',
      icon: <Move size={13} />,
      label: 'Position: Absolute',
      description: 'Pozisyonu absolute yap. Parent\'a gore konumla.',
      action: () => { applyStyle('position', 'absolute'); },
    },

    // ── EFFECTS ──
    {
      id: 'shadow-add', category: 'effects',
      icon: <Sparkles size={13} />,
      label: 'Golge Ekle',
      description: 'Elemente box-shadow ekle. Derinlik hissi verir.',
      action: () => { applyStyle('boxShadow', '0 4px 24px rgba(0,0,0,0.3)'); },
      accent: true,
    },
    {
      id: 'shadow-glow', category: 'effects',
      icon: <Sparkles size={13} />,
      label: 'Glow Efekti',
      description: 'Isildayan bir golge ekle. Premium goruntu icin.',
      action: () => { applyStyle('boxShadow', '0 0 20px rgba(59,130,246,0.3)'); },
    },
    {
      id: 'shadow-remove', category: 'effects',
      icon: <RotateCcw size={13} />,
      label: 'Golgeyi Kaldir',
      description: 'Tum golge efektlerini temizle.',
      action: () => { applyStyle('boxShadow', 'none'); },
    },
    {
      id: 'blur-add', category: 'effects',
      icon: <SunDim size={13} />,
      label: 'Bulaniklastir',
      description: 'Elemente blur filtresi ekle. Glassmorphism icin.',
      action: () => { applyStyle('filter', 'blur(4px)'); },
    },
    {
      id: 'blur-remove', category: 'effects',
      icon: <RotateCcw size={13} />,
      label: 'Bulanikligi Kaldir',
      description: 'Blur filtresini temizle.',
      action: () => { applyStyle('filter', 'none'); },
    },
    {
      id: 'backdrop-blur', category: 'effects',
      icon: <Sparkles size={13} />,
      label: 'Backdrop Blur',
      description: 'Arka plana blur ekle. Glassmorphism efekti yaratir.',
      action: () => { applyStyle('backdropFilter', 'blur(12px)'); },
    },
    {
      id: 'transition-add', category: 'effects',
      icon: <Sparkles size={13} />,
      label: 'Gecis Animasyonu',
      description: 'Tum CSS degisikliklerine 300ms gecis animasyonu ekle.',
      action: () => { applyStyle('transition', 'all 0.3s ease'); },
    },
    {
      id: 'scale-up', category: 'effects',
      icon: <Maximize2 size={13} />,
      label: 'Buyut (Scale 1.1)',
      description: 'Elementi %10 buyut. Transform scale kullanir.',
      action: () => { applyStyle('transform', 'scale(1.1)'); },
    },
    {
      id: 'scale-reset', category: 'effects',
      icon: <RotateCcw size={13} />,
      label: 'Boyutu Sifirla',
      description: 'Transform\'u temizle. Normal boyuta dondur.',
      action: () => { applyStyle('transform', 'none'); },
    },

    // ── STRUCTURE ──
    {
      id: 'duplicate', category: 'structure',
      icon: <Copy size={13} />,
      label: 'Kopyala',
      description: 'Elementi kopyalayip hemen altina yerlestir.',
      action: () => { onDuplicateElement(data.selector); onClose(); },
      accent: true,
    },
    {
      id: 'toggle-visibility', category: 'structure',
      icon: <Eye size={13} />,
      label: 'Gorunurlugu Degistir',
      description: 'Elementi goster/gizle toggle. Display none/block.',
      action: () => { onToggleVisibility(data.selector); onClose(); },
    },
    {
      id: 'delete', category: 'structure',
      icon: <Trash2 size={13} />,
      label: 'Sil',
      description: 'Elementi DOM\'dan tamamen kaldir. Geri alinamaz!',
      action: () => { onDeleteElement(data.selector); onClose(); },
      danger: true,
    },
    {
      id: 'reset-styles', category: 'structure',
      icon: <RotateCcw size={13} />,
      label: 'Stilleri Sifirla',
      description: 'Bu elemente yapilan tum stil degisikliklerini geri al.',
      action: () => {
        onApplyStyle(data.selector, {
          color: '', backgroundColor: '', fontSize: '', fontWeight: '',
          padding: '', margin: '', borderRadius: '', boxShadow: '',
          opacity: '', display: '', position: '', transform: '', filter: '',
          border: '', textAlign: '', textDecoration: '', fontStyle: '',
          transition: '', backdropFilter: '', width: '',
          alignItems: '', justifyContent: '',
        });
      },
    },
  ];

  // Group by category
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    actions: actions.filter((a) => a.category === cat.id),
  }));

  // Filtered: show only active category or all
  const visibleGroups = activeCategory
    ? grouped.filter((g) => g.id === activeCategory)
    : grouped;

  const handleColorApply = () => {
    if (colorPickerTarget && data) {
      applyStyle(colorPickerTarget, customColor);
      setColorPickerTarget(null);
    }
  };

  const PRESET_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
    '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#000000',
    '#1e293b', '#334155', '#64748b', '#94a3b8', '#e2e8f0',
    'transparent',
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[60] flex animate-fade-in-up"
      style={{
        left: Math.min(menuX, window.innerWidth - 420),
        top: Math.min(menuY, window.innerHeight - 400),
      }}
    >
      {/* Main menu */}
      <div
        className="flex flex-col rounded-xl overflow-hidden"
        style={{
          width: 260,
          maxHeight: 440,
          background: 'rgba(10,15,30,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02)',
        }}
      >
        {/* Selected element info */}
        <div className="px-3 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">
              {data.tagName}
            </span>
            <span className="text-[10px] font-mono text-slate-500 truncate flex-1">
              {data.selector}
            </span>
          </div>
          {data.textContent && (
            <p className="text-[9px] text-slate-600 mt-1 truncate">
              "{data.textContent}"
            </p>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex border-b border-white/[0.06] overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Actions list */}
        <div className="overflow-y-auto flex-1" style={{ maxHeight: 320 }}>
          {visibleGroups.map((group) => (
            <div key={group.id}>
              {!activeCategory && (
                <div className="px-3 py-1.5 text-[9px] text-slate-600 font-semibold uppercase tracking-wider sticky top-0" style={{ background: 'rgba(10,15,30,0.95)' }}>
                  {group.label}
                </div>
              )}
              {group.actions.map((action) => (
                <button
                  key={action.id}
                  onClick={action.action}
                  className={`flex items-start gap-2 w-full px-3 py-2 text-left hover:bg-white/[0.05] transition-colors group ${
                    action.danger ? 'hover:bg-red-900/20' : ''
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 ${
                    action.danger ? 'text-red-400' :
                    action.accent ? 'text-blue-400' :
                    'text-slate-400 group-hover:text-slate-200'
                  }`}>
                    {action.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[11px] font-medium ${
                      action.danger ? 'text-red-400' :
                      action.accent ? 'text-blue-300' :
                      'text-slate-300'
                    }`}>
                      {action.label}
                    </div>
                    <div className="text-[9px] text-slate-600 mt-0.5 leading-tight">
                      {action.description}
                    </div>
                  </div>
                  <ChevronRight size={10} className="text-slate-700 mt-1 shrink-0 group-hover:text-slate-500" />
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Current styles footer */}
        <div className="px-3 py-1.5 border-t border-white/[0.06] flex items-center gap-2">
          <span className="text-[8px] text-slate-700">
            {data.styles.display} | {data.styles.position} | {data.styles.fontSize}
          </span>
        </div>
      </div>

      {/* Color picker panel */}
      {colorPickerTarget && (
        <div
          className="ml-2 rounded-xl p-3 animate-fade-in-up"
          style={{
            width: 180,
            background: 'rgba(10,15,30,0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div className="text-[10px] text-slate-400 mb-2 font-medium">
            {colorPickerTarget === 'color' ? 'Yazi Rengi' : 'Arka Plan Rengi'}
          </div>

          {/* Preset colors */}
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setCustomColor(c); applyStyle(colorPickerTarget, c); }}
                className="w-8 h-8 rounded-lg border border-white/[0.1] hover:border-white/[0.3] transition-all hover:scale-110"
                style={{
                  background: c === 'transparent'
                    ? 'repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50% / 8px 8px'
                    : c,
                }}
                title={c}
              />
            ))}
          </div>

          {/* Custom color input */}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="flex-1 text-[10px] font-mono bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-blue-500/30"
            />
            <button
              onClick={handleColorApply}
              className="text-[10px] text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
            >
              Uygula
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
