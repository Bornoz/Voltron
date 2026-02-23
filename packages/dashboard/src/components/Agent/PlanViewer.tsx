import { CheckCircle2, Circle, Loader2, SkipForward, ChevronRight } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import type { AgentPlanStepStatus } from '@voltron/shared';
import { useTranslation } from '../../i18n';

const STEP_ICONS: Record<AgentPlanStepStatus, typeof Circle> = {
  pending: Circle,
  active: Loader2,
  completed: CheckCircle2,
  skipped: SkipForward,
};

const STEP_COLORS: Record<AgentPlanStepStatus, string> = {
  pending: 'text-gray-600',
  active: 'text-blue-400',
  completed: 'text-green-400',
  skipped: 'text-gray-500',
};

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'bg-green-500/20 text-green-400 border-green-600/30';
  if (confidence >= 0.4) return 'bg-yellow-500/20 text-yellow-400 border-yellow-600/30';
  return 'bg-red-500/20 text-red-400 border-red-600/30';
}

export function PlanViewer() {
  const { t } = useTranslation();
  const plan = useAgentStore((s) => s.plan);
  const status = useAgentStore((s) => s.status);

  if (!plan) {
    if (['RUNNING', 'SPAWNING'].includes(status)) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{t('agent.extractingPlan')}</span>
        </div>
      );
    }
    return null;
  }

  const completedCount = plan.steps.filter((s) => s.status === 'completed').length;
  const progress = plan.totalSteps > 0 ? Math.round((completedCount / plan.totalSteps) * 100) : 0;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-300 font-medium truncate flex-1">{plan.summary}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${getConfidenceColor(plan.confidence)}`}>
          {Math.round(plan.confidence * 100)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">
            {t('agent.step')} {plan.currentStepIndex + 1} / {plan.totalSteps} ({progress}%)
          </span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-0.5 max-h-48 overflow-y-auto">
        {plan.steps.map((step) => {
          const Icon = STEP_ICONS[step.status];
          const isActive = step.status === 'active';
          return (
            <div
              key={step.index}
              className={`flex items-start gap-2 px-2 py-1 rounded text-xs ${
                isActive ? 'bg-blue-900/20 border border-blue-800/30' : ''
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${STEP_COLORS[step.status]} ${
                  isActive ? 'animate-spin' : ''
                }`}
              />
              <div className="flex-1 min-w-0">
                <span className={`${step.status === 'completed' ? 'text-gray-500 line-through' : step.status === 'active' ? 'text-blue-300' : 'text-gray-400'}`}>
                  {step.description}
                </span>
                {step.filePath && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <ChevronRight className="w-2.5 h-2.5 text-gray-600" />
                    <span className="text-[10px] text-gray-600 font-mono truncate">{step.filePath}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
