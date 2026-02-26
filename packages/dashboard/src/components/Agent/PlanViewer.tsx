import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Circle, Loader2, SkipForward, ChevronRight, AlertTriangle, FileText } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import type { AgentPlanStepStatus } from '@voltron/shared';
import { useTranslation } from '../../i18n';

const PLAN_TIMEOUT_MS = 8_000;

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

/** Build a minimal "file list" plan from breadcrumbs when thinking-based plan extraction fails */
function buildBreadcrumbPlan(breadcrumbs: { filePath: string; activity: string }[]) {
  const fileSet = new Map<string, string>();
  for (const bc of breadcrumbs) {
    if (bc.filePath && !fileSet.has(bc.filePath)) {
      fileSet.set(bc.filePath, bc.activity);
    }
  }
  if (fileSet.size === 0) return null;

  const steps = Array.from(fileSet.entries()).map(([filePath, activity], i) => ({
    index: i,
    description: `${activity}: ${filePath.split('/').pop()}`,
    status: 'completed' as AgentPlanStepStatus,
    filePath,
  }));

  return {
    summary: `${fileSet.size} dosya islendi`,
    confidence: 0.3,
    totalSteps: steps.length,
    currentStepIndex: steps.length - 1,
    steps,
  };
}

export function PlanViewer() {
  const { t } = useTranslation();
  const plan = useAgentStore((s) => s.plan);
  const status = useAgentStore((s) => s.status);
  const breadcrumbs = useAgentStore((s) => s.breadcrumbs);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timeout: if plan doesn't arrive within PLAN_TIMEOUT_MS while running, show fallback
  useEffect(() => {
    if (plan) {
      // Plan arrived — clear timeout
      setTimedOut(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (['RUNNING', 'SPAWNING'].includes(status)) {
      setTimedOut(false);
      timerRef.current = setTimeout(() => setTimedOut(true), PLAN_TIMEOUT_MS);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    // Not running — clear timer
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [plan, status]);

  // Reset timeout state when status goes to IDLE
  useEffect(() => {
    if (status === 'IDLE') setTimedOut(false);
  }, [status]);

  // Case 1: Plan exists — show normally
  if (plan) {
    return <PlanDisplay plan={plan} />;
  }

  // Case 2: Agent completed/crashed without a plan — show breadcrumb fallback or "no plan" message
  if (['COMPLETED', 'CRASHED'].includes(status)) {
    const fallback = buildBreadcrumbPlan(breadcrumbs);
    if (fallback) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] text-yellow-500/80">
            <FileText className="w-3 h-3" />
            <span>{t('agent.planFromBreadcrumbs')}</span>
          </div>
          <PlanDisplay plan={fallback} />
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
        <AlertTriangle className="w-3 h-3 text-yellow-600" />
        <span>{t('agent.noPlanDetected')}</span>
      </div>
    );
  }

  // Case 3: Running but timed out — show timeout message
  if (['RUNNING', 'SPAWNING'].includes(status) && timedOut) {
    const fallback = buildBreadcrumbPlan(breadcrumbs);
    if (fallback) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] text-yellow-500/80">
            <FileText className="w-3 h-3" />
            <span>{t('agent.planFromBreadcrumbs')}</span>
          </div>
          <PlanDisplay plan={fallback} />
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
        <AlertTriangle className="w-3 h-3 text-yellow-600" />
        <span>{t('agent.planExtractionFailed')}</span>
      </div>
    );
  }

  // Case 4: Running, still waiting for plan
  if (['RUNNING', 'SPAWNING'].includes(status)) {
    return (
      <div className="space-y-2 px-1">
        {/* Animated extraction indicator */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <div className="absolute inset-0 w-4 h-4 rounded-full bg-blue-400/20 animate-ping" style={{ animationDuration: '2s' }} />
          </div>
          <div className="flex-1">
            <span className="text-xs text-blue-300 font-medium">{t('agent.extractingPlan')}</span>
            <div className="mt-1 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 rounded-full"
                style={{
                  width: '60%',
                  animation: 'planShimmer 2s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        </div>
        {/* Skeleton plan steps */}
        <div className="space-y-1.5 opacity-40">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1">
              <div className="w-3.5 h-3.5 rounded-full bg-gray-700 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
              <div className="flex-1 h-2.5 bg-gray-800 rounded animate-pulse" style={{ animationDelay: `${i * 200}ms`, width: `${85 - i * 15}%` }} />
            </div>
          ))}
        </div>
        <style>{`@keyframes planShimmer { 0%,100% { width:30%; margin-left:0 } 50% { width:70%; margin-left:15% } }`}</style>
      </div>
    );
  }

  // Case 5: IDLE — show nothing
  return null;
}

interface PlanDisplayProps {
  plan: {
    summary: string;
    confidence: number;
    totalSteps: number;
    currentStepIndex: number;
    steps: Array<{
      index: number;
      description: string;
      status: AgentPlanStepStatus;
      filePath?: string;
    }>;
  };
}

function PlanDisplay({ plan }: PlanDisplayProps) {
  const { t } = useTranslation();
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
