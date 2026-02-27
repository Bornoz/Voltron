import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Type, Palette, Move, Sparkles, Layers, Copy, Trash2, Eye, EyeOff,
  Maximize2, AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  Square, Circle, ChevronRight, RotateCcw, Paintbrush, Grid3X3,
  BoxSelect, Minus, Plus, SunDim, Underline, Columns, Check,
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
  { id: 'content', label: 'Icerik', icon: <Type size={12} />, desc: 'Metin, font, hizalama' },
  { id: 'appearance', label: 'Gorunum', icon: <Palette size={12} />, desc: 'Renk, opaklık, cerceve' },
  { id: 'layout', label: 'Yerlesim', icon: <Grid3X3 size={12} />, desc: 'Flex, grid, bosluk' },
  { id: 'effects', label: 'Efektler', icon: <Sparkles size={12} />, desc: 'Golge, blur, animasyon' },
  { id: 'structure', label: 'Yapi', icon: <Layers size={12} />, desc: 'Kopyala, sil, sifirla' },
];

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#000000',
  '#1e293b', '#334155', '#64748b', '#94a3b8', '#e2e8f0',
  'transparent',
];

/* ═══ Component ═══ */
export const DesignContextMenu = memo(function DesignContextMenu({
  data, frameOffset, onClose, onApplyStyle, onEditText, onDeleteElement, onDuplicateElement, onToggleVisibility,
}: DesignContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [colorPickerTarget, setColorPickerTarget] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState('#3b82f6');
  const [appliedAction, setAppliedAction] = useState<string | null>(null);

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
      if (e.key === 'Escape') {
        if (colorPickerTarget) setColorPickerTarget(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, colorPickerTarget]);

  // Reset on new data
  useEffect(() => {
    setActiveCategory(null);
    setColorPickerTarget(null);
    setAppliedAction(null);
  }, [data?.selector]);

  const applyStyle = useCallback((prop: string, value: string) => {
    if (!data) return;
    onApplyStyle(data.selector, { [prop]: value });
  }, [data, onApplyStyle]);

  // Show a brief feedback flash on an action
  const flashAction = useCallback((id: string) => {
    setAppliedAction(id);
    setTimeout(() => setAppliedAction(null), 800);
  }, []);

  if (!data) return null;

  const menuX = data.x + frameOffset.x;
  const menuY = data.y + frameOffset.y;

  /* ─── Build action list ─── */
  const actions: DesignAction[] = [
    // ── CONTENT ──
    {
      id: 'edit-text', category: 'content',
      icon: <Type size={14} />,
      label: 'Metni Duzenle',
      description: 'Secili elementin ic metnini premium editor ile degistir.',
      action: () => { onEditText(data.selector); },
      accent: true,
    },
    {
      id: 'bold', category: 'content',
      icon: <Bold size={14} />,
      label: 'Kalin Yazi',
      description: 'Font kalinligini bold/normal arasinda toggle et.',
      action: () => { applyStyle('fontWeight', data.styles.fontWeight === '700' || data.styles.fontWeight === 'bold' ? 'normal' : 'bold'); flashAction('bold'); },
    },
    {
      id: 'italic', category: 'content',
      icon: <Italic size={14} />,
      label: 'Italik',
      description: 'Yaziyi italik/normal arasinda toggle et.',
      action: () => { applyStyle('fontStyle', data.styles.fontStyle === 'italic' ? 'normal' : 'italic'); flashAction('italic'); },
    },
    {
      id: 'underline', category: 'content',
      icon: <Underline size={14} />,
      label: 'Alti Cizili',
      description: 'Yazi altina cizgi ekle veya kaldir.',
      action: () => { applyStyle('textDecoration', data.styles.textDecoration?.includes('underline') ? 'none' : 'underline'); flashAction('underline'); },
    },
    {
      id: 'font-increase', category: 'content',
      icon: <Plus size={14} />,
      label: 'Yazi Boyutu +2px',
      description: `Mevcut: ${data.styles.fontSize} → artir.`,
      action: () => {
        const current = parseInt(data.styles.fontSize) || 14;
        applyStyle('fontSize', `${current + 2}px`);
        flashAction('font-increase');
      },
    },
    {
      id: 'font-decrease', category: 'content',
      icon: <Minus size={14} />,
      label: 'Yazi Boyutu -2px',
      description: `Mevcut: ${data.styles.fontSize} → azalt.`,
      action: () => {
        const current = parseInt(data.styles.fontSize) || 14;
        applyStyle('fontSize', `${Math.max(8, current - 2)}px`);
        flashAction('font-decrease');
      },
    },
    {
      id: 'align-left', category: 'content',
      icon: <AlignLeft size={14} />,
      label: 'Sola Hizala',
      description: 'text-align: left uygula.',
      action: () => { applyStyle('textAlign', 'left'); flashAction('align-left'); },
    },
    {
      id: 'align-center', category: 'content',
      icon: <AlignCenter size={14} />,
      label: 'Ortala',
      description: 'text-align: center uygula.',
      action: () => { applyStyle('textAlign', 'center'); flashAction('align-center'); },
    },
    {
      id: 'align-right', category: 'content',
      icon: <AlignRight size={14} />,
      label: 'Saga Hizala',
      description: 'text-align: right uygula.',
      action: () => { applyStyle('textAlign', 'right'); flashAction('align-right'); },
    },

    // ── APPEARANCE ──
    {
      id: 'text-color', category: 'appearance',
      icon: <Paintbrush size={14} />,
      label: 'Yazi Rengi',
      description: `Mevcut: ${data.styles.color}. Renk paletinden sec.`,
      action: () => { setColorPickerTarget('color'); setActiveCategory('appearance'); },
      accent: true,
    },
    {
      id: 'bg-color', category: 'appearance',
      icon: <Square size={14} />,
      label: 'Arka Plan Rengi',
      description: `Mevcut: ${data.styles.backgroundColor}. Renk sec.`,
      action: () => { setColorPickerTarget('backgroundColor'); setActiveCategory('appearance'); },
      accent: true,
    },
    {
      id: 'opacity-up', category: 'appearance',
      icon: <SunDim size={14} />,
      label: 'Opaklik +10%',
      description: 'Elementin gorununurluk yogunlugunu artir.',
      action: () => {
        const current = parseFloat(data.styles.opacity) || 1;
        applyStyle('opacity', String(Math.min(1, +(current + 0.1).toFixed(1))));
        flashAction('opacity-up');
      },
    },
    {
      id: 'opacity-down', category: 'appearance',
      icon: <SunDim size={14} />,
      label: 'Opaklik -10%',
      description: 'Elementi daha seffaf yap. Katmanli tasarim icin.',
      action: () => {
        const current = parseFloat(data.styles.opacity) || 1;
        applyStyle('opacity', String(Math.max(0, +(current - 0.1).toFixed(1))));
        flashAction('opacity-down');
      },
    },
    {
      id: 'border-radius-add', category: 'appearance',
      icon: <Circle size={14} />,
      label: 'Koseleri Yuvarla +4px',
      description: `Mevcut: ${data.styles.borderRadius}. Daha yumusak koseler.`,
      action: () => {
        const current = parseInt(data.styles.borderRadius) || 0;
        applyStyle('borderRadius', `${current + 4}px`);
        flashAction('border-radius-add');
      },
    },
    {
      id: 'border-radius-remove', category: 'appearance',
      icon: <BoxSelect size={14} />,
      label: 'Koseleri Duzlestir',
      description: 'border-radius: 0 — keskin kare koseler.',
      action: () => { applyStyle('borderRadius', '0'); flashAction('border-radius-remove'); },
    },
    {
      id: 'border-add', category: 'appearance',
      icon: <Square size={14} />,
      label: 'Cerceve Ekle',
      description: '1px solid beyaz cerceve ekle.',
      action: () => { applyStyle('border', '1px solid rgba(255,255,255,0.2)'); flashAction('border-add'); },
    },

    // ── LAYOUT ──
    {
      id: 'display-flex', category: 'layout',
      icon: <Columns size={14} />,
      label: 'Flex Layout',
      description: 'Cocuk elementleri yan yana diz. display:flex.',
      action: () => { applyStyle('display', 'flex'); flashAction('display-flex'); },
      accent: true,
    },
    {
      id: 'display-grid', category: 'layout',
      icon: <Grid3X3 size={14} />,
      label: 'Grid Layout',
      description: 'CSS Grid sistemi aktif et. display:grid.',
      action: () => { applyStyle('display', 'grid'); flashAction('display-grid'); },
    },
    {
      id: 'display-block', category: 'layout',
      icon: <Maximize2 size={14} />,
      label: 'Blok',
      description: 'display:block — her element yeni satirda.',
      action: () => { applyStyle('display', 'block'); flashAction('display-block'); },
    },
    {
      id: 'display-none', category: 'layout',
      icon: <EyeOff size={14} />,
      label: 'Gizle',
      description: 'display:none ile elementi tamamen gizle.',
      action: () => { applyStyle('display', 'none'); flashAction('display-none'); },
    },
    {
      id: 'center-flex', category: 'layout',
      icon: <AlignCenter size={14} />,
      label: 'Flex ile Ortala',
      description: 'display:flex + align-items:center + justify-content:center.',
      action: () => {
        onApplyStyle(data.selector, { display: 'flex', alignItems: 'center', justifyContent: 'center' });
        flashAction('center-flex');
      },
      accent: true,
    },
    {
      id: 'padding-add', category: 'layout',
      icon: <Plus size={14} />,
      label: 'Padding +8px',
      description: `Mevcut: ${data.styles.padding}. Ic bosluk artir.`,
      action: () => {
        const current = parseInt(data.styles.padding) || 0;
        applyStyle('padding', `${current + 8}px`);
        flashAction('padding-add');
      },
    },
    {
      id: 'padding-remove', category: 'layout',
      icon: <Minus size={14} />,
      label: 'Padding -8px',
      description: 'Ic boslugu azalt.',
      action: () => {
        const current = parseInt(data.styles.padding) || 0;
        applyStyle('padding', `${Math.max(0, current - 8)}px`);
        flashAction('padding-remove');
      },
    },
    {
      id: 'margin-add', category: 'layout',
      icon: <Plus size={14} />,
      label: 'Margin +8px',
      description: `Mevcut: ${data.styles.margin}. Dis bosluk artir.`,
      action: () => {
        const current = parseInt(data.styles.margin) || 0;
        applyStyle('margin', `${current + 8}px`);
        flashAction('margin-add');
      },
    },
    {
      id: 'width-100', category: 'layout',
      icon: <Maximize2 size={14} />,
      label: 'Tam Genislik',
      description: 'width: 100% — tum genisligi kapla.',
      action: () => { applyStyle('width', '100%'); flashAction('width-100'); },
    },
    {
      id: 'position-relative', category: 'layout',
      icon: <Move size={14} />,
      label: 'Position: Relative',
      description: 'Akis icerisinde kaydirmaya izin verir.',
      action: () => { applyStyle('position', 'relative'); flashAction('position-relative'); },
    },
    {
      id: 'position-absolute', category: 'layout',
      icon: <Move size={14} />,
      label: 'Position: Absolute',
      description: 'Parent elementa gore serbest konumlandirma.',
      action: () => { applyStyle('position', 'absolute'); flashAction('position-absolute'); },
    },

    // ── EFFECTS ──
    {
      id: 'shadow-add', category: 'effects',
      icon: <Sparkles size={14} />,
      label: 'Golge Ekle',
      description: 'Yumusak box-shadow. Derinlik ve katman hissi.',
      action: () => { applyStyle('boxShadow', '0 4px 24px rgba(0,0,0,0.3)'); flashAction('shadow-add'); },
      accent: true,
    },
    {
      id: 'shadow-glow', category: 'effects',
      icon: <Sparkles size={14} />,
      label: 'Glow Efekti',
      description: 'Mavi isildayan golge. Premium arayuz icin.',
      action: () => { applyStyle('boxShadow', '0 0 20px rgba(59,130,246,0.3)'); flashAction('shadow-glow'); },
    },
    {
      id: 'shadow-remove', category: 'effects',
      icon: <RotateCcw size={14} />,
      label: 'Golgeyi Kaldir',
      description: 'box-shadow: none — tum golgeleri temizle.',
      action: () => { applyStyle('boxShadow', 'none'); flashAction('shadow-remove'); },
    },
    {
      id: 'blur-add', category: 'effects',
      icon: <SunDim size={14} />,
      label: 'Bulaniklastir',
      description: 'filter: blur(4px) — arka plan icin glassmorphism.',
      action: () => { applyStyle('filter', 'blur(4px)'); flashAction('blur-add'); },
    },
    {
      id: 'blur-remove', category: 'effects',
      icon: <RotateCcw size={14} />,
      label: 'Bulanikligi Kaldir',
      description: 'filter: none — netligi geri getir.',
      action: () => { applyStyle('filter', 'none'); flashAction('blur-remove'); },
    },
    {
      id: 'backdrop-blur', category: 'effects',
      icon: <Sparkles size={14} />,
      label: 'Backdrop Blur',
      description: 'Arka plani bulaniklastir. Cam efekti.',
      action: () => { applyStyle('backdropFilter', 'blur(12px)'); flashAction('backdrop-blur'); },
    },
    {
      id: 'transition-add', category: 'effects',
      icon: <Sparkles size={14} />,
      label: 'Gecis Animasyonu',
      description: 'transition: all 0.3s — tum degisikliklere animasyon.',
      action: () => { applyStyle('transition', 'all 0.3s ease'); flashAction('transition-add'); },
    },
    {
      id: 'scale-up', category: 'effects',
      icon: <Maximize2 size={14} />,
      label: 'Buyut (%110)',
      description: 'transform: scale(1.1) — elementi buyut.',
      action: () => { applyStyle('transform', 'scale(1.1)'); flashAction('scale-up'); },
    },
    {
      id: 'scale-reset', category: 'effects',
      icon: <RotateCcw size={14} />,
      label: 'Boyutu Sifirla',
      description: 'transform: none — normal boyuta dondur.',
      action: () => { applyStyle('transform', 'none'); flashAction('scale-reset'); },
    },

    // ── STRUCTURE ──
    {
      id: 'duplicate', category: 'structure',
      icon: <Copy size={14} />,
      label: 'Kopyala',
      description: 'Elementi birebir kopyalayip hemen sonrasina yerlestir.',
      action: () => { onDuplicateElement(data.selector); },
      accent: true,
    },
    {
      id: 'toggle-visibility', category: 'structure',
      icon: <Eye size={14} />,
      label: 'Gorunurlugu Toggle',
      description: 'Elementi goster/gizle (display none ↔ block).',
      action: () => { onToggleVisibility(data.selector); },
    },
    {
      id: 'delete', category: 'structure',
      icon: <Trash2 size={14} />,
      label: 'Elementi Sil',
      description: 'DOM\'dan tamamen kaldir. Onay istenir.',
      action: () => { onDeleteElement(data.selector); },
      danger: true,
    },
    {
      id: 'reset-styles', category: 'structure',
      icon: <RotateCcw size={14} />,
      label: 'Tum Stilleri Sifirla',
      description: 'Bu elemente yapilan tum CSS degisikliklerini geri al.',
      action: () => {
        onApplyStyle(data.selector, {
          color: '', backgroundColor: '', fontSize: '', fontWeight: '',
          padding: '', margin: '', borderRadius: '', boxShadow: '',
          opacity: '', display: '', position: '', transform: '', filter: '',
          border: '', textAlign: '', textDecoration: '', fontStyle: '',
          transition: '', backdropFilter: '', width: '',
          alignItems: '', justifyContent: '',
        });
        flashAction('reset-styles');
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
      flashAction('color-applied');
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[60] flex animate-fade-in-up"
      style={{
        left: Math.min(menuX, window.innerWidth - 460),
        top: Math.min(menuY, window.innerHeight - 500),
      }}
    >
      {/* ═══ Main menu ═══ */}
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: 300,
          maxHeight: 520,
          background: 'rgba(8,12,24,0.97)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(59,130,246,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* ─── Selected element info ─── */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/15 px-2 py-0.5 rounded-md font-medium">
              &lt;{data.tagName.toLowerCase()}&gt;
            </span>
            <span className="text-[10px] font-mono text-slate-500 truncate flex-1">
              {data.selector}
            </span>
          </div>
          {data.textContent && (
            <p className="text-[10px] text-slate-500 mt-1.5 truncate leading-tight bg-white/[0.02] rounded-md px-2 py-1 font-mono">
              "{data.textContent}"
            </p>
          )}
          {/* Current element dimensions */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] text-slate-600 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded">
              {Math.round(data.rect.width)}x{Math.round(data.rect.height)}
            </span>
            <span className="text-[9px] text-slate-600 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded">
              {data.styles.display}
            </span>
            <span className="text-[9px] text-slate-600 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded">
              {data.styles.fontSize}
            </span>
          </div>
        </div>

        {/* ─── Category tabs ─── */}
        <div className="flex border-b border-white/[0.06]">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className={`flex flex-col items-center gap-0.5 flex-1 py-2 transition-all ${
                activeCategory === cat.id
                  ? 'text-blue-400 bg-blue-500/8'
                  : 'text-slate-600 hover:text-slate-400 hover:bg-white/[0.02]'
              }`}
              title={cat.desc}
            >
              {cat.icon}
              <span className="text-[8px] font-medium">{cat.label}</span>
              {activeCategory === cat.id && (
                <div className="w-4 h-0.5 rounded-full bg-blue-400 mt-0.5" />
              )}
            </button>
          ))}
        </div>

        {/* ─── Actions list ─── */}
        <div className="overflow-y-auto flex-1" style={{ maxHeight: 380 }}>
          {visibleGroups.map((group) => (
            <div key={group.id}>
              {!activeCategory && (
                <div className="px-4 py-2 flex items-center gap-2 sticky top-0" style={{ background: 'rgba(8,12,24,0.97)' }}>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{group.label}</span>
                  <span className="text-[8px] text-slate-700 font-normal normal-case">{group.desc}</span>
                </div>
              )}
              {group.actions.map((action) => {
                const isApplied = appliedAction === action.id;
                return (
                  <button
                    key={action.id}
                    onClick={action.action}
                    className={`flex items-start gap-3 w-full px-4 py-2.5 text-left transition-all group relative ${
                      isApplied
                        ? 'bg-green-500/10'
                        : action.danger
                          ? 'hover:bg-red-500/8'
                          : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Success indicator */}
                    {isApplied && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Check size={14} className="text-green-400" />
                      </div>
                    )}

                    <span className={`mt-0.5 shrink-0 transition-colors ${
                      isApplied ? 'text-green-400' :
                      action.danger ? 'text-red-400' :
                      action.accent ? 'text-blue-400' :
                      'text-slate-500 group-hover:text-slate-300'
                    }`}>
                      {action.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[12px] font-medium leading-tight ${
                        isApplied ? 'text-green-300' :
                        action.danger ? 'text-red-400' :
                        action.accent ? 'text-blue-300' :
                        'text-slate-200'
                      }`}>
                        {action.label}
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5 leading-tight">
                        {action.description}
                      </div>
                    </div>
                    {!isApplied && (
                      <ChevronRight size={11} className="text-slate-700 mt-1 shrink-0 group-hover:text-slate-500 transition-colors" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* ─── Current styles footer ─── */}
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-2 flex-wrap">
          {[
            { label: data.styles.display, color: '#60a5fa' },
            { label: data.styles.position, color: '#c084fc' },
            { label: data.styles.fontSize, color: '#4ade80' },
          ].map((s, i) => (
            <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.04]" style={{ color: s.color }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* ═══ Color picker panel ═══ */}
      {colorPickerTarget && (
        <div
          className="ml-3 rounded-2xl p-4 animate-fade-in-up self-start"
          style={{
            width: 220,
            background: 'rgba(8,12,24,0.97)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 20px rgba(59,130,246,0.04), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/15 flex items-center justify-center">
              <Palette size={12} className="text-blue-400" />
            </div>
            <span className="text-xs text-slate-200 font-medium">
              {colorPickerTarget === 'color' ? 'Yazi Rengi' : 'Arka Plan'}
            </span>
          </div>

          {/* Current color preview */}
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
            <div
              className="w-8 h-8 rounded-lg border border-white/[0.1]"
              style={{ background: customColor === 'transparent' ? 'repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50% / 8px 8px' : customColor }}
            />
            <div>
              <span className="text-[10px] text-slate-400 block">Secili renk</span>
              <span className="text-[11px] font-mono text-slate-200">{customColor}</span>
            </div>
          </div>

          {/* Preset colors */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCustomColor(c);
                  applyStyle(colorPickerTarget, c);
                  flashAction('color-applied');
                }}
                className={`w-10 h-10 rounded-xl border transition-all hover:scale-110 active:scale-95 ${
                  customColor === c ? 'border-blue-400 ring-2 ring-blue-400/30' : 'border-white/[0.08] hover:border-white/[0.2]'
                }`}
                style={{
                  background: c === 'transparent'
                    ? 'repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50% / 8px 8px'
                    : c,
                  boxShadow: customColor === c ? `0 0 12px ${c}40` : undefined,
                }}
                title={c}
              />
            ))}
          </div>

          {/* Custom color input */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customColor === 'transparent' ? '#000000' : customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border border-white/[0.08] bg-transparent"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="flex-1 text-xs font-mono rounded-lg px-3 py-2 text-slate-200 focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              />
            </div>
            <button
              onClick={handleColorApply}
              className="w-full py-2 text-xs font-semibold text-white rounded-xl transition-all active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                boxShadow: '0 4px 16px rgba(59,130,246,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
            >
              Rengi Uygula
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
