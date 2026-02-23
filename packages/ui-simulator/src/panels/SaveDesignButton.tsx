import { useState, useCallback } from 'react';
import { Save, Check, Loader2, X } from 'lucide-react';
import { useDesignSnapshotStore } from '../stores/designSnapshotStore';
import type { SandboxBridge, DesignSnapshotPayload } from '../sandbox/SandboxBridge';

interface SaveDesignButtonProps {
  bridge: SandboxBridge;
  onSendSnapshot: (snapshot: DesignSnapshotPayload) => void;
}

export function SaveDesignButton({ bridge, onSendSnapshot }: SaveDesignButtonProps) {
  const changes = useDesignSnapshotStore((s) => s.changes);
  const clearChanges = useDesignSnapshotStore((s) => s.clearChanges);
  const [showDialog, setShowDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [snapshot, setSnapshot] = useState<DesignSnapshotPayload | null>(null);

  const handleClick = useCallback(() => {
    // Request snapshot from iframe
    const handler = bridge.onMessage('DESIGN_SNAPSHOT', (msg) => {
      setSnapshot(msg.payload as DesignSnapshotPayload);
      setShowDialog(true);
      handler(); // unsubscribe
    });
    bridge.requestDesignSnapshot();
  }, [bridge]);

  const handleSend = useCallback(() => {
    if (!snapshot) return;
    setSending(true);
    onSendSnapshot(snapshot);
    clearChanges();
    setTimeout(() => {
      setSending(false);
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setShowDialog(false);
        setSnapshot(null);
      }, 1500);
    }, 500);
  }, [snapshot, onSendSnapshot, clearChanges]);

  const hasAnyChanges = changes.length > 0 || (snapshot && (
    snapshot.addedElements.length > 0 ||
    snapshot.deletedElements.length > 0 ||
    snapshot.movedElements.length > 0 ||
    snapshot.styleChanges.length > 0
  ));

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
          hasAnyChanges
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
            : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-400'
        }`}
        title="Save design changes and send to Claude"
      >
        <Save className="w-3.5 h-3.5" />
        <span className="text-xs">Save Design</span>
        {changes.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-[10px]">
            {changes.length}
          </span>
        )}
      </button>

      {/* Dialog */}
      {showDialog && snapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-[420px] max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-gray-200">Design Changes Summary</h3>
              <button
                onClick={() => { setShowDialog(false); setSnapshot(null); }}
                className="p-1 rounded hover:bg-gray-800 text-gray-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[50vh] text-xs space-y-3">
              {snapshot.addedElements.length > 0 && (
                <div>
                  <h4 className="text-green-400 font-medium mb-1">+ Added ({snapshot.addedElements.length})</h4>
                  {snapshot.addedElements.map((el, i) => (
                    <div key={i} className="text-gray-400 pl-2 font-mono truncate">{el.selector}</div>
                  ))}
                </div>
              )}

              {snapshot.deletedElements.length > 0 && (
                <div>
                  <h4 className="text-red-400 font-medium mb-1">- Deleted ({snapshot.deletedElements.length})</h4>
                  {snapshot.deletedElements.map((el, i) => (
                    <div key={i} className="text-gray-400 pl-2 font-mono truncate">{el.selector}</div>
                  ))}
                </div>
              )}

              {snapshot.movedElements.length > 0 && (
                <div>
                  <h4 className="text-blue-400 font-medium mb-1">~ Moved ({snapshot.movedElements.length})</h4>
                  {snapshot.movedElements.map((el, i) => (
                    <div key={i} className="text-gray-400 pl-2 font-mono truncate">
                      {el.selector} ({el.deltaX > 0 ? '+' : ''}{el.deltaX}px, {el.deltaY > 0 ? '+' : ''}{el.deltaY}px)
                    </div>
                  ))}
                </div>
              )}

              {snapshot.styleChanges.length > 0 && (
                <div>
                  <h4 className="text-yellow-400 font-medium mb-1">* Styled ({snapshot.styleChanges.length})</h4>
                  {snapshot.styleChanges.slice(0, 10).map((sc, i) => (
                    <div key={i} className="text-gray-400 pl-2 font-mono truncate">
                      {sc.selector}: {sc.property}: {sc.newValue}
                    </div>
                  ))}
                  {snapshot.styleChanges.length > 10 && (
                    <div className="text-gray-500 pl-2">...and {snapshot.styleChanges.length - 10} more</div>
                  )}
                </div>
              )}

              {!hasAnyChanges && (
                <div className="text-gray-500 text-center py-4">No changes detected</div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-800">
              <button
                onClick={() => { setShowDialog(false); setSnapshot(null); }}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || sent || !hasAnyChanges}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-colors ${
                  sent
                    ? 'bg-green-600 text-white'
                    : 'bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50'
                }`}
              >
                {sending ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Sending...</>
                ) : sent ? (
                  <><Check className="w-3 h-3" /> Sent!</>
                ) : (
                  <><Save className="w-3 h-3" /> Send to Claude</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
