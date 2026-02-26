import { useState, useRef, useCallback, useEffect, useReducer } from 'react';
import {
  Monitor, RefreshCw, ExternalLink, Eye, Layers,
  Send, Undo2, X, Save, Trash2, MapPin, Image,
  Move, Maximize2, Palette, Type, PenLine, Sparkles,
  AlertTriangle, PlusCircle, MessageSquare,
} from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import type { PromptPin, ReferenceImage } from '../../stores/agentStore';
import { useTranslation } from '../../i18n';
import { PromptPinModal } from './PromptPinModal';
import { EditorToolbar, type EditorTool } from './editor/EditorToolbar';
import { ComponentTree } from './editor/ComponentTree';
import { DiffViewer } from './editor/DiffViewer';
import type { ViewportPreset } from './editor/ViewportSelector';

/* ─── Types ────────────────────────────────────────────── */

interface SimulatorEmbedProps {
  projectId: string;
  onInject?: (prompt: string, context?: { filePath?: string; constraints?: string[] }) => void;
}

interface VisualEdit {
  id: string;
  type: string;
  selector: string;
  desc: string;
  coords: { x: number; y: number; w: number; h: number };
  from: Record<string, unknown>;
  to: Record<string, unknown>;
}

interface SelectedElement {
  selector: string;
  tag: string;
  id: string | null;
  classes: string[];
  text: string;
  html: string;
  rect: { x: number; y: number; width: number; height: number };
  computed: Record<string, string>;
}

interface AnnotationRequest {
  type: 'error' | 'add' | 'note';
  x: number;
  y: number;
  pageX?: number;
  pageY?: number;
  nearestElement?: { selector: string; tag: string; text: string } | null;
}

interface PinCreateRequest {
  x: number;
  y: number;
  pageX: number;
  pageY: number;
  nearestSelector: string;
  nearestElementDesc: string;
}

type EmbedMode = 'preview' | 'simulator';

/* ─── Undoable Edit Reducer ───────────────────────────── */

interface UndoableState {
  past: VisualEdit[][];
  present: VisualEdit[];
  future: VisualEdit[][];
}

type EditAction =
  | { type: 'ADD'; edit: VisualEdit }
  | { type: 'REMOVE'; editId: string }
  | { type: 'CLEAR' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESTORE'; edits: VisualEdit[] };

const initialUndoableState: UndoableState = { past: [], present: [], future: [] };

function undoableEditReducer(state: UndoableState, action: EditAction): UndoableState {
  switch (action.type) {
    case 'ADD':
      return {
        past: [...state.past, state.present],
        present: [...state.present, action.edit],
        future: [],
      };
    case 'REMOVE':
      return {
        past: [...state.past, state.present],
        present: state.present.filter((e) => e.id !== action.editId),
        future: [],
      };
    case 'CLEAR':
      return {
        past: [...state.past, state.present],
        present: [],
        future: [],
      };
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
    case 'RESTORE':
      return { past: [], present: action.edits, future: [] };
    default:
      return state;
  }
}

// Backwards compat helper — extract present from undoable state
function editReducer(state: VisualEdit[], action: Exclude<EditAction, { type: 'UNDO' | 'REDO' | 'RESTORE' }>): VisualEdit[] {
  switch (action.type) {
    case 'ADD': return [...state, action.edit];
    case 'REMOVE': return state.filter((e) => e.id !== action.editId);
    case 'CLEAR': return [];
    default: return state;
  }
}

/* ─── Helpers ──────────────────────────────────────────── */

function getSimulatorUrl(projectId: string): string {
  const isDev = window.location.port === '6400' || window.location.hostname === 'localhost';
  const base = isDev ? 'http://localhost:5174' : '';
  return `${base}/simulator/?projectId=${encodeURIComponent(projectId)}`;
}

interface DevServerInfo {
  status: string;
  port: number;
  url: string;
}

function getPreviewUrl(projectId: string, _devServer?: DevServerInfo | null): string {
  // Always route through Voltron server proxy to ensure editor script injection
  // Server will proxy to dev server when available, falling back to static files
  const isDev = window.location.port === '6400' || window.location.hostname === 'localhost';
  const base = isDev ? 'http://localhost:8600' : '';
  return `${base}/api/projects/${encodeURIComponent(projectId)}/agent/preview/index.html`;
}

/* ─── Phase Formatter ─────────────────────────────────── */

function formatPhasePrompt(
  edits: VisualEdit[],
  pins: PromptPin[],
  refImage: ReferenceImage | null,
): string {
  const now = new Date().toISOString();

  // Categorize edits
  const styleEdits = edits.filter((e) => ['recolor', 'refont', 'effect', 'move', 'resize'].includes(e.type));
  const contentEdits = edits.filter((e) => ['retext', 'add_here'].includes(e.type));
  const errorEdits = edits.filter((e) => ['mark_error'].includes(e.type));
  const noteEdits = edits.filter((e) => ['annotate'].includes(e.type));

  // Build phases
  const phases: { title: string; items: string[] }[] = [];
  let globalIdx = 0;

  if (styleEdits.length > 0) {
    const items: string[] = [];
    for (const edit of styleEdits) {
      globalIdx++;
      const lines: string[] = [];
      lines.push(`[${globalIdx}] ${edit.type.toUpperCase()} — ${edit.selector}`);
      lines.push(`    Koordinat: (${edit.coords.x}, ${edit.coords.y}) ${edit.coords.w}x${edit.coords.h}`);

      switch (edit.type) {
        case 'recolor':
          lines.push(`    ${edit.to.target || 'text'}: ${edit.from.value} → ${edit.to.value}`);
          lines.push(`    KABUL KRITERI: ${edit.selector} ${edit.from.property} === ${edit.to.value}`);
          break;
        case 'refont':
          if (edit.to.fontSize !== edit.from.fontSize) lines.push(`    font-size: ${edit.from.fontSize} → ${edit.to.fontSize}`);
          if (edit.to.fontFamily !== edit.from.fontFamily) lines.push(`    font-family: ${edit.from.fontFamily} → ${edit.to.fontFamily}`);
          lines.push(`    KABUL KRITERI: ${edit.selector} font-size === ${edit.to.fontSize}`);
          break;
        case 'effect':
          Object.keys(edit.to).forEach((k) => lines.push(`    ${k}: ${edit.to[k]}`));
          lines.push(`    KABUL KRITERI: ${edit.selector} efekt uygulanmis`);
          break;
        case 'move':
          lines.push(`    Hareket: deltaX=${edit.to.deltaX}px, deltaY=${edit.to.deltaY}px`);
          lines.push(`    KABUL KRITERI: ${edit.selector} transform icinde translate degerleri`);
          break;
        case 'resize':
          lines.push(`    Boyut: ${edit.from.width}x${edit.from.height} → ${edit.to.width}x${edit.to.height}`);
          lines.push(`    KABUL KRITERI: ${edit.selector} width === ${edit.to.width}px`);
          break;
      }
      items.push(lines.join('\n'));
    }
    phases.push({ title: 'Stil Degisiklikleri', items });
  }

  // Content phase (texts + adds + prompt pins)
  const contentItems: string[] = [];
  for (const edit of contentEdits) {
    globalIdx++;
    const lines: string[] = [];
    if (edit.type === 'retext') {
      lines.push(`[${globalIdx}] RETEXT — ${edit.selector}`);
      lines.push(`    Koordinat: (${edit.coords.x}, ${edit.coords.y}) ${edit.coords.w}x${edit.coords.h}`);
      lines.push(`    Eski: "${edit.from.text}"`);
      lines.push(`    Yeni: "${edit.to.text}"`);
      lines.push(`    KABUL KRITERI: ${edit.selector} textContent === "${edit.to.text}"`);
    } else {
      lines.push(`[${globalIdx}] ADD_HERE — viewport`);
      lines.push(`    Koordinat: (${edit.to?.pageX || edit.coords.x}, ${edit.to?.pageY || edit.coords.y})`);
      lines.push(`    Talimat: "${edit.to?.note || ''}"`);
      lines.push(`    KABUL KRITERI: Belirtilen konumda yeni element var`);
    }
    contentItems.push(lines.join('\n'));
  }
  for (const pin of pins) {
    globalIdx++;
    const lines: string[] = [];
    lines.push(`[${globalIdx}] PROMPT_PIN — Koordinat: (${Math.round(pin.pageX)}, ${Math.round(pin.pageY)})`);
    lines.push(`    Yakin Element: ${pin.nearestSelector} (${pin.nearestElementDesc})`);
    lines.push(`    Talimat: "${pin.prompt}"`);
    lines.push(`    KABUL KRITERI: Talimat uygulanmis`);
    contentItems.push(lines.join('\n'));
  }
  if (contentItems.length > 0) {
    phases.push({ title: 'Icerik Eklemeleri', items: contentItems });
  }

  // Error phase
  if (errorEdits.length > 0 || noteEdits.length > 0) {
    const items: string[] = [];
    for (const edit of [...errorEdits, ...noteEdits]) {
      globalIdx++;
      const lines: string[] = [];
      const typeLabel = edit.type === 'mark_error' ? 'MARK_ERROR' : 'ANNOTATE';
      lines.push(`[${globalIdx}] ${typeLabel} — Koordinat: (${edit.to?.pageX || edit.coords.x}, ${edit.to?.pageY || edit.coords.y})`);
      if (edit.to?.note) lines.push(`    ${edit.type === 'mark_error' ? 'Hata' : 'Not'}: "${edit.to.note}"`);
      lines.push(`    KABUL KRITERI: Belirtilen hata/not duzeltilmis`);
      items.push(lines.join('\n'));
    }
    phases.push({ title: 'Hata Duzeltmeleri', items });
  }

  // Build final output
  const totalOps = globalIdx;
  const output: string[] = [];
  output.push('=== VOLTRON GORSEL KOMUT SISTEMI ===');
  output.push(`Tarih: ${now}`);
  output.push(`Toplam Islem: ${totalOps} (${styleEdits.length} stil, ${contentItems.length} icerik, ${errorEdits.length + noteEdits.length} hata/not)`);
  output.push(`Referans Gorsel: ${refImage ? 'var' : 'yok'}`);
  output.push('');

  phases.forEach((phase, pi) => {
    output.push(`--- FAZ ${pi + 1}/${phases.length}: ${phase.title} ---`);
    for (const item of phase.items) {
      output.push(item);
      output.push('');
    }
  });

  output.push('=== UYGULAMA KURALLARI ===');
  output.push('1. Her fazi sirayla uygula');
  output.push('2. Bir faz tamamlanmadan sonrakine GECME');
  output.push('3. Her islem sonrasi KABUL KRITERINI dogrula');
  output.push('4. Basarisiz olursa sebebini raporla ve dur');
  output.push('5. Selektorler ve koordinatlar kesindir');

  return output.join('\n');
}

/* ─── Component ────────────────────────────────────────── */

export function SimulatorEmbed({ projectId, onInject }: SimulatorEmbedProps) {
  const { t } = useTranslation();
  const status = useAgentStore((s) => s.status);
  const location = useAgentStore((s) => s.location);
  const devServer = useAgentStore((s) => s.devServer);
  const promptPins = useAgentStore((s) => s.promptPins);
  const addPromptPin = useAgentStore((s) => s.addPromptPin);
  const updatePromptPin = useAgentStore((s) => s.updatePromptPin);
  const _removePromptPin = useAgentStore((s) => s.removePromptPin);
  const clearPromptPins = useAgentStore((s) => s.clearPromptPins);
  const referenceImage = useAgentStore((s) => s.referenceImage);
  const setReferenceImage = useAgentStore((s) => s.setReferenceImage);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [mode, setMode] = useState<EmbedMode>('preview');
  const [editState, dispatchEdit] = useReducer(undoableEditReducer, initialUndoableState);
  const edits = editState.present;
  const canUndo = editState.past.length > 0;
  const canRedo = editState.future.length > 0;
  const [_selected, setSelected] = useState<SelectedElement | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [showEditList, setShowEditList] = useState(false);
  const [showComponentTree, setShowComponentTree] = useState(false);
  const [showDiffView, setShowDiffView] = useState(false);
  const [viewportPreset, setViewportPreset] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [editorTool, setEditorTool] = useState<'select' | 'move' | 'resize'>('select');
  const [annReq, setAnnReq] = useState<AnnotationRequest | null>(null);
  const [annText, setAnnText] = useState('');
  const annInputRef = useRef<HTMLInputElement>(null);
  const prevLocationRef = useRef(location);

  // Prompt pin modal state
  const [pinCreateReq, setPinCreateReq] = useState<PinCreateRequest | null>(null);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);

  const isActive = !['IDLE'].includes(status);
  const canInject = ['RUNNING', 'PAUSED'].includes(status);
  const isPreview = mode === 'preview';
  const currentUrl = isPreview ? getPreviewUrl(projectId, devServer) : getSimulatorUrl(projectId);
  const viewportWidth = viewportPreset === 'desktop' ? '100%' : viewportPreset === 'tablet' ? '768px' : '375px';

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatchEdit({ type: 'UNDO' });
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatchEdit({ type: 'REDO' });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Persist edits to localStorage
  useEffect(() => {
    if (edits.length > 0) {
      localStorage.setItem(`voltron_visual_edits_${projectId}`, JSON.stringify(edits));
    }
  }, [edits, projectId]);

  // Restore edits from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`voltron_visual_edits_${projectId}`);
      if (saved) {
        const parsed = JSON.parse(saved) as VisualEdit[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          dispatchEdit({ type: 'RESTORE', edits: parsed });
        }
      }
    } catch { /* ignore */ }
  }, [projectId]);

  // Auto-refresh when dev server becomes ready
  const prevDevServerStatus = useRef(devServer?.status);
  useEffect(() => {
    if (prevDevServerStatus.current !== 'ready' && devServer?.status === 'ready' && isPreview) {
      setIframeKey((k) => k + 1);
    }
    prevDevServerStatus.current = devServer?.status;
  }, [devServer?.status, isPreview]);

  // Auto-refresh on agent write
  useEffect(() => {
    const prev = prevLocationRef.current;
    prevLocationRef.current = location;
    if (isPreview && location?.activity === 'WRITING' && prev?.filePath !== location.filePath) {
      setIframeKey((k) => k + 1);
    }
  }, [location, isPreview]);

  const postToIframe = useCallback((msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  }, []);

  const removeEdit = useCallback((editId: string) => {
    postToIframe({ type: 'VOLTRON_REMOVE_EDIT', editId });
  }, [postToIframe]);

  const clearEdits = useCallback(() => {
    postToIframe({ type: 'VOLTRON_CLEAR_EDITS' });
  }, [postToIframe]);

  const submitAnnotation = useCallback(() => {
    if (!annReq || !annText.trim()) return;
    postToIframe({
      type: 'VOLTRON_ADD_ANNOTATION',
      x: annReq.x, y: annReq.y,
      annotationType: annReq.type,
      note: annText.trim(),
    });
    setAnnReq(null);
    setAnnText('');
  }, [annReq, annText, postToIframe]);

  // Handle context actions from iframe
  const handleContextAction = useCallback((payload: Record<string, unknown> | null) => {
    if (!payload?.action) return;
    switch (payload.action) {
      case 'add_prompt_pin':
      case 'prompt_pin_added':
        setPinCreateReq({
          x: (payload.x as number) || 0,
          y: (payload.y as number) || 0,
          pageX: (payload.pageX as number) || (payload.x as number) || 0,
          pageY: (payload.pageY as number) || (payload.y as number) || 0,
          nearestSelector: (payload.nearestSelector as string) || '',
          nearestElementDesc: (payload.nearestElementDesc as string) || '',
        });
        break;
      case 'request_reference_image':
        fileInputRef.current?.click();
        break;
      case 'clear_all':
        clearEdits();
        clearPromptPins();
        break;
      case 'annotate_error':
      case 'annotate_add':
      case 'annotate_note':
        // Annotation already created in iframe via context menu prompt() — no parent action needed
        break;
      case 'reference_image_uploaded':
        // iframe handled the file upload internally — nothing extra needed
        break;
      case 'toggle_all_pins':
      case 'edit_text':
      case 'copy_selector':
      case 'expand_shrink':
      case 'change_color':
      case 'change_font_size':
      case 'add_effect':
      case 'reference_image_set':
        // These actions are handled entirely within the iframe editor-script.
        // The context action notification is informational only.
        break;
    }
  }, [clearEdits, clearPromptPins]);

  // Send language to iframe when editor is ready
  useEffect(() => {
    if (editorReady) {
      const lang = document.documentElement.getAttribute('data-voltron-lang') || 'tr';
      postToIframe({ type: 'VOLTRON_SET_LANG', lang });
    }
  }, [editorReady, postToIframe]);

  // postMessage listener
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (!e.data?.type) return;
      switch (e.data.type) {
        case 'VOLTRON_INSPECTOR_READY':
          setEditorReady(true);
          break;
        case 'VOLTRON_SELECTION_CHANGED':
          setSelected(e.data.payload as SelectedElement | null);
          break;
        case 'VOLTRON_EDIT_CREATED':
          if (e.data.payload?.edit) dispatchEdit({ type: 'ADD', edit: e.data.payload.edit });
          break;
        case 'VOLTRON_EDIT_REMOVED':
          if (e.data.payload?.editId) dispatchEdit({ type: 'REMOVE', editId: e.data.payload.editId });
          break;
        case 'VOLTRON_EDITS_CLEARED':
          dispatchEdit({ type: 'CLEAR' });
          break;
        case 'VOLTRON_ANNOTATION_REQUEST':
          setAnnReq(e.data.payload as AnnotationRequest);
          setAnnText('');
          setTimeout(() => annInputRef.current?.focus(), 50);
          break;
        case 'VOLTRON_CONTEXT_ACTION':
          handleContextAction(e.data.payload);
          break;
        case 'VOLTRON_PIN_CLICKED': {
          const pinData = e.data.payload;
          if (pinData?.pinId) {
            // pinId may be parent's string id or iframe's numeric pinNum
            const pin = promptPins.find((p) => p.id === pinData.pinId || p.id === String(pinData.pinId));
            if (pin) setEditingPinId(pin.id);
          }
          break;
        }
        case 'VOLTRON_PIN_MOVED': {
          const moveData = e.data.payload;
          if (moveData?.pinId) {
            const movedPin = promptPins.find((p) => p.id === moveData.pinId || p.id === String(moveData.pinId));
            if (movedPin) {
              updatePromptPin(movedPin.id, {
                x: (moveData.x as number) || movedPin.x,
                y: (moveData.y as number) || movedPin.y,
              });
            }
          }
          break;
        }
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [promptPins, handleContextAction]);

  // Reset on iframe/mode change
  useEffect(() => {
    setEditorReady(false);
    setSelected(null);
    dispatchEdit({ type: 'CLEAR' });
    setAnnReq(null);
  }, [iframeKey, mode]);

  // Handle reference image file selection
  const handleRefImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setReferenceImage({ dataUrl, opacity: 0.5 });
      postToIframe({ type: 'VOLTRON_SET_REFERENCE_IMAGE', dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [setReferenceImage, postToIframe]);

  // Save prompt pin
  const handleSavePin = useCallback((prompt: string) => {
    if (editingPinId) {
      updatePromptPin(editingPinId, prompt);
      setEditingPinId(null);
    } else if (pinCreateReq) {
      const pin: PromptPin = {
        id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        x: pinCreateReq.x,
        y: pinCreateReq.y,
        pageX: pinCreateReq.pageX,
        pageY: pinCreateReq.pageY,
        prompt,
        nearestSelector: pinCreateReq.nearestSelector,
        nearestElementDesc: pinCreateReq.nearestElementDesc,
        createdAt: Date.now(),
      };
      addPromptPin(pin);
      // Tell iframe to show the pin
      postToIframe({
        type: 'VOLTRON_ADD_PROMPT_PIN',
        pinId: pin.id,
        x: pin.x,
        y: pin.y,
        prompt: pin.prompt,
        number: promptPins.length + 1,
      });
      setPinCreateReq(null);
    }
  }, [editingPinId, pinCreateReq, updatePromptPin, addPromptPin, postToIframe, promptPins.length]);

  // SAVE & SEND — Phase-formatted
  const handleSaveAndSend = useCallback(() => {
    if ((edits.length === 0 && promptPins.length === 0) || !onInject) return;

    const prompt = formatPhasePrompt(edits, promptPins, referenceImage);

    onInject(prompt, {
      filePath: 'index.html',
      constraints: [
        ...edits.map((e, i) => `[${i + 1}] ${e.type}: ${e.selector} @ (${e.coords.x},${e.coords.y})`),
        ...promptPins.map((p, i) => `[pin-${i + 1}] prompt @ (${Math.round(p.pageX)},${Math.round(p.pageY)})`),
      ],
    });
    clearEdits();
    clearPromptPins();
  }, [edits, promptPins, referenceImage, onInject, clearEdits, clearPromptPins]);

  const editingPin = editingPinId ? promptPins.find((p) => p.id === editingPinId) : null;
  const totalChanges = edits.length + promptPins.length;

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-lg border border-gray-800/50 shadow-lg shadow-blue-500/5 overflow-hidden">
      {/* Hidden file input for reference image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleRefImageSelect}
      />

      {/* ─── Minimal header ─── */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-800/50 bg-gray-900/60 backdrop-blur-sm">
        <Monitor className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
          {isPreview ? t('agent.preview') : t('agent.simulator')}
        </span>

        {isPreview && editorReady && (
          <span className="text-[9px] text-gray-600 ml-1">
            {t('agent.editorHint')}
          </span>
        )}

        {/* Dev server status indicator */}
        {devServer && devServer.status !== 'stopped' && (
          <span className={`flex items-center gap-1 text-[9px] font-medium ml-1 ${
            devServer.status === 'ready' ? 'text-green-400' :
            devServer.status === 'installing' ? 'text-yellow-400' :
            devServer.status === 'starting' ? 'text-blue-400' :
            'text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              devServer.status === 'ready' ? 'bg-green-400' :
              devServer.status === 'installing' ? 'bg-yellow-400' :
              devServer.status === 'starting' ? 'bg-blue-400' :
              'bg-red-400'
            }`} />
            {devServer.status === 'ready' ? `${t('agent.devServerReady')} :${devServer.port}` :
             devServer.status === 'installing' ? t('agent.installing') :
             devServer.status === 'starting' ? t('agent.devServerStarting') :
             t('agent.devServerError')}
          </span>
        )}

        <div className="flex-1" />

        {/* Pin count badge */}
        {promptPins.length > 0 && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600/20 text-blue-400 border border-blue-600/40">
            <MapPin className="w-2.5 h-2.5" />
            {promptPins.length}
          </span>
        )}

        {/* Reference image indicator */}
        {referenceImage && (
          <button
            onClick={() => setReferenceImage(null)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-600/20 text-purple-400 border border-purple-600/40 hover:bg-purple-600/30 transition-colors"
            title={t('agent.refImage.remove')}
          >
            <Image className="w-2.5 h-2.5" />
          </button>
        )}

        {/* Edit count badge */}
        {edits.length > 0 && (
          <button
            onClick={() => setShowEditList(!showEditList)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-600/20 text-orange-400 border border-orange-600/40 hover:bg-orange-600/30 transition-colors"
          >
            <Save className="w-2.5 h-2.5" />
            {edits.length}
          </button>
        )}

        <button
          onClick={() => { setMode((m) => (m === 'preview' ? 'simulator' : 'preview')); setIframeKey((k) => k + 1); }}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
            isPreview ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-700/40' : 'bg-purple-900/30 text-purple-400 border border-purple-700/40'
          }`}
        >
          {isPreview ? <Eye className="w-2.5 h-2.5" /> : <Layers className="w-2.5 h-2.5" />}
          <span>{isPreview ? t('agent.previewMode') : t('agent.simulatorMode')}</span>
        </button>

        <button onClick={() => setIframeKey((k) => k + 1)} className="p-1 hover:bg-gray-800 rounded transition-colors">
          <RefreshCw className="w-3 h-3 text-gray-500 hover:text-gray-300" />
        </button>
        <button onClick={() => window.open(currentUrl, '_blank')} className="p-1 hover:bg-gray-800 rounded transition-colors">
          <ExternalLink className="w-3 h-3 text-gray-500 hover:text-gray-300" />
        </button>
      </div>

      {/* ─── Annotation input ─── */}
      {annReq && (
        <div className="px-2 py-1.5 border-b border-yellow-800/40 bg-yellow-950/30 flex items-center gap-2">
          {annReq.type === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
          {annReq.type === 'add' && <PlusCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />}
          {annReq.type === 'note' && <MessageSquare className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
          <input
            ref={annInputRef}
            value={annText}
            onChange={(e) => setAnnText(e.target.value)}
            placeholder={
              annReq.type === 'error' ? t('agent.errorNotePlaceholder')
                : annReq.type === 'add' ? t('agent.addNotePlaceholder')
                : t('agent.annotationPlaceholder')
            }
            className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-yellow-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitAnnotation();
              if (e.key === 'Escape') setAnnReq(null);
            }}
          />
          <button onClick={submitAnnotation} disabled={!annText.trim()} className="p-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 text-white rounded transition-colors">
            <Send className="w-3 h-3" />
          </button>
          <button onClick={() => setAnnReq(null)} className="p-1 hover:bg-gray-800 rounded">
            <X className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      )}

      {/* ─── Editor Toolbar ─── */}
      {isPreview && editorReady && (
        <EditorToolbar
          activeTool={editorTool}
          onToolChange={setEditorTool}
          viewport={viewportPreset}
          onViewportChange={setViewportPreset}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => dispatchEdit({ type: 'UNDO' })}
          onRedo={() => dispatchEdit({ type: 'REDO' })}
          onToggleTree={() => setShowComponentTree(!showComponentTree)}
          onToggleDiff={() => setShowDiffView(!showDiffView)}
          onSave={handleSaveAndSend}
          editCount={edits.length}
          treeVisible={showComponentTree}
          diffVisible={showDiffView}
        />
      )}

      {/* ─── Main: iframe + edit list ─── */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 min-w-0 flex items-center justify-center overflow-auto" style={{ background: viewportPreset !== 'desktop' ? '#1a1a2e' : undefined }}>
          {isActive ? (
            <div style={{ width: viewportWidth, height: '100%', position: 'relative' }} className={viewportPreset !== 'desktop' ? 'mx-auto shadow-xl rounded-lg overflow-hidden border border-slate-700/30' : ''}>
              <iframe
                key={`${mode}-${iframeKey}`}
                ref={iframeRef}
                src={currentUrl}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                className="w-full h-full border-0 bg-white"
                title={isPreview ? 'Agent Preview' : 'Simulator Preview'}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Monitor className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-xs text-gray-600">{t('agent.simulatorIdle')}</p>
              </div>
            </div>
          )}

          {/* Component Tree overlay */}
          <ComponentTree
            iframeRef={iframeRef}
            visible={showComponentTree}
            onClose={() => setShowComponentTree(false)}
            onSelect={(selector) => {
              iframeRef.current?.contentWindow?.postMessage({ type: 'VOLTRON_SELECT_ELEMENT', selector }, '*');
            }}
          />

          {/* Diff View overlay */}
          <DiffViewer
            edits={edits}
            visible={showDiffView}
            onClose={() => setShowDiffView(false)}
          />
        </div>

        {showEditList && edits.length > 0 && (
          <EditListSidebar
            edits={edits}
            canInject={canInject && !!onInject}
            onRemove={removeEdit}
            onClear={clearEdits}
            onSaveAndSend={handleSaveAndSend}
            onClose={() => setShowEditList(false)}
          />
        )}
      </div>

      {/* ─── Bottom: Save & Send bar ─── */}
      {totalChanges > 0 && canInject && onInject && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-orange-800/40 bg-gradient-to-r from-orange-950/40 to-gray-950">
          <span className="text-[10px] text-orange-400 font-medium">
            {edits.length > 0 && `${edits.length} ${t('agent.pendingEdits')}`}
            {edits.length > 0 && promptPins.length > 0 && ' + '}
            {promptPins.length > 0 && `${promptPins.length} ${t('agent.promptPin.count')}`}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => { clearEdits(); clearPromptPins(); }}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-red-400 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
          >
            <Trash2 className="w-2.5 h-2.5" />
            {t('agent.clearAll')}
          </button>
          <button onClick={() => setShowEditList(!showEditList)} className="px-2 py-1 text-[10px] text-gray-300 bg-gray-800 hover:bg-gray-700 rounded transition-colors">
            {showEditList ? t('agent.hideEdits') : t('agent.showEdits')}
          </button>
          <button
            onClick={handleSaveAndSend}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-lg shadow-lg shadow-orange-600/20 transition-all hover:scale-105"
          >
            <Send className="w-3.5 h-3.5" />
            {t('agent.saveAndSend')}
          </button>
        </div>
      )}

      {/* ─── Prompt Pin Modal ─── */}
      {pinCreateReq && (
        <PromptPinModal
          x={pinCreateReq.x}
          y={pinCreateReq.y}
          pageX={pinCreateReq.pageX}
          pageY={pinCreateReq.pageY}
          nearestSelector={pinCreateReq.nearestSelector}
          nearestElementDesc={pinCreateReq.nearestElementDesc}
          onSave={handleSavePin}
          onCancel={() => setPinCreateReq(null)}
        />
      )}

      {/* ─── Edit Pin Modal ─── */}
      {editingPin && (
        <PromptPinModal
          x={editingPin.x}
          y={editingPin.y}
          pageX={editingPin.pageX}
          pageY={editingPin.pageY}
          nearestSelector={editingPin.nearestSelector}
          nearestElementDesc={editingPin.nearestElementDesc}
          initialPrompt={editingPin.prompt}
          isEdit
          onSave={handleSavePin}
          onCancel={() => setEditingPinId(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EDIT LIST SIDEBAR
   ═══════════════════════════════════════════════════════════ */

interface EditListSidebarProps {
  edits: VisualEdit[];
  canInject: boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
  onSaveAndSend: () => void;
  onClose: () => void;
}

const EDIT_ICONS: Record<string, typeof Move> = {
  move: Move, resize: Maximize2, recolor: Palette, refont: Type, retext: PenLine,
  effect: Sparkles, mark_error: AlertTriangle, add_here: PlusCircle, annotate: MessageSquare,
};
const EDIT_COLORS: Record<string, string> = {
  move: 'text-blue-400', resize: 'text-cyan-400', recolor: 'text-pink-400', refont: 'text-purple-400',
  retext: 'text-green-400', effect: 'text-yellow-400', mark_error: 'text-red-400', add_here: 'text-emerald-400', annotate: 'text-amber-400',
};

function EditListSidebar({ edits, canInject, onRemove, onClear, onSaveAndSend, onClose }: EditListSidebarProps) {
  const { t } = useTranslation();
  return (
    <div className="w-52 shrink-0 border-l border-gray-800/50 bg-gray-900/80 backdrop-blur-sm flex flex-col">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-800/50">
        <Save className="w-3 h-3 text-orange-400" />
        <span className="text-[10px] text-gray-300 font-medium flex-1">{t('agent.editList')} ({edits.length})</span>
        <button onClick={onClose} className="p-0.5 hover:bg-gray-800 rounded"><X className="w-3 h-3 text-gray-500" /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {edits.map((edit, i) => {
          const Icon = EDIT_ICONS[edit.type] || MessageSquare;
          const color = EDIT_COLORS[edit.type] || 'text-gray-400';
          return (
            <div key={edit.id} className="flex items-start gap-1.5 px-2 py-1.5 border-b border-gray-800/30 hover:bg-gray-800/30 group transition-colors">
              <span className="text-[9px] text-gray-600 mt-0.5 w-3 text-right shrink-0">{i + 1}</span>
              <Icon className={`w-3 h-3 shrink-0 mt-0.5 ${color}`} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-300 truncate">{edit.desc}</div>
                {edit.selector !== 'viewport' && <div className="text-[9px] text-gray-600 font-mono truncate">{edit.selector}</div>}
              </div>
              <button onClick={() => onRemove(edit.id)} className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-900/30 rounded transition-all" title={t('agent.removeEdit')}>
                <Undo2 className="w-2.5 h-2.5 text-red-400" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="p-2 border-t border-gray-800/50 space-y-1.5">
        <button onClick={onClear} className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] text-gray-400 bg-gray-800 hover:bg-gray-700 rounded transition-colors">
          <Trash2 className="w-2.5 h-2.5" />{t('agent.clearAll')}
        </button>
        {canInject && (
          <button onClick={onSaveAndSend} className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-lg shadow-lg shadow-orange-600/20 transition-all">
            <Send className="w-3 h-3" />{t('agent.saveAndSend')}
          </button>
        )}
      </div>
    </div>
  );
}
