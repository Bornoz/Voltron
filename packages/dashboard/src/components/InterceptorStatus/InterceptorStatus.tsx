import { useState, useEffect, useCallback } from 'react';
import { Radio, Cpu, Monitor, Eye, Activity, Loader2 } from 'lucide-react';
import * as api from '../../lib/api';
import { useTranslation } from '../../i18n';

interface InterceptorStatusProps {
  projectId: string;
}

export function InterceptorStatus({ projectId }: InterceptorStatusProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<api.InterceptorStatus | null>(null);

  const poll = useCallback(async () => {
    try {
      const data = await api.getInterceptorStatus(projectId);
      setStatus(data);
    } catch {
      // silent
    }
  }, [projectId]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [poll]);

  if (!status) return null;

  const stateColors: Record<string, string> = {
    IDLE: 'text-gray-400',
    RUNNING: 'text-green-400',
    STOPPED: 'text-red-400',
    RESUMING: 'text-yellow-400',
    ERROR: 'text-red-500',
  };

  return (
    <div className="px-3 py-2 border-b border-gray-800">
      <div className="flex items-center gap-2 mb-1.5">
        <Radio className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          {t('interceptor.title')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {/* Interceptor connection */}
        <div className="flex items-center gap-1.5">
          <Cpu className={`w-3 h-3 ${status.interceptorConnected ? 'text-green-400' : 'text-red-400'}`} />
          <span className="text-[10px] text-gray-500">Agent</span>
          <span className={`w-1.5 h-1.5 rounded-full ${status.interceptorConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        </div>

        {/* Dashboard connection */}
        <div className="flex items-center gap-1.5">
          <Monitor className={`w-3 h-3 ${status.dashboardConnected ? 'text-green-400' : 'text-gray-600'}`} />
          <span className="text-[10px] text-gray-500">Dashboard</span>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dashboardConnected ? 'bg-green-400' : 'bg-gray-600'}`} />
        </div>

        {/* Simulator connection */}
        <div className="flex items-center gap-1.5">
          <Eye className={`w-3 h-3 ${status.simulatorConnected ? 'text-green-400' : 'text-gray-600'}`} />
          <span className="text-[10px] text-gray-500">Simulator</span>
          <span className={`w-1.5 h-1.5 rounded-full ${status.simulatorConnected ? 'bg-green-400' : 'bg-gray-600'}`} />
        </div>

        {/* Current event rate */}
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-blue-400" />
          <span className="text-[10px] text-gray-500">{t('interceptor.rate')}</span>
          <span className="text-[10px] font-mono text-blue-400">{status.currentRate.toFixed(1)}/s</span>
        </div>
      </div>

      {/* Execution state */}
      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-800/50">
        <span className="text-[10px] text-gray-500">{t('interceptor.state')}</span>
        <span className={`text-[10px] font-bold uppercase ${stateColors[status.executionState] ?? 'text-gray-400'}`}>
          {status.executionState}
        </span>
      </div>
    </div>
  );
}
