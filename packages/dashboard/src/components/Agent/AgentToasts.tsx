import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Zap, MapPin, Target,
  X,
} from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { useTranslation } from '../../i18n';

/* ─── Toast Types ─── */

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  createdAt: number;
}

const AUTO_DISMISS_MS = 5000;
const MAX_TOASTS = 5;

let toastCounter = 0;

/* ─── Agent Toasts ─── */

export function AgentToasts() {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prevStatusRef = useRef<string>('IDLE');
  const status = useAgentStore((s) => s.status);
  const lastError = useAgentStore((s) => s.lastError);
  const output = useAgentStore((s) => s.output);

  const addToast = useCallback((type: Toast['type'], title: string, message?: string) => {
    const id = `toast_${++toastCounter}_${Date.now()}`;
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, type, title, message, createdAt: Date.now() }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.createdAt < AUTO_DISMISS_MS));
    }, 1000);
    return () => clearInterval(timer);
  }, [toasts.length]);

  // Status change toasts
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (prev === status) return;

    if (status === 'RUNNING' && (prev === 'SPAWNING' || prev === 'IDLE')) {
      addToast('success', t('agent.toast.agentStarted'));
    } else if (status === 'COMPLETED') {
      addToast('success', t('agent.toast.agentCompleted'));
    } else if (status === 'CRASHED') {
      addToast('error', t('agent.toast.agentCrashed'), lastError ?? undefined);
    } else if (status === 'PAUSED' && prev === 'RUNNING') {
      addToast('info', t('agent.toast.agentPaused'));
    } else if (status === 'RUNNING' && prev === 'PAUSED') {
      addToast('info', t('agent.toast.agentResumed'));
    }
  }, [status, lastError, addToast, t]);

  // Watch output for breakpoint/injection/conflict events
  useEffect(() => {
    if (output.length === 0) return;
    const latest = output[output.length - 1];
    if (!latest || latest.type !== 'error') return;

    if (latest.text.startsWith('Breakpoint hit:')) {
      addToast('warning', t('agent.gps.breakpointHit'), latest.text);
    } else if (latest.text.includes('visual edits pending')) {
      addToast('warning', t('agent.gps.conflictWarning'), latest.text);
    }
  }, [output, addToast, t]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
}

/* ─── Toast Item ─── */

const BORDER_COLORS: Record<Toast['type'], string> = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  warning: 'border-l-yellow-500',
  info: 'border-l-blue-500',
};

const ICONS: Record<Toast['type'], typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Zap,
};

const ICON_COLORS: Record<Toast['type'], string> = {
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400',
  info: 'text-blue-400',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = ICONS[toast.type];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-2 px-3 py-2 bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 border-l-2 ${BORDER_COLORS[toast.type]} rounded-lg shadow-xl shadow-black/30 max-w-xs animate-slide-in-right`}
    >
      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${ICON_COLORS[toast.type]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-gray-200">{toast.title}</div>
        {toast.message && (
          <div className="text-[10px] text-gray-400 mt-0.5 truncate">{toast.message}</div>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// We use unused imports to suppress lint — they're available for future extension
void MapPin;
void Target;
