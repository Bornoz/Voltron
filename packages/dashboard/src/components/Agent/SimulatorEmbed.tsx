import { useState, useRef, useCallback, useEffect, useReducer } from 'react';
import {
  Monitor, RefreshCw, ExternalLink, Eye, Layers,
  Palette, Type, Sparkles, Send, Undo2, X, Save, Trash2,
  Move, Maximize2, PenLine, AlertTriangle, PlusCircle, MessageSquare,
} from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { useTranslation } from '../../i18n';

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
  from: any;
  to: any;
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
}

type EmbedMode = 'preview' | 'simulator';

/* ─── Edit Reducer ─────────────────────────────────────── */

type EditAction = { type: 'ADD'; edit: VisualEdit } | { type: 'REMOVE'; editId: string } | { type: 'CLEAR' };
function editReducer(state: VisualEdit[], action: EditAction): VisualEdit[] {
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

function getPreviewUrl(projectId: string, devServer?: DevServerInfo | null): string {
  if (devServer?.status === 'ready' && devServer.url) {
    return devServer.url;
  }
  const isDev = window.location.port === '6400' || window.location.hostname === 'localhost';
  const base = isDev ? 'http://localhost:8600' : '';
  return `${base}/api/projects/${encodeURIComponent(projectId)}/agent/preview/index.html`;
}

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#000000',
  '#1e293b', '#64748b', '#f1f5f9',
];

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '48px'];

const SHADOW_PRESETS: { label: string; value: string }[] = [
  { label: 'Yok', value: 'none' },
  { label: 'Hafif', value: '0 1px 3px rgba(0,0,0,0.12)' },
  { label: 'Orta', value: '0 4px 12px rgba(0,0,0,0.15)' },
  { label: 'Guclu', value: '0 8px 30px rgba(0,0,0,0.25)' },
  { label: 'Kabartma', value: '0 2px 0 rgba(255,255,255,0.2) inset, 0 -2px 0 rgba(0,0,0,0.1) inset, 0 4px 8px rgba(0,0,0,0.2)' },
];

/* ─── Component ────────────────────────────────────────── */

export function SimulatorEmbed({ projectId, onInject }: SimulatorEmbedProps) {
  const { t } = useTranslation();
  const status = useAgentStore((s) => s.status);
  const location = useAgentStore((s) => s.location);
  const devServer = useAgentStore((s) => s.devServer);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [mode, setMode] = useState<EmbedMode>('preview');
  const [edits, dispatchEdit] = useReducer(editReducer, []);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [showEditList, setShowEditList] = useState(false);
  const [annReq, setAnnReq] = useState<AnnotationRequest | null>(null);
  const [annText, setAnnText] = useState('');
  const annInputRef = useRef<HTMLInputElement>(null);
  const prevLocationRef = useRef(location);

  const isActive = !['IDLE'].includes(status);
  const canInject = ['RUNNING', 'PAUSED'].includes(status);
  const isPreview = mode === 'preview';
  const currentUrl = isPreview ? getPreviewUrl(projectId, devServer) : getSimulatorUrl(projectId);

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
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Reset on iframe/mode change
  useEffect(() => {
    setEditorReady(false);
    setSelected(null);
    dispatchEdit({ type: 'CLEAR' });
    setAnnReq(null);
  }, [iframeKey, mode]);

  const postToIframe = useCallback((msg: any) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  }, []);

  const sendColor = useCallback((color: string, target: 'text' | 'bg' | 'border') => {
    postToIframe({ type: 'VOLTRON_SET_COLOR', color, target });
  }, [postToIframe]);

  const sendFontSize = useCallback((size: string) => {
    postToIframe({ type: 'VOLTRON_SET_FONT', size });
  }, [postToIframe]);

  const sendShadow = useCallback((shadow: string) => {
    postToIframe({ type: 'VOLTRON_APPLY_EFFECT', shadow });
  }, [postToIframe]);

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

  // SAVE & SEND
  const handleSaveAndSend = useCallback(() => {
    if (edits.length === 0 || !onInject) return;

    const lines: string[] = [
      '=== GORSEL DUZENLEYICI — ' + edits.length + ' DEGISIKLIK ===',
      '',
    ];

    edits.forEach((edit, i) => {
      lines.push('[' + (i + 1) + '] ' + edit.type.toUpperCase());
      if (edit.selector !== 'viewport') lines.push('    Element: ' + edit.selector);
      lines.push('    Koordinat: (' + edit.coords.x + ', ' + edit.coords.y + ') ' + edit.coords.w + 'x' + edit.coords.h);

      switch (edit.type) {
        case 'move':
          lines.push('    Hareket: deltaX=' + edit.to.deltaX + 'px, deltaY=' + edit.to.deltaY + 'px');
          break;
        case 'resize':
          lines.push('    Boyut: ' + edit.from.width + 'x' + edit.from.height + ' -> ' + edit.to.width + 'x' + edit.to.height);
          break;
        case 'recolor':
          lines.push('    ' + (edit.to.target || 'text') + ': ' + edit.from.value + ' -> ' + edit.to.value);
          break;
        case 'refont':
          if (edit.to.fontSize !== edit.from.fontSize) lines.push('    Font boyut: ' + edit.from.fontSize + ' -> ' + edit.to.fontSize);
          if (edit.to.fontFamily !== edit.from.fontFamily) lines.push('    Font: ' + edit.from.fontFamily + ' -> ' + edit.to.fontFamily);
          break;
        case 'retext':
          lines.push('    Eski: "' + edit.from.text + '"');
          lines.push('    Yeni: "' + edit.to.text + '"');
          break;
        case 'effect':
          Object.keys(edit.to).forEach((k) => lines.push('    ' + k + ': ' + edit.to[k]));
          break;
        case 'mark_error': case 'add_here': case 'annotate':
          lines.push('    Sayfa: (' + edit.to.pageX + ', ' + edit.to.pageY + ')');
          lines.push('    ' + (edit.type === 'mark_error' ? 'Hata' : edit.type === 'add_here' ? 'Eklenecek' : 'Not') + ': ' + edit.to.note);
          break;
      }
      lines.push('');
    });

    lines.push('=== TUM DEGISIKLIKLERI index.html DOSYASINA UYGULA ===');
    lines.push('Selektorler ve koordinatlar kesindir. Birebir uygula.');

    onInject(lines.join('\n'), {
      filePath: 'index.html',
      constraints: edits.map((e, i) => `[${i + 1}] ${e.type}: ${e.selector} @ (${e.coords.x},${e.coords.y})`),
    });
    clearEdits();
  }, [edits, onInject, clearEdits]);

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
      {/* ─── Minimal header ─── */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-800 bg-gray-900/60">
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

      {/* ─── Property panel (appears when element is selected) ─── */}
      {isPreview && selected && (
        <PropertyPanel
          selected={selected}
          onColor={sendColor}
          onFontSize={sendFontSize}
          onShadow={sendShadow}
        />
      )}

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

      {/* ─── Main: iframe + edit list ─── */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0">
          {isActive ? (
            <iframe
              key={`${mode}-${iframeKey}`}
              ref={iframeRef}
              src={currentUrl}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              className="w-full h-full border-0 bg-white"
              title={isPreview ? 'Agent Preview' : 'Simulator Preview'}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Monitor className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-xs text-gray-600">{t('agent.simulatorIdle')}</p>
              </div>
            </div>
          )}
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
      {edits.length > 0 && canInject && onInject && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-orange-800/40 bg-gradient-to-r from-orange-950/40 to-gray-950">
          <span className="text-[10px] text-orange-400 font-medium">
            {edits.length} {t('agent.pendingEdits')}
          </span>
          <div className="flex-1" />
          <button onClick={clearEdits} className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-red-400 bg-gray-800 hover:bg-gray-700 rounded transition-colors">
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PROPERTY PANEL — appears below header when element selected
   Compact: one row of color swatches + font sizes + effects
   ═══════════════════════════════════════════════════════════ */

interface PropertyPanelProps {
  selected: SelectedElement;
  onColor: (color: string, target: 'text' | 'bg' | 'border') => void;
  onFontSize: (size: string) => void;
  onShadow: (shadow: string) => void;
}

function PropertyPanel({ selected, onColor, onFontSize, onShadow }: PropertyPanelProps) {
  const { t } = useTranslation();
  const [colorTarget, setColorTarget] = useState<'text' | 'bg' | 'border'>('bg');
  const [activeSection, setActiveSection] = useState<'color' | 'font' | 'effect' | null>(null);

  return (
    <div className="border-b border-blue-800/30 bg-gray-900/60">
      {/* Element info + quick action buttons */}
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="text-[9px] text-blue-400 font-mono truncate max-w-48">{selected.selector}</span>
        <span className="text-[9px] text-gray-600">{selected.rect.width}x{selected.rect.height}</span>
        <div className="flex-1" />

        {/* Quick action toggles */}
        <button
          onClick={() => setActiveSection(activeSection === 'color' ? null : 'color')}
          className={`p-1 rounded transition-colors ${activeSection === 'color' ? 'bg-pink-600/30 text-pink-400' : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800'}`}
          title={t('agent.toolColor')}
        >
          <Palette className="w-3 h-3" />
        </button>
        <button
          onClick={() => setActiveSection(activeSection === 'font' ? null : 'font')}
          className={`p-1 rounded transition-colors ${activeSection === 'font' ? 'bg-purple-600/30 text-purple-400' : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800'}`}
          title={t('agent.toolFont')}
        >
          <Type className="w-3 h-3" />
        </button>
        <button
          onClick={() => setActiveSection(activeSection === 'effect' ? null : 'effect')}
          className={`p-1 rounded transition-colors ${activeSection === 'effect' ? 'bg-yellow-600/30 text-yellow-400' : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800'}`}
          title={t('agent.toolEffect')}
        >
          <Sparkles className="w-3 h-3" />
        </button>
      </div>

      {/* Expanded section */}
      {activeSection === 'color' && (
        <div className="px-2 pb-1.5 flex items-center gap-1.5 flex-wrap">
          <div className="flex gap-0.5">
            {(['text', 'bg', 'border'] as const).map((tgt) => (
              <button
                key={tgt}
                onClick={() => setColorTarget(tgt)}
                className={`px-1.5 py-0.5 text-[9px] rounded ${colorTarget === tgt ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
              >
                {tgt === 'text' ? t('agent.colorText') : tgt === 'bg' ? t('agent.colorBg') : t('agent.colorBorder')}
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 flex-wrap">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => onColor(c, colorTarget)}
                className="w-4.5 h-4.5 rounded-sm border border-gray-600 hover:scale-125 transition-transform"
                style={{ backgroundColor: c, width: 18, height: 18 }}
              />
            ))}
            <input type="color" onChange={(e) => onColor(e.target.value, colorTarget)} className="w-[18px] h-[18px] rounded-sm border border-gray-600 cursor-pointer bg-transparent" />
          </div>
        </div>
      )}

      {activeSection === 'font' && (
        <div className="px-2 pb-1.5 flex items-center gap-1 flex-wrap">
          <span className="text-[9px] text-gray-500">{t('agent.fontSize')}:</span>
          {FONT_SIZES.map((s) => (
            <button key={s} onClick={() => onFontSize(s)} className="px-1.5 py-0.5 text-[9px] bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
              {parseInt(s)}
            </button>
          ))}
        </div>
      )}

      {activeSection === 'effect' && (
        <div className="px-2 pb-1.5 flex items-center gap-1 flex-wrap">
          <span className="text-[9px] text-gray-500">{t('agent.shadow')}:</span>
          {SHADOW_PRESETS.map((p) => (
            <button key={p.label} onClick={() => onShadow(p.value)} className="px-1.5 py-0.5 text-[9px] bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
              {p.label}
            </button>
          ))}
        </div>
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
    <div className="w-52 shrink-0 border-l border-gray-800 bg-gray-900/80 flex flex-col">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-800">
        <Save className="w-3 h-3 text-orange-400" />
        <span className="text-[10px] text-gray-300 font-medium flex-1">{t('agent.editList')} ({edits.length})</span>
        <button onClick={onClose} className="p-0.5 hover:bg-gray-800 rounded"><X className="w-3 h-3 text-gray-500" /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {edits.map((edit, i) => {
          const Icon = EDIT_ICONS[edit.type] || MessageSquare;
          const color = EDIT_COLORS[edit.type] || 'text-gray-400';
          return (
            <div key={edit.id} className="flex items-start gap-1.5 px-2 py-1.5 border-b border-gray-800/50 hover:bg-gray-800/30 group">
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
      <div className="p-2 border-t border-gray-800 space-y-1.5">
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
