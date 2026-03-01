import { CheckCircle2, XCircle, Clock, Play, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import type { Phase } from '../../stores/agentStore';
import { useTranslation } from '../../i18n';
import * as api from '../../lib/api';

const PHASE_STATUS_ICON: Record<Phase['status'], typeof Clock> = {
  pending: Clock,
  running: Loader2,
  awaiting_approval: AlertTriangle,
  approved: CheckCircle2,
  rejected: XCircle,
  completed: CheckCircle2,
};

const PHASE_STATUS_COLOR: Record<Phase['status'], string> = {
  pending: 'text-gray-500',
  running: 'text-blue-400',
  awaiting_approval: 'text-yellow-400',
  approved: 'text-green-400',
  rejected: 'text-red-400',
  completed: 'text-green-400',
};

const PHASE_STATUS_BG: Record<Phase['status'], string> = {
  pending: 'bg-gray-800/30',
  running: 'bg-blue-950/30 border-blue-800/40',
  awaiting_approval: 'bg-yellow-950/30 border-yellow-800/40',
  approved: 'bg-green-950/20 border-green-800/30',
  rejected: 'bg-red-950/20 border-red-800/30',
  completed: 'bg-green-950/20 border-green-800/30',
};

export function PhaseTracker({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const phaseExecution = useAgentStore((s) => s.phaseExecution);
  const approvePhase = useAgentStore((s) => s.approvePhase);
  const rejectPhase = useAgentStore((s) => s.rejectPhase);

  const handleApprove = (phaseId: string) => {
    approvePhase(phaseId);
    api.agentPhaseDecision(projectId, phaseId, 'approve').catch(() => {});
  };

  const handleReject = (phaseId: string) => {
    rejectPhase(phaseId);
    api.agentPhaseDecision(projectId, phaseId, 'reject').catch(() => {});
  };

  if (phaseExecution.status === 'idle' || phaseExecution.phases.length === 0) {
    return null;
  }

  const completedCount = phaseExecution.phases.filter(
    (p) => p.status === 'completed' || p.status === 'approved',
  ).length;
  const totalCount = phaseExecution.phases.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="bg-gray-950/80 backdrop-blur-sm rounded-lg border border-gray-800/50 shadow-lg shadow-blue-500/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/50">
        <Play className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
          {t('agent.phase.title')}
        </span>
        <div className="flex-1" />
        <span className="text-[9px] text-gray-500 font-mono">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800/50">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Phases */}
      <div className="divide-y divide-gray-800/30">
        {phaseExecution.phases.map((phase, idx) => {
          const StatusIcon = PHASE_STATUS_ICON[phase.status];
          const statusColor = PHASE_STATUS_COLOR[phase.status];
          const statusBg = PHASE_STATUS_BG[phase.status];
          const isCurrent = idx === phaseExecution.currentPhaseIndex;
          const isAwaiting = phase.status === 'awaiting_approval';

          return (
            <div
              key={phase.id}
              className={`px-3 py-2 transition-all duration-200 border-l-2 ${
                isCurrent ? 'border-l-blue-500 ' + statusBg : 'border-l-transparent'
              }`}
            >
              {/* Phase header */}
              <div className="flex items-center gap-2">
                <StatusIcon
                  className={`w-3.5 h-3.5 shrink-0 ${statusColor} ${
                    phase.status === 'running' ? 'animate-spin' : ''
                  }`}
                />
                <span className="text-[10px] text-gray-400 font-medium shrink-0">
                  {t('agent.phase.phase')} {idx + 1}
                </span>
                <ChevronRight className="w-2.5 h-2.5 text-gray-600 shrink-0" />
                <span className="text-[10px] text-gray-300 truncate flex-1">
                  {phase.title}
                </span>
                <span className={`text-[9px] font-medium ${statusColor}`}>
                  {t(`agent.phase.${phase.status === 'awaiting_approval' ? 'awaitingApproval' : phase.status}`)}
                </span>
              </div>

              {/* Edit count */}
              {phase.edits.length > 0 && (
                <div className="mt-1 ml-5.5 flex flex-wrap gap-1">
                  {phase.edits.map((edit) => (
                    <span
                      key={edit.index}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800/50 text-gray-500 font-mono"
                    >
                      [{edit.index}] {edit.type}
                    </span>
                  ))}
                </div>
              )}

              {/* Result */}
              {phase.result && (
                <div className="mt-1 ml-5.5 text-[9px] text-gray-500 italic">
                  {phase.result}
                </div>
              )}

              {/* Approve/Reject buttons */}
              {isAwaiting && (
                <div className="flex items-center gap-2 mt-2 ml-5.5">
                  <button
                    onClick={() => handleApprove(phase.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-green-400 bg-green-950/40 hover:bg-green-900/50 border border-green-800/40 rounded-md transition-all hover:scale-105"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {t('agent.phase.approve')}
                  </button>
                  <button
                    onClick={() => handleReject(phase.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-red-400 bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 rounded-md transition-all hover:scale-105"
                  >
                    <XCircle className="w-3 h-3" />
                    {t('agent.phase.reject')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall status */}
      {(phaseExecution.status === 'completed' || phaseExecution.status === 'failed') && (
        <div className={`px-3 py-2 border-t ${
          phaseExecution.status === 'completed'
            ? 'border-green-800/30 bg-green-950/20'
            : 'border-red-800/30 bg-red-950/20'
        }`}>
          <span className={`text-[10px] font-medium ${
            phaseExecution.status === 'completed' ? 'text-green-400' : 'text-red-400'
          }`}>
            {phaseExecution.status === 'completed'
              ? t('agent.phase.completed')
              : t('agent.phase.failed')}
          </span>
        </div>
      )}
    </div>
  );
}
