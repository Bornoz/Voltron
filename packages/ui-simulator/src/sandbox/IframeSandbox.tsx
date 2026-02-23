import { useRef, useEffect, useCallback, useState } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { SandboxBridge } from './SandboxBridge';
import type { ElementSelectedPayload } from './SandboxBridge';
import { INJECTED_SCRIPT } from './InjectedScript';
import { useSimulatorStore, type ViewportSize } from '../stores/simulatorStore';

interface IframeSandboxProps {
  src: string;
  onElementSelected?: (payload: ElementSelectedPayload) => void;
  bridge: SandboxBridge;
  viewportSize?: ViewportSize;
}

export function IframeSandbox({ src, onElementSelected, bridge, viewportSize: viewportSizeProp }: IframeSandboxProps) {
  const storeViewport = useSimulatorStore((s) => s.viewportSize);
  const viewportSize = viewportSizeProp ?? storeViewport;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const setConnected = useSimulatorStore((s) => s.setConnected);

  // Attach bridge to iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    bridge.attach(iframe);

    const unsubReady = bridge.onMessage('BRIDGE_READY', () => {
      setConnected(true);
      setIsLoading(false);
    });

    const unsubElement = bridge.onMessage('ELEMENT_SELECTED', (msg) => {
      onElementSelected?.(msg.payload as ElementSelectedPayload);
    });

    const unsubError = bridge.onMessage('ERROR', (msg) => {
      console.error('[IframeSandbox] Error from iframe:', msg.payload);
    });

    return () => {
      unsubReady();
      unsubElement();
      unsubError();
      bridge.detach();
      setConnected(false);
    };
  }, [bridge, onElementSelected, setConnected]);

  // Handle iframe load - inject the bridge script
  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      // For same-origin iframes, inject directly
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        const script = iframeDoc.createElement('script');
        script.textContent = INJECTED_SCRIPT;
        iframeDoc.body.appendChild(script);
      }
    } catch {
      // Cross-origin: rely on postMessage only
      // The iframe content must include the injected script itself
      console.info('[IframeSandbox] Cross-origin iframe, relying on postMessage protocol');
    }

    setError(null);
  }, []);

  const handleError = useCallback(() => {
    setError('Failed to load iframe content');
    setIsLoading(false);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setRetryCount((c) => c + 1);
  }, []);

  // Compute iframe dimensions
  const isFull = viewportSize.label === 'full' || (viewportSize.width === 0 && viewportSize.height === 0);
  const iframeStyle: React.CSSProperties = isFull
    ? { width: '100%', height: '100%' }
    : {
        width: `${viewportSize.width}px`,
        height: `${viewportSize.height}px`,
        maxWidth: '100%',
        maxHeight: '100%',
      };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-950 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center h-full bg-gray-900 overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 z-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-gray-400 text-sm">Loading preview...</p>
          </div>
        </div>
      )}

      {src ? (
        <iframe
          ref={iframeRef}
          key={`iframe-${retryCount}`}
          src={src}
          sandbox="allow-scripts allow-same-origin"
          onLoad={handleLoad}
          onError={handleError}
          style={iframeStyle}
          className="bg-white border border-gray-700 rounded"
          title="UI Preview"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 text-gray-500">
          <div className="w-16 h-16 border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center">
            <span className="text-2xl">?</span>
          </div>
          <p className="text-sm">No preview URL set. Enter a URL in the toolbar to start.</p>
        </div>
      )}
    </div>
  );
}
