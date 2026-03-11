import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Type, Palette, Move, Sparkles, Layers, Copy, Trash2, Eye, EyeOff,
  Maximize2, AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  Square, Circle, ChevronRight, RotateCcw, Paintbrush, Grid3X3,
  BoxSelect, Minus, Plus, SunDim, Underline, Columns, Check,
  Droplets, Zap, Wind, Gem, Wand2, Blend, Send,
} from 'lucide-react';
import type { ContextMenuEventData } from './LivePreviewFrame';
import { useTranslation } from '../../../i18n';

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
  onDesignChange?: (selector: string, tagName: string, property: string, value: string) => void;
  onUndo?: () => void;
  onAskAI?: (selector: string, elementInfo: string) => void;
}

/* ═══ Categories ═══ */
const getCategories = (t: (key: string) => string) => [
  { id: 'content', label: t('designMenu.content'), icon: <Type size={12} />, desc: t('designMenu.contentDesc') },
  { id: 'appearance', label: t('designMenu.appearance'), icon: <Palette size={12} />, desc: t('designMenu.appearanceDesc') },
  { id: 'layout', label: t('designMenu.layout'), icon: <Grid3X3 size={12} />, desc: t('designMenu.layoutDesc') },
  { id: 'effects', label: t('designMenu.effects'), icon: <Sparkles size={12} />, desc: t('designMenu.effectsDesc') },
  { id: 'premium', label: 'Premium', icon: <Gem size={12} />, desc: 'Gradient, glass, glow' },
  { id: 'structure', label: t('designMenu.structure'), icon: <Layers size={12} />, desc: t('designMenu.structureDesc') },
];

/* ═══ Expanded Color Palette ═══ */
const getColorGroups = (t: (key: string) => string) => [
  {
    label: t('designMenu.red'),
    colors: ['#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#7f1d1d'],
  },
  {
    label: t('designMenu.orange'),
    colors: ['#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#7c2d12'],
  },
  {
    label: t('designMenu.yellow'),
    colors: ['#fef08a', '#fde047', '#facc15', '#eab308', '#ca8a04', '#a16207', '#713f12'],
  },
  {
    label: t('designMenu.green'),
    colors: ['#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#14532d'],
  },
  {
    label: 'Cyan',
    colors: ['#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#164e63'],
  },
  {
    label: t('designMenu.blue'),
    colors: ['#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a5f'],
  },
  {
    label: t('designMenu.purple'),
    colors: ['#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#4c1d95'],
  },
  {
    label: t('designMenu.pink'),
    colors: ['#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#831843'],
  },
  {
    label: t('designMenu.neutral'),
    colors: ['#ffffff', '#f1f5f9', '#cbd5e1', '#94a3b8', '#64748b', '#334155', '#0f172a', '#000000'],
  },
];

/* ═══ Gradient Presets ═══ */
const getGradientPresets = (t: (key: string) => string) => [
  { label: t('designMenu.sunset'), value: 'linear-gradient(135deg, #f97316, #ef4444, #ec4899)', colors: ['#f97316', '#ef4444', '#ec4899'] },
  { label: t('designMenu.ocean'), value: 'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)', colors: ['#06b6d4', '#3b82f6', '#8b5cf6'] },
  { label: t('designMenu.forest'), value: 'linear-gradient(135deg, #22c55e, #06b6d4)', colors: ['#22c55e', '#06b6d4'] },
  { label: t('designMenu.night'), value: 'linear-gradient(135deg, #1e3a5f, #4c1d95)', colors: ['#1e3a5f', '#4c1d95'] },
  { label: t('designMenu.gold'), value: 'linear-gradient(135deg, #eab308, #f97316)', colors: ['#eab308', '#f97316'] },
  { label: t('designMenu.ice'), value: 'linear-gradient(135deg, #e0f2fe, #bae6fd, #7dd3fc)', colors: ['#e0f2fe', '#bae6fd', '#7dd3fc'] },
  { label: t('designMenu.fire'), value: 'linear-gradient(135deg, #ef4444, #f97316, #eab308)', colors: ['#ef4444', '#f97316', '#eab308'] },
  { label: 'Neon', value: 'linear-gradient(135deg, #a855f7, #ec4899, #f43f5e)', colors: ['#a855f7', '#ec4899', '#f43f5e'] },
  { label: t('designMenu.aurora'), value: 'linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)', colors: ['#22d3ee', '#a78bfa', '#f472b6'] },
  { label: t('designMenu.carbon'), value: 'linear-gradient(135deg, #1e293b, #334155, #475569)', colors: ['#1e293b', '#334155', '#475569'] },
];

/* ═══ Shadow Presets ═══ */
const getShadowPresets = (t: (key: string) => string) => [
  { label: t('designMenu.none'), value: 'none', preview: 'none' },
  { label: t('designMenu.light'), value: '0 1px 3px rgba(0,0,0,0.12)', preview: 'sm' },
  { label: t('designMenu.medium'), value: '0 4px 12px rgba(0,0,0,0.15)', preview: 'md' },
  { label: t('designMenu.strong'), value: '0 8px 30px rgba(0,0,0,0.25)', preview: 'lg' },
  { label: t('designMenu.up'), value: '0 -4px 20px rgba(0,0,0,0.2)', preview: 'up' },
  { label: t('designMenu.blueGlow'), value: '0 0 20px rgba(59,130,246,0.4), 0 0 60px rgba(59,130,246,0.1)', preview: 'glow-b' },
  { label: t('designMenu.greenGlow'), value: '0 0 20px rgba(34,197,94,0.4), 0 0 60px rgba(34,197,94,0.1)', preview: 'glow-g' },
  { label: t('designMenu.purpleGlow'), value: '0 0 20px rgba(139,92,246,0.4), 0 0 60px rgba(139,92,246,0.1)', preview: 'glow-p' },
  { label: t('designMenu.redGlow'), value: '0 0 20px rgba(239,68,68,0.4), 0 0 60px rgba(239,68,68,0.1)', preview: 'glow-r' },
  { label: 'Neon', value: '0 0 8px rgba(59,130,246,0.6), 0 0 30px rgba(59,130,246,0.3), 0 0 60px rgba(59,130,246,0.1)', preview: 'neon' },
  { label: 'Inner', value: 'inset 0 2px 6px rgba(0,0,0,0.3)', preview: 'inner' },
  { label: 'Premium', value: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', preview: 'premium' },
];

/* ═══ Animation Presets ═══ */
const getAnimationPresets = (t: (key: string) => string) => [
  { label: t('designMenu.none'), value: 'none' },
  { label: 'Fade In', value: 'fadeIn 0.5s ease-out' },
  { label: 'Slide Up', value: 'slideUp 0.4s ease-out' },
  { label: 'Slide Down', value: 'slideDown 0.4s ease-out' },
  { label: 'Scale In', value: 'scaleIn 0.3s ease-out' },
  { label: 'Bounce', value: 'bounce 0.6s ease-in-out' },
  { label: 'Pulse', value: 'pulse 2s ease-in-out infinite' },
  { label: 'Spin', value: 'spin 1s linear infinite' },
  { label: 'Wiggle', value: 'wiggle 0.5s ease-in-out' },
  { label: 'Glow Pulse', value: 'glowPulse 2s ease-in-out infinite' },
];

/* ═══ Component ═══ */
export const DesignContextMenu = memo(function DesignContextMenu({
  data, frameOffset, onClose, onApplyStyle, onEditText, onDeleteElement, onDuplicateElement, onToggleVisibility, onDesignChange, onUndo, onAskAI,
}: DesignContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [colorPickerTarget, setColorPickerTarget] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState('#3b82f6');
  const [appliedAction, setAppliedAction] = useState<string | null>(null);
  const [activeSubPanel, setActiveSubPanel] = useState<'gradients' | 'shadows' | 'animations' | null>(null);

  const { t } = useTranslation();
  const categories = getCategories(t);
  const colorGroups = getColorGroups(t);
  const gradientPresets = getGradientPresets(t);
  const shadowPresets = getShadowPresets(t);
  const animationPresets = getAnimationPresets(t);

  // Close on Escape
  useEffect(() => {
    if (!data) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (colorPickerTarget) setColorPickerTarget(null);
        else if (activeSubPanel) setActiveSubPanel(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [data, onClose, colorPickerTarget, activeSubPanel]);

  // Close on right-click anywhere (new right-click should dismiss current menu)
  useEffect(() => {
    if (!data) return;
    const handler = (e: MouseEvent) => {
      // If right-click is outside the menu, close it
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture phase to intercept before iframe gets it
    document.addEventListener('contextmenu', handler, true);
    return () => document.removeEventListener('contextmenu', handler, true);
  }, [data, onClose]);

  // Reset on new data
  useEffect(() => {
    setActiveCategory(null);
    setColorPickerTarget(null);
    setAppliedAction(null);
    setActiveSubPanel(null);
  }, [data?.selector, data?.x, data?.y]);

  // Smart positioning: clamp to viewport boundaries
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  useEffect(() => {
    if (!data) return;
    const rawX = data.x + frameOffset.x;
    const rawY = data.y + frameOffset.y;

    // Menu dimensions (main panel + possible side panel)
    const mainW = 320;
    const sideW = 272; // 260 + 12px gap
    const hasSide = !!(colorPickerTarget || activeSubPanel);
    const totalW = hasSide ? mainW + sideW : mainW;

    // Use actual menu height if available, else estimate
    const menuH = menuRef.current?.offsetHeight ?? 500;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8; // minimum padding from viewport edge

    // Horizontal: prefer right of cursor, flip left if overflows
    let left = rawX;
    if (left + totalW + pad > vw) {
      left = rawX - mainW; // flip: show to the left of cursor
    }
    left = Math.max(pad, Math.min(left, vw - totalW - pad));

    // Vertical: prefer below cursor, flip up if overflows
    let top = rawY;
    if (top + menuH + pad > vh) {
      top = vh - menuH - pad;
    }
    top = Math.max(pad, top);

    setMenuPos({ left, top });
  }, [data, frameOffset, colorPickerTarget, activeSubPanel]);

  const trackChange = useCallback((prop: string, value: string) => {
    if (data && onDesignChange) {
      onDesignChange(data.selector, data.tagName, prop, value);
    }
  }, [data, onDesignChange]);

  const applyStyle = useCallback((prop: string, value: string) => {
    if (!data) return;
    onApplyStyle(data.selector, { [prop]: value });
    trackChange(prop, value);
  }, [data, onApplyStyle, trackChange]);

  const applyMultiStyle = useCallback((styles: Record<string, string>) => {
    if (!data) return;
    onApplyStyle(data.selector, styles);
    for (const [prop, value] of Object.entries(styles)) {
      trackChange(prop, value);
    }
  }, [data, onApplyStyle, trackChange]);

  // Show a brief feedback flash on an action
  const flashAction = useCallback((id: string) => {
    setAppliedAction(id);
    setTimeout(() => setAppliedAction(null), 800);
  }, []);

  if (!data) return null;

  /* ─── Build action list ─── */
  const actions: DesignAction[] = [
    // ── CONTENT ──
    {
      id: 'edit-text', category: 'content',
      icon: <Type size={14} />,
      label: t('designMenu.editText'),
      description: t('designMenu.editTextDesc'),
      action: () => { onEditText(data.selector); trackChange('__textContent', '(edited)'); },
      accent: true,
    },
    {
      id: 'bold', category: 'content',
      icon: <Bold size={14} />,
      label: t('designMenu.boldLabel'),
      description: t('designMenu.boldDesc'),
      action: () => {
        const v = data.styles.fontWeight === '700' || data.styles.fontWeight === 'bold' ? 'normal' : 'bold';
        applyStyle('fontWeight', v); flashAction('bold');
      },
    },
    {
      id: 'italic', category: 'content',
      icon: <Italic size={14} />,
      label: t('designMenu.italicLabel'),
      description: t('designMenu.italicDesc'),
      action: () => {
        const v = data.styles.fontStyle === 'italic' ? 'normal' : 'italic';
        applyStyle('fontStyle', v); flashAction('italic');
      },
    },
    {
      id: 'underline', category: 'content',
      icon: <Underline size={14} />,
      label: t('designMenu.underlineLabel'),
      description: t('designMenu.underlineDesc'),
      action: () => {
        const v = data.styles.textDecoration?.includes('underline') ? 'none' : 'underline';
        applyStyle('textDecoration', v); flashAction('underline');
      },
    },
    {
      id: 'font-increase', category: 'content',
      icon: <Plus size={14} />,
      label: t('designMenu.fontIncrease'),
      description: t('designMenu.fontIncreaseDesc').replace('{size}', data.styles.fontSize),
      action: () => {
        const current = parseInt(data.styles.fontSize) || 14;
        applyStyle('fontSize', `${current + 2}px`); flashAction('font-increase');
      },
    },
    {
      id: 'font-decrease', category: 'content',
      icon: <Minus size={14} />,
      label: t('designMenu.fontDecrease'),
      description: t('designMenu.fontDecreaseDesc').replace('{size}', data.styles.fontSize),
      action: () => {
        const current = parseInt(data.styles.fontSize) || 14;
        applyStyle('fontSize', `${Math.max(8, current - 2)}px`); flashAction('font-decrease');
      },
    },
    {
      id: 'align-left', category: 'content',
      icon: <AlignLeft size={14} />,
      label: t('designMenu.alignLeft'),
      description: 'text-align: left',
      action: () => { applyStyle('textAlign', 'left'); flashAction('align-left'); },
    },
    {
      id: 'align-center', category: 'content',
      icon: <AlignCenter size={14} />,
      label: t('designMenu.alignCenter'),
      description: 'text-align: center',
      action: () => { applyStyle('textAlign', 'center'); flashAction('align-center'); },
    },
    {
      id: 'align-right', category: 'content',
      icon: <AlignRight size={14} />,
      label: t('designMenu.alignRight'),
      description: 'text-align: right',
      action: () => { applyStyle('textAlign', 'right'); flashAction('align-right'); },
    },

    // ── APPEARANCE ──
    {
      id: 'text-color', category: 'appearance',
      icon: <Paintbrush size={14} />,
      label: t('designMenu.textColor'),
      description: t('designMenu.textColorDesc').replace('{color}', data.styles.color),
      action: () => { setColorPickerTarget('color'); setActiveSubPanel(null); },
      accent: true,
    },
    {
      id: 'bg-color', category: 'appearance',
      icon: <Square size={14} />,
      label: t('designMenu.bgColor'),
      description: t('designMenu.bgColorDesc').replace('{color}', data.styles.backgroundColor),
      action: () => { setColorPickerTarget('backgroundColor'); setActiveSubPanel(null); },
      accent: true,
    },
    {
      id: 'border-color', category: 'appearance',
      icon: <BoxSelect size={14} />,
      label: t('designMenu.borderColor'),
      description: t('designMenu.borderColor'),
      action: () => { setColorPickerTarget('borderColor'); setActiveSubPanel(null); },
    },
    {
      id: 'opacity-up', category: 'appearance',
      icon: <SunDim size={14} />,
      label: t('designMenu.opacityUp'),
      description: t('designMenu.opacityUpDesc'),
      action: () => {
        const current = parseFloat(data.styles.opacity) || 1;
        applyStyle('opacity', String(Math.min(1, +(current + 0.1).toFixed(1)))); flashAction('opacity-up');
      },
    },
    {
      id: 'opacity-down', category: 'appearance',
      icon: <SunDim size={14} />,
      label: t('designMenu.opacityDown'),
      description: t('designMenu.opacityDownDesc'),
      action: () => {
        const current = parseFloat(data.styles.opacity) || 1;
        applyStyle('opacity', String(Math.max(0, +(current - 0.1).toFixed(1)))); flashAction('opacity-down');
      },
    },
    {
      id: 'border-radius-add', category: 'appearance',
      icon: <Circle size={14} />,
      label: t('designMenu.borderRadiusAdd'),
      description: t('designMenu.borderRadiusAddDesc').replace('{radius}', data.styles.borderRadius),
      action: () => {
        const current = parseInt(data.styles.borderRadius) || 0;
        applyStyle('borderRadius', `${current + 4}px`); flashAction('border-radius-add');
      },
    },
    {
      id: 'border-radius-remove', category: 'appearance',
      icon: <BoxSelect size={14} />,
      label: t('designMenu.borderRadiusRemove'),
      description: 'border-radius: 0',
      action: () => { applyStyle('borderRadius', '0'); flashAction('border-radius-remove'); },
    },
    {
      id: 'border-add', category: 'appearance',
      icon: <Square size={14} />,
      label: t('designMenu.borderAdd'),
      description: '1px solid border',
      action: () => { applyStyle('border', '1px solid rgba(255,255,255,0.2)'); flashAction('border-add'); },
    },
    {
      id: 'border-2px', category: 'appearance',
      icon: <Square size={14} />,
      label: t('designMenu.border2px'),
      description: '2px solid border',
      action: () => { applyStyle('border', '2px solid rgba(255,255,255,0.3)'); flashAction('border-2px'); },
    },
    {
      id: 'border-remove', category: 'appearance',
      icon: <Minus size={14} />,
      label: t('designMenu.borderRemove'),
      description: 'border: none',
      action: () => { applyStyle('border', 'none'); flashAction('border-remove'); },
    },

    // ── LAYOUT ──
    {
      id: 'display-flex', category: 'layout',
      icon: <Columns size={14} />,
      label: 'Flex Layout',
      description: t('designMenu.displayFlexDesc'),
      action: () => { applyStyle('display', 'flex'); flashAction('display-flex'); },
      accent: true,
    },
    {
      id: 'display-grid', category: 'layout',
      icon: <Grid3X3 size={14} />,
      label: 'Grid Layout',
      description: t('designMenu.displayGridDesc'),
      action: () => { applyStyle('display', 'grid'); flashAction('display-grid'); },
    },
    {
      id: 'display-block', category: 'layout',
      icon: <Maximize2 size={14} />,
      label: t('designMenu.displayBlock'),
      description: t('designMenu.displayBlockDesc'),
      action: () => { applyStyle('display', 'block'); flashAction('display-block'); },
    },
    {
      id: 'display-inline-flex', category: 'layout',
      icon: <Columns size={14} />,
      label: t('designMenu.displayInlineFlex'),
      description: 'display:inline-flex',
      action: () => { applyStyle('display', 'inline-flex'); flashAction('display-inline-flex'); },
    },
    {
      id: 'display-none', category: 'layout',
      icon: <EyeOff size={14} />,
      label: t('designMenu.displayNone'),
      description: t('designMenu.displayNoneDesc'),
      action: () => { applyStyle('display', 'none'); flashAction('display-none'); },
    },
    {
      id: 'center-flex', category: 'layout',
      icon: <AlignCenter size={14} />,
      label: t('designMenu.centerFlex'),
      description: 'display:flex + align-items:center + justify-content:center',
      action: () => {
        applyMultiStyle({ display: 'flex', alignItems: 'center', justifyContent: 'center' });
        flashAction('center-flex');
      },
      accent: true,
    },
    {
      id: 'flex-column', category: 'layout',
      icon: <Columns size={14} />,
      label: t('designMenu.flexColumn'),
      description: t('designMenu.flexColumnDesc'),
      action: () => { applyMultiStyle({ display: 'flex', flexDirection: 'column' }); flashAction('flex-column'); },
    },
    {
      id: 'flex-between', category: 'layout',
      icon: <Columns size={14} />,
      label: t('designMenu.flexBetween'),
      description: t('designMenu.flexBetweenDesc'),
      action: () => { applyMultiStyle({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }); flashAction('flex-between'); },
    },
    {
      id: 'gap-add', category: 'layout',
      icon: <Plus size={14} />,
      label: t('designMenu.gapAdd'),
      description: t('designMenu.gapAddDesc'),
      action: () => {
        const current = parseInt(data.styles.gap) || 0;
        applyStyle('gap', `${current + 8}px`); flashAction('gap-add');
      },
    },
    {
      id: 'padding-add', category: 'layout',
      icon: <Plus size={14} />,
      label: t('designMenu.paddingAdd'),
      description: t('designMenu.paddingAddDesc').replace('{padding}', data.styles.padding),
      action: () => {
        const current = parseInt(data.styles.padding) || 0;
        applyStyle('padding', `${current + 8}px`); flashAction('padding-add');
      },
    },
    {
      id: 'padding-remove', category: 'layout',
      icon: <Minus size={14} />,
      label: t('designMenu.paddingRemove'),
      description: t('designMenu.paddingRemove'),
      action: () => {
        const current = parseInt(data.styles.padding) || 0;
        applyStyle('padding', `${Math.max(0, current - 8)}px`); flashAction('padding-remove');
      },
    },
    {
      id: 'margin-add', category: 'layout',
      icon: <Plus size={14} />,
      label: t('designMenu.marginAdd'),
      description: t('designMenu.marginAddDesc').replace('{margin}', data.styles.margin),
      action: () => {
        const current = parseInt(data.styles.margin) || 0;
        applyStyle('margin', `${current + 8}px`); flashAction('margin-add');
      },
    },
    {
      id: 'width-100', category: 'layout',
      icon: <Maximize2 size={14} />,
      label: t('designMenu.width100'),
      description: t('designMenu.width100Desc'),
      action: () => { applyStyle('width', '100%'); flashAction('width-100'); },
    },
    {
      id: 'position-relative', category: 'layout',
      icon: <Move size={14} />,
      label: t('designMenu.positionRelative'),
      description: t('designMenu.positionRelativeDesc'),
      action: () => { applyStyle('position', 'relative'); flashAction('position-relative'); },
    },
    {
      id: 'position-absolute', category: 'layout',
      icon: <Move size={14} />,
      label: t('designMenu.positionAbsolute'),
      description: t('designMenu.positionAbsoluteDesc'),
      action: () => { applyStyle('position', 'absolute'); flashAction('position-absolute'); },
    },
    {
      id: 'overflow-hidden', category: 'layout',
      icon: <BoxSelect size={14} />,
      label: t('designMenu.overflowHidden'),
      description: t('designMenu.overflowHiddenDesc'),
      action: () => { applyStyle('overflow', 'hidden'); flashAction('overflow-hidden'); },
    },

    // ── EFFECTS ──
    {
      id: 'shadow-presets', category: 'effects',
      icon: <Droplets size={14} />,
      label: t('designMenu.shadowPresets'),
      description: t('designMenu.shadowPresetsDesc'),
      action: () => { setActiveSubPanel('shadows'); setColorPickerTarget(null); },
      accent: true,
    },
    {
      id: 'animation-presets', category: 'effects',
      icon: <Zap size={14} />,
      label: t('designMenu.animationPresets'),
      description: t('designMenu.animationPresetsDesc'),
      action: () => { setActiveSubPanel('animations'); setColorPickerTarget(null); },
      accent: true,
    },
    {
      id: 'blur-add', category: 'effects',
      icon: <SunDim size={14} />,
      label: t('designMenu.blurAdd'),
      description: t('designMenu.blurAddDesc'),
      action: () => { applyStyle('filter', 'blur(4px)'); flashAction('blur-add'); },
    },
    {
      id: 'blur-remove', category: 'effects',
      icon: <RotateCcw size={14} />,
      label: t('designMenu.blurRemove'),
      description: t('designMenu.blurRemoveDesc'),
      action: () => { applyStyle('filter', 'none'); flashAction('blur-remove'); },
    },
    {
      id: 'backdrop-blur', category: 'effects',
      icon: <Wind size={14} />,
      label: t('designMenu.backdropBlur'),
      description: t('designMenu.backdropBlurDesc'),
      action: () => { applyStyle('backdropFilter', 'blur(12px)'); flashAction('backdrop-blur'); },
    },
    {
      id: 'transition-smooth', category: 'effects',
      icon: <Sparkles size={14} />,
      label: t('designMenu.transitionSmooth'),
      description: t('designMenu.transitionSmoothDesc'),
      action: () => { applyStyle('transition', 'all 0.3s ease'); flashAction('transition-smooth'); },
    },
    {
      id: 'transition-spring', category: 'effects',
      icon: <Sparkles size={14} />,
      label: t('designMenu.transitionSpring'),
      description: t('designMenu.transitionSpringDesc'),
      action: () => { applyStyle('transition', 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'); flashAction('transition-spring'); },
    },
    {
      id: 'scale-up', category: 'effects',
      icon: <Maximize2 size={14} />,
      label: t('designMenu.scaleUp'),
      description: t('designMenu.scaleUpDesc'),
      action: () => { applyStyle('transform', 'scale(1.1)'); flashAction('scale-up'); },
    },
    {
      id: 'rotate-5', category: 'effects',
      icon: <RotateCcw size={14} />,
      label: t('designMenu.rotate5'),
      description: t('designMenu.rotate5Desc'),
      action: () => { applyStyle('transform', 'rotate(5deg)'); flashAction('rotate-5'); },
    },
    {
      id: 'scale-reset', category: 'effects',
      icon: <RotateCcw size={14} />,
      label: t('designMenu.transformReset'),
      description: t('designMenu.transformResetDesc'),
      action: () => { applyStyle('transform', 'none'); flashAction('scale-reset'); },
    },

    // ── PREMIUM ──
    {
      id: 'gradient-presets', category: 'premium',
      icon: <Blend size={14} />,
      label: t('designMenu.gradientPresets'),
      description: t('designMenu.gradientPresetsDesc'),
      action: () => { setActiveSubPanel('gradients'); setColorPickerTarget(null); },
      accent: true,
    },
    {
      id: 'glassmorphism', category: 'premium',
      icon: <Gem size={14} />,
      label: t('designMenu.glassmorphism'),
      description: t('designMenu.glassmorphismDesc'),
      action: () => {
        applyMultiStyle({
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
        });
        flashAction('glassmorphism');
      },
      accent: true,
    },
    {
      id: 'glassmorphism-dark', category: 'premium',
      icon: <Gem size={14} />,
      label: t('designMenu.glassDark'),
      description: t('designMenu.glassDarkDesc'),
      action: () => {
        applyMultiStyle({
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        });
        flashAction('glassmorphism-dark');
      },
    },
    {
      id: 'neumorphism', category: 'premium',
      icon: <Wand2 size={14} />,
      label: t('designMenu.neumorphism'),
      description: t('designMenu.neumorphismDesc'),
      action: () => {
        applyMultiStyle({
          background: '#1e293b',
          borderRadius: '16px',
          boxShadow: '8px 8px 16px rgba(0,0,0,0.5), -8px -8px 16px rgba(255,255,255,0.05)',
          border: 'none',
        });
        flashAction('neumorphism');
      },
    },
    {
      id: 'neon-border', category: 'premium',
      icon: <Zap size={14} />,
      label: t('designMenu.neonBorder'),
      description: t('designMenu.neonBorderDesc'),
      action: () => {
        applyMultiStyle({
          border: '1px solid rgba(59,130,246,0.6)',
          boxShadow: '0 0 8px rgba(59,130,246,0.4), 0 0 24px rgba(59,130,246,0.15), inset 0 0 8px rgba(59,130,246,0.1)',
          borderRadius: '12px',
        });
        flashAction('neon-border');
      },
    },
    {
      id: 'neon-text', category: 'premium',
      icon: <Zap size={14} />,
      label: t('designMenu.neonText'),
      description: t('designMenu.neonTextDesc'),
      action: () => {
        applyMultiStyle({
          color: '#60a5fa',
          textShadow: '0 0 8px rgba(59,130,246,0.6), 0 0 24px rgba(59,130,246,0.3)',
        });
        flashAction('neon-text');
      },
    },
    {
      id: 'frosted-card', category: 'premium',
      icon: <Gem size={14} />,
      label: t('designMenu.frostedCard'),
      description: t('designMenu.frostedCardDesc'),
      action: () => {
        applyMultiStyle({
          background: 'rgba(17,24,39,0.6)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
          padding: '24px',
        });
        flashAction('frosted-card');
      },
    },
    {
      id: 'hover-lift', category: 'premium',
      icon: <Sparkles size={14} />,
      label: t('designMenu.hoverLift'),
      description: t('designMenu.hoverLiftDesc'),
      action: () => {
        applyMultiStyle({
          transition: 'all 0.3s ease',
          cursor: 'pointer',
        });
        flashAction('hover-lift');
      },
    },

    // ── STRUCTURE ──
    {
      id: 'duplicate', category: 'structure',
      icon: <Copy size={14} />,
      label: t('designMenu.duplicate'),
      description: t('designMenu.duplicateDesc'),
      action: () => { onDuplicateElement(data.selector); trackChange('__duplicate', 'true'); },
      accent: true,
    },
    {
      id: 'toggle-visibility', category: 'structure',
      icon: <Eye size={14} />,
      label: t('designMenu.toggleVisibility'),
      description: t('designMenu.toggleVisibilityDesc'),
      action: () => { onToggleVisibility(data.selector); },
    },
    {
      id: 'delete', category: 'structure',
      icon: <Trash2 size={14} />,
      label: t('designMenu.deleteElement'),
      description: t('designMenu.deleteElementDesc'),
      action: () => { onDeleteElement(data.selector); trackChange('__delete', 'true'); },
      danger: true,
    },
    {
      id: 'reset-styles', category: 'structure',
      icon: <RotateCcw size={14} />,
      label: t('designMenu.resetStyles'),
      description: t('designMenu.resetStylesDesc'),
      action: () => {
        applyMultiStyle({
          color: '', backgroundColor: '', fontSize: '', fontWeight: '',
          padding: '', margin: '', borderRadius: '', boxShadow: '',
          opacity: '', display: '', position: '', transform: '', filter: '',
          border: '', textAlign: '', textDecoration: '', fontStyle: '',
          transition: '', backdropFilter: '', width: '', gap: '',
          alignItems: '', justifyContent: '', flexDirection: '',
          background: '', textShadow: '', cursor: '', overflow: '',
          animation: '',
        });
        flashAction('reset-styles');
      },
    },
    ...(onAskAI ? [{
      id: 'ask-ai', category: 'structure',
      icon: <Send size={14} />,
      label: t('designMenu.askAI'),
      description: t('designMenu.askAIDesc'),
      action: () => {
        const info = `<${data.tagName}> ${data.selector} — ${data.textContent?.slice(0, 50) || '(bos)'}`;
        onAskAI(data.selector, info);
        onClose();
      },
      accent: true,
    }] : []),
  ];

  // Group by category
  const grouped = categories.map((cat) => ({
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
    <>
      {/* ═══ Backdrop — click to close ═══ */}
      <div
        className="fixed inset-0 z-[59]"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />

      {/* ═══ Menu ═══ */}
      <div
        ref={menuRef}
        className="fixed z-[60] flex animate-fade-in-up"
        style={{
          left: menuPos.left,
          top: menuPos.top,
        }}
      >
      {/* ═══ Main menu ═══ */}
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: 320,
          maxHeight: 'calc(100vh - 32px)',
          background: 'rgba(8,12,24,0.97)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(59,130,246,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* ─── Selected element info ─── */}
        <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
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
              &quot;{data.textContent}&quot;
            </p>
          )}
          {/* Current element dimensions + undo quick-action */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[9px] text-slate-600 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded">
              {Math.round(data.rect.width)}x{Math.round(data.rect.height)}
            </span>
            <span className="text-[9px] text-slate-600 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded">
              {data.styles.display}
            </span>
            <span className="text-[9px] text-slate-600 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded">
              {data.styles.fontSize}
            </span>
            <span className="text-[9px] text-slate-600 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded">
              {data.styles.position}
            </span>
            {onUndo && (
              <button
                onClick={() => { onUndo(); onClose(); }}
                className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[9px] text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-md transition-colors"
                title={t('designMenu.undoTitle')}
              >
                <RotateCcw size={10} />
                {t('designMenu.undoLabel')}
              </button>
            )}
          </div>
        </div>

        {/* ─── Category tabs ─── */}
        <div className="flex border-b border-white/[0.06] shrink-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(activeCategory === cat.id ? null : cat.id); setActiveSubPanel(null); setColorPickerTarget(null); }}
              className={`flex flex-col items-center gap-0.5 flex-1 py-2 transition-all ${
                activeCategory === cat.id
                  ? cat.id === 'premium' ? 'text-purple-400 bg-purple-500/8' : 'text-blue-400 bg-blue-500/8'
                  : 'text-slate-600 hover:text-slate-400 hover:bg-white/[0.02]'
              }`}
              title={cat.desc}
            >
              {cat.icon}
              <span className="text-[8px] font-medium">{cat.label}</span>
              {activeCategory === cat.id && (
                <div className={`w-4 h-0.5 rounded-full mt-0.5 ${cat.id === 'premium' ? 'bg-purple-400' : 'bg-blue-400'}`} />
              )}
            </button>
          ))}
        </div>

        {/* ─── Actions list (dynamic height) ─── */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {visibleGroups.map((group) => (
            <div key={group.id}>
              {!activeCategory && (
                <div className="px-4 py-2 flex items-center gap-2 sticky top-0 z-10" style={{ background: 'rgba(8,12,24,0.97)' }}>
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
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-2 flex-wrap shrink-0">
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

      {/* ═══ Side panel: Color picker / Gradients / Shadows / Animations ═══ */}
      {(colorPickerTarget || activeSubPanel) && (
        <div
          className="ml-3 rounded-2xl animate-fade-in-up self-start overflow-hidden flex flex-col"
          style={{
            width: 260,
            maxHeight: 'calc(100vh - 32px)',
            background: 'rgba(8,12,24,0.97)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 20px rgba(59,130,246,0.04), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* ── Color Picker ── */}
          {colorPickerTarget && (
            <div className="p-4 overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/15 flex items-center justify-center">
                  <Palette size={12} className="text-blue-400" />
                </div>
                <span className="text-xs text-slate-200 font-medium">
                  {colorPickerTarget === 'color' ? t('designMenu.textColorLabel') : colorPickerTarget === 'backgroundColor' ? t('designMenu.bgColorLabel') : t('designMenu.borderColorLabel')}
                </span>
              </div>

              {/* Current color preview */}
              <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                <div
                  className="w-8 h-8 rounded-lg border border-white/[0.1] shrink-0"
                  style={{ background: customColor === 'transparent' ? 'repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50% / 8px 8px' : customColor }}
                />
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block">{t('designMenu.selectedColor')}</span>
                  <span className="text-[11px] font-mono text-slate-200 truncate block">{customColor}</span>
                </div>
              </div>

              {/* Color groups */}
              {colorGroups.map((group) => (
                <div key={group.label} className="mb-2">
                  <span className="text-[8px] text-slate-600 font-medium uppercase tracking-wider mb-1 block">{group.label}</span>
                  <div className="flex gap-1 flex-wrap">
                    {group.colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setCustomColor(c);
                          applyStyle(colorPickerTarget, c);
                          flashAction('color-applied');
                        }}
                        className={`w-7 h-7 rounded-lg border transition-all hover:scale-110 active:scale-95 ${
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
                </div>
              ))}

              {/* Transparent button */}
              <button
                onClick={() => {
                  setCustomColor('transparent');
                  applyStyle(colorPickerTarget, 'transparent');
                  flashAction('color-applied');
                }}
                className={`w-full mb-3 py-1.5 text-[10px] font-mono rounded-lg border transition-all ${
                  customColor === 'transparent' ? 'border-blue-400 text-blue-400' : 'border-white/[0.06] text-slate-500 hover:border-white/[0.1]'
                }`}
                style={{ background: 'repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50% / 8px 8px' }}
              >
                transparent
              </button>

              {/* Custom color input */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customColor === 'transparent' ? '#000000' : customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-white/[0.08] bg-transparent shrink-0"
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
                    placeholder="#hex, rgb(), rgba()"
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
                  {t('designMenu.applyColor')}
                </button>
              </div>
            </div>
          )}

          {/* ── Gradient Presets ── */}
          {activeSubPanel === 'gradients' && (
            <div className="p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/15 flex items-center justify-center">
                  <Blend size={12} className="text-purple-400" />
                </div>
                <span className="text-xs text-slate-200 font-medium">{t('designMenu.gradientPanelTitle')}</span>
              </div>

              <div className="space-y-2">
                {gradientPresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      applyStyle('background', preset.value);
                      flashAction(`gradient-${preset.label}`);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] transition-all group"
                  >
                    <div
                      className="w-10 h-10 rounded-lg border border-white/[0.1] shrink-0"
                      style={{ background: preset.value }}
                    />
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-slate-200 group-hover:text-white">{preset.label}</div>
                      <div className="flex gap-1 mt-1">
                        {preset.colors.map((c, i) => (
                          <div key={i} className="w-3 h-3 rounded-full border border-white/[0.1]" style={{ background: c }} />
                        ))}
                      </div>
                    </div>
                    {appliedAction === `gradient-${preset.label}` && <Check size={14} className="text-green-400" />}
                  </button>
                ))}
              </div>

              {/* Custom gradient */}
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <span className="text-[10px] text-slate-500 font-medium block mb-2">{t('designMenu.customGradient')}</span>
                <input
                  type="text"
                  placeholder="linear-gradient(135deg, #a855f7, #ec4899)"
                  className="w-full text-[10px] font-mono rounded-lg px-3 py-2 text-slate-200 focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      applyStyle('background', (e.target as HTMLInputElement).value);
                      flashAction('gradient-custom');
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Shadow Presets ── */}
          {activeSubPanel === 'shadows' && (
            <div className="p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/15 flex items-center justify-center">
                  <Droplets size={12} className="text-cyan-400" />
                </div>
                <span className="text-xs text-slate-200 font-medium">{t('designMenu.shadowPanelTitle')}</span>
              </div>

              <div className="space-y-2">
                {shadowPresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      applyStyle('boxShadow', preset.value);
                      flashAction(`shadow-${preset.label}`);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] transition-all group"
                  >
                    <div
                      className="w-10 h-10 rounded-lg border border-white/[0.1] shrink-0"
                      style={{ background: '#1e293b', boxShadow: preset.value }}
                    />
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-slate-200 group-hover:text-white">{preset.label}</div>
                      <div className="text-[9px] text-slate-600 mt-0.5 truncate font-mono">{preset.value === 'none' ? '-' : preset.value.slice(0, 30) + '...'}</div>
                    </div>
                    {appliedAction === `shadow-${preset.label}` && <Check size={14} className="text-green-400" />}
                  </button>
                ))}
              </div>

              {/* Custom shadow */}
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <span className="text-[10px] text-slate-500 font-medium block mb-2">{t('designMenu.customShadow')}</span>
                <input
                  type="text"
                  placeholder="0 4px 20px rgba(0,0,0,0.3)"
                  className="w-full text-[10px] font-mono rounded-lg px-3 py-2 text-slate-200 focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      applyStyle('boxShadow', (e.target as HTMLInputElement).value);
                      flashAction('shadow-custom');
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Animation Presets ── */}
          {activeSubPanel === 'animations' && (
            <div className="p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/15 flex items-center justify-center">
                  <Zap size={12} className="text-yellow-400" />
                </div>
                <span className="text-xs text-slate-200 font-medium">{t('designMenu.animationPanelTitle')}</span>
              </div>

              <div className="space-y-1">
                {animationPresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      applyStyle('animation', preset.value);
                      flashAction(`anim-${preset.label}`);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all group"
                  >
                    <Zap size={14} className={`shrink-0 ${
                      appliedAction === `anim-${preset.label}` ? 'text-green-400' : 'text-yellow-500/60 group-hover:text-yellow-400'
                    }`} />
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-slate-200 group-hover:text-white">{preset.label}</div>
                      <div className="text-[9px] text-slate-600 mt-0.5 truncate font-mono">{preset.value}</div>
                    </div>
                    {appliedAction === `anim-${preset.label}` && <Check size={14} className="text-green-400" />}
                  </button>
                ))}
              </div>

              {/* Transition presets */}
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <span className="text-[10px] text-slate-500 font-medium block mb-2">{t('designMenu.transitionLabel')}</span>
                <div className="space-y-1">
                  {[
                    { label: 'Smooth', value: 'all 0.3s ease' },
                    { label: 'Spring', value: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' },
                    { label: 'Bounce', value: 'all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)' },
                    { label: t('designMenu.fast'), value: 'all 0.15s ease' },
                  ].map((tr) => (
                    <button
                      key={tr.label}
                      onClick={() => {
                        applyStyle('transition', tr.value);
                        flashAction(`tr-${tr.label}`);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all"
                    >
                      <Wind size={12} className="text-slate-500 shrink-0" />
                      <span className="text-[11px] text-slate-300 flex-1">{tr.label}</span>
                      <span className="text-[9px] font-mono text-slate-600">{tr.value.slice(4)}</span>
                      {appliedAction === `tr-${tr.label}` && <Check size={12} className="text-green-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
});
