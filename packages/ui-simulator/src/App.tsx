import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Monitor, Undo2, Redo2, MousePointer2, Wifi, WifiOff,
  Paintbrush, Layout, Settings2, Smartphone, Pipette, ImagePlus,
} from 'lucide-react';
import { IframeSandbox } from './sandbox/IframeSandbox';
import { SandboxBridge } from './sandbox/SandboxBridge';
import { CssPanel } from './panels/CssPanel';
import { LayoutPanel } from './panels/LayoutPanel';
import { PropEditor } from './panels/PropEditor';
import { ResponsivePanel } from './panels/ResponsivePanel';
import { ReferenceOverlay } from './panels/ReferenceOverlay';
import { useSimulatorStore, VIEWPORT_PRESETS } from './stores/simulatorStore';
import { useHistoryStore } from './stores/historyStore';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useServerSync } from './hooks/useServerSync';

const PANELS = [
  { id: 'css' as const, label: 'CSS', icon: Paintbrush },
  { id: 'layout' as const, label: 'Layout', icon: Layout },
  { id: 'props' as const, label: 'Props', icon: Settings2 },
  { id: 'responsive' as const, label: 'Viewport', icon: Smartphone },
  { id: 'reference' as const, label: 'Ref', icon: ImagePlus },
];

export function App() {
  const bridgeRef = useRef<SandboxBridge | null>(null);
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const [iframeSrc, setIframeSrc] = useState('');
  const [urlInput, setUrlInput] = useState('http://localhost:6400');

  const selectedElement = useSimulatorStore((s) => s.selectedElement);
  const elementPath = useSimulatorStore((s) => s.elementPath);
  const activePanel = useSimulatorStore((s) => s.activePanel);
  const setActivePanel = useSimulatorStore((s) => s.setActivePanel);
  const viewportSize = useSimulatorStore((s) => s.viewportSize);
  const setViewportSize = useSimulatorStore((s) => s.setViewportSize);
  const isConnected = useSimulatorStore((s) => s.isConnected);
  const agentStatus = useSimulatorStore((s) => s.agentStatus);
  const agentCurrentFile = useSimulatorStore((s) => s.agentCurrentFile);

  // Server sync - extract projectId from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('projectId');
  const { sendConstraint, sendReferenceImage } = useServerSync(projectId);

  const canUndo = useHistoryStore((s) => s.undoStack.length > 0);
  const canRedo = useHistoryStore((s) => s.redoStack.length > 0);
  const { handleUndo: undo, handleRedo: redo } = useUndoRedo(bridgeRef.current);
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [lastPickedColor, setLastPickedColor] = useState<string | null>(null);

  const handleEyedropper = useCallback(() => {
    if (eyedropperActive) return;
    if (!window.EyeDropper) {
      console.warn('[App] EyeDropper API not available');
      return;
    }
    setEyedropperActive(true);
    const dropper = new window.EyeDropper();
    dropper
      .open()
      .then((result: { sRGBHex: string }) => {
        setLastPickedColor(result.sRGBHex);
        navigator.clipboard.writeText(result.sRGBHex).catch(() => {});
        setEyedropperActive(false);
      })
      .catch(() => {
        setEyedropperActive(false);
      });
  }, [eyedropperActive]);

  const handleLoad = useCallback(() => {
    setIframeSrc(urlInput);
  }, [urlInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleLoad();
  }, [handleLoad]);

  useEffect(() => {
    if (!bridgeRef.current) {
      bridgeRef.current = new SandboxBridge([window.location.origin]);
    }
  }, []);

  const bridge = bridgeRef.current;

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Top Toolbar */}
      <header className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800">
        <Monitor className="w-5 h-5 text-purple-400" />
        <span className="font-semibold text-sm">UI Simulator</span>

        <div className="flex-1 flex items-center gap-2 mx-4">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter preview URL..."
            className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleLoad}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded transition-colors"
          >
            Load
          </button>
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30 transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-5 bg-gray-700" />

        {/* Viewport presets */}
        <div className="flex items-center gap-1">
          {VIEWPORT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setViewportSize(preset)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewportSize.label === preset.label
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-700" />

        {/* Eyedropper */}
        <button
          onClick={handleEyedropper}
          disabled={eyedropperActive}
          className={`relative p-1.5 rounded transition-colors ${
            eyedropperActive
              ? 'bg-purple-600 text-white animate-pulse'
              : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
          title={lastPickedColor ? `Pick Color (last: ${lastPickedColor})` : 'Pick Color from Screen'}
        >
          <Pipette className="w-4 h-4" />
          {lastPickedColor && !eyedropperActive && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-gray-900"
              style={{ backgroundColor: lastPickedColor }}
            />
          )}
        </button>

        <div className="w-px h-5 bg-gray-700" />

        {/* Connection status */}
        {isConnected ? (
          <Wifi className="w-4 h-4 text-green-400" />
        ) : (
          <WifiOff className="w-4 h-4 text-gray-600" />
        )}
      </header>

      {/* Agent status banner */}
      {agentStatus === 'RUNNING' && (
        <div className="flex items-center gap-2 px-4 py-1 bg-green-900/20 border-b border-green-800/30 text-xs text-green-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span>Claude is editing{agentCurrentFile ? `: ${agentCurrentFile}` : '...'}</span>
          {sendConstraint && (
            <button
              onClick={() => sendConstraint({ type: 'style_change', description: 'Send current edits as constraints to Claude' })}
              className="ml-auto px-2 py-0.5 bg-green-800/30 hover:bg-green-700/30 rounded text-[10px] transition-colors"
            >
              Send Edits to Claude
            </button>
          )}
        </div>
      )}

      {/* Element breadcrumb */}
      {selectedElement && (
        <div className="flex items-center gap-1 px-4 py-1 bg-gray-900/50 border-b border-gray-800 text-xs">
          <MousePointer2 className="w-3 h-3 text-blue-400 shrink-0" />
          {elementPath.length > 0 ? (
            elementPath.map((segment, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-600">&gt;</span>}
                <span className={i === elementPath.length - 1 ? 'text-blue-400' : 'text-gray-500'}>
                  {segment}
                </span>
              </span>
            ))
          ) : (
            <span className="text-blue-400 font-mono">{selectedElement.selector}</span>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Preview area */}
        <div className="flex-1 flex items-center justify-center bg-gray-950 p-4 overflow-auto">
          {iframeSrc ? (
            <div
              ref={iframeContainerRef}
              style={{
                position: 'relative',
                width: viewportSize.width || '100%',
                height: viewportSize.height || '100%',
                maxWidth: '100%',
                maxHeight: '100%',
              }}
              className="bg-white rounded-lg overflow-hidden shadow-2xl shadow-black/50"
            >
              <IframeSandbox
                src={iframeSrc}
                bridge={bridge!}
                onElementSelected={(payload) => {
                  useSimulatorStore.getState().setSelectedElement(payload);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-gray-500">
              <Monitor className="w-16 h-16 text-gray-700" />
              <p className="text-sm">Enter a URL above to start previewing</p>
              <p className="text-xs text-gray-600">Supports any local dev server (React, Vue, etc.)</p>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="w-80 flex flex-col border-l border-gray-800 bg-gray-900">
          {/* Panel tabs */}
          <div className="flex border-b border-gray-800">
            {PANELS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActivePanel(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs transition-colors ${
                  activePanel === id
                    ? 'text-purple-400 border-b-2 border-purple-400 bg-gray-800/30'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {activePanel === 'css' && bridge && <CssPanel bridge={bridge} />}
            {activePanel === 'layout' && bridge && <LayoutPanel bridge={bridge} />}
            {activePanel === 'props' && bridge && <PropEditor bridge={bridge} />}
            {activePanel === 'responsive' && <ResponsivePanel />}
            {activePanel === 'reference' && (
              <ReferenceOverlay
                containerRef={iframeContainerRef}
                onImageUpload={(dataUrl) => sendReferenceImage?.(dataUrl, 'Reference design image uploaded by operator')}
              />
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <footer className="flex items-center gap-4 px-4 py-1 bg-gray-900 border-t border-gray-800 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-600'}`} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        {selectedElement && (
          <>
            <span className="text-gray-700">|</span>
            <span className="font-mono">{selectedElement.tagName.toLowerCase()}</span>
            <span className="text-gray-700">|</span>
            <span>{selectedElement.bounds.width.toFixed(0)} x {selectedElement.bounds.height.toFixed(0)}</span>
          </>
        )}
        <span className="flex-1" />
        <span>Ctrl+Z Undo | Ctrl+Shift+Z Redo</span>
      </footer>
    </div>
  );
}
