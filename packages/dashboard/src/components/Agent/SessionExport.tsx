import { useState, useCallback } from 'react';
import { Download, Copy, Check, FileJson } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { useTranslation } from '../../i18n';

/* ─── Session Export ─── */

interface SessionExportProps {
  projectId: string;
}

export function SessionExport({ projectId }: SessionExportProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const sessionId = useAgentStore((s) => s.sessionId);
  const status = useAgentStore((s) => s.status);
  const model = useAgentStore((s) => s.model);
  const startedAt = useAgentStore((s) => s.startedAt);
  const breadcrumbs = useAgentStore((s) => s.breadcrumbs);
  const plan = useAgentStore((s) => s.plan);
  const tokenUsage = useAgentStore((s) => s.tokenUsage);
  const phaseExecution = useAgentStore((s) => s.phaseExecution);
  const injectionQueue = useAgentStore((s) => s.injectionQueue);
  const output = useAgentStore((s) => s.output);

  const buildReport = useCallback(() => {
    // Derive file stats
    const filesWritten = new Set<string>();
    const filesRead = new Set<string>();
    for (const bc of breadcrumbs) {
      if (!bc.filePath) continue;
      if (bc.activity === 'WRITING') filesWritten.add(bc.filePath);
      else if (bc.activity === 'READING') filesRead.add(bc.filePath);
    }

    return {
      meta: {
        projectId,
        sessionId,
        model,
        status,
        startedAt,
        exportedAt: Date.now(),
        duration: startedAt ? Date.now() - startedAt : null,
      },
      tokenUsage,
      files: {
        written: Array.from(filesWritten),
        read: Array.from(filesRead),
        totalWritten: filesWritten.size,
        totalRead: filesRead.size,
      },
      plan: plan ? {
        summary: plan.summary,
        steps: plan.steps,
      } : null,
      phases: phaseExecution.phases.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
      })),
      breadcrumbs: breadcrumbs.map((bc) => ({
        filePath: bc.filePath,
        activity: bc.activity,
        timestamp: bc.timestamp,
        toolName: bc.toolName,
      })),
      injections: injectionQueue.map((inj) => ({
        id: inj.id,
        prompt: inj.prompt,
        status: inj.status,
        queuedAt: inj.queuedAt,
      })),
      outputSummary: {
        total: output.length,
        errors: output.filter((o) => o.type === 'error').length,
        tools: output.filter((o) => o.type === 'tool').length,
      },
    };
  }, [projectId, sessionId, model, status, startedAt, breadcrumbs, plan, tokenUsage, phaseExecution, injectionQueue, output]);

  const handleDownload = useCallback(() => {
    const report = buildReport();
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voltron-session-${sessionId ?? 'unknown'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildReport, sessionId]);

  const handleCopy = useCallback(async () => {
    const report = buildReport();
    // Generate compact summary text
    const summary = [
      `Voltron Session Report`,
      `Session: ${report.meta.sessionId ?? 'N/A'}`,
      `Model: ${report.meta.model ?? 'N/A'}`,
      `Status: ${report.meta.status}`,
      `Duration: ${report.meta.duration ? Math.round(report.meta.duration / 1000) + 's' : 'N/A'}`,
      `Tokens: ${report.tokenUsage.inputTokens + report.tokenUsage.outputTokens}`,
      `Files Written: ${report.files.totalWritten}`,
      `Files Read: ${report.files.totalRead}`,
      `Breadcrumbs: ${report.breadcrumbs.length}`,
      `Injections: ${report.injections.length}`,
      `Output: ${report.outputSummary.total} (${report.outputSummary.errors} errors)`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, [buildReport]);

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center py-3 text-[10px] text-gray-500">
        {t('agent.sessionExport.noSession')}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleDownload}
        className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-700 border border-gray-700/50 rounded-lg transition-all"
        title={t('agent.sessionExport.downloadJson')}
      >
        <Download className="w-3 h-3" />
        <FileJson className="w-3 h-3" />
        <span>JSON</span>
      </button>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-700 border border-gray-700/50 rounded-lg transition-all"
        title={t('agent.sessionExport.copySummary')}
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-400" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
        <span>{copied ? t('agent.sessionExport.copied') : t('agent.sessionExport.copy')}</span>
      </button>
    </div>
  );
}
