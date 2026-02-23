import type { AgentPlan, AgentPlanStep, AgentPlanStepStatus } from '@voltron/shared';

/**
 * Extracts structured AgentPlan from Claude's thinking text.
 * Recognizes numbered lists, step markers, and progress indicators.
 */

interface ExtractedPlan {
  plan: AgentPlan;
  confidence: number;
}

// Pattern matchers for plan detection
const NUMBERED_LIST = /^\s*(\d+)[.)]\s+(.+)/gm;
const STEP_MARKER = /^\s*(?:step|adim|fase)\s+(\d+)[.:]\s*(.+)/gim;
const ORDERED_MARKER = /^\s*(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|ilk|ikinci|ucuncu|sonra|ardindan|son olarak)[,:]?\s*(.+)/gim;
const PLAN_HEADER = /(?:plan|strateji|yaklasim|adimlar|steps)[:\s]/i;
const PROGRESS_MARKER = /(?:step|adim)\s+(\d+)\s*(?:of|\/|uzerinden)\s*(\d+)/i;

export function extractPlan(thinkingText: string): ExtractedPlan | null {
  if (!thinkingText || thinkingText.length < 20) return null;

  const steps: AgentPlanStep[] = [];
  let summary = '';
  let confidence = 0;

  // Try numbered list first (highest confidence)
  const numberedSteps = extractNumberedSteps(thinkingText);
  if (numberedSteps.length >= 2) {
    steps.push(...numberedSteps);
    confidence = 0.8;
  }

  // Try step markers
  if (steps.length === 0) {
    const markerSteps = extractStepMarkers(thinkingText);
    if (markerSteps.length >= 2) {
      steps.push(...markerSteps);
      confidence = 0.7;
    }
  }

  // Try ordered markers (First/Then/Finally)
  if (steps.length === 0) {
    const orderedSteps = extractOrderedMarkers(thinkingText);
    if (orderedSteps.length >= 2) {
      steps.push(...orderedSteps);
      confidence = 0.5;
    }
  }

  if (steps.length === 0) return null;

  // Extract summary from plan header or first line
  summary = extractSummary(thinkingText);

  // Check for plan header to boost confidence
  if (PLAN_HEADER.test(thinkingText)) {
    confidence = Math.min(1, confidence + 0.15);
  }

  // Check for progress markers
  const progressMatch = thinkingText.match(PROGRESS_MARKER);
  let currentStepIndex = 0;
  if (progressMatch) {
    currentStepIndex = Math.max(0, parseInt(progressMatch[1], 10) - 1);
  }

  // Mark steps based on currentStepIndex
  for (let i = 0; i < steps.length; i++) {
    if (i < currentStepIndex) {
      steps[i].status = 'completed';
    } else if (i === currentStepIndex) {
      steps[i].status = 'active';
    } else {
      steps[i].status = 'pending';
    }
  }

  return {
    plan: {
      summary: summary || steps[0].description,
      steps,
      currentStepIndex,
      totalSteps: steps.length,
      confidence,
    },
    confidence,
  };
}

function extractNumberedSteps(text: string): AgentPlanStep[] {
  const steps: AgentPlanStep[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(NUMBERED_LIST.source, NUMBERED_LIST.flags);

  while ((match = regex.exec(text)) !== null) {
    const description = match[2].trim();
    if (description.length < 3) continue;

    steps.push({
      index: steps.length,
      description: truncateStep(description),
      status: 'pending' as AgentPlanStepStatus,
      filePath: extractFilePath(description),
    });
  }

  return steps;
}

function extractStepMarkers(text: string): AgentPlanStep[] {
  const steps: AgentPlanStep[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(STEP_MARKER.source, STEP_MARKER.flags);

  while ((match = regex.exec(text)) !== null) {
    const description = match[2].trim();
    if (description.length < 3) continue;

    steps.push({
      index: steps.length,
      description: truncateStep(description),
      status: 'pending' as AgentPlanStepStatus,
      filePath: extractFilePath(description),
    });
  }

  return steps;
}

function extractOrderedMarkers(text: string): AgentPlanStep[] {
  const steps: AgentPlanStep[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(ORDERED_MARKER.source, ORDERED_MARKER.flags);

  while ((match = regex.exec(text)) !== null) {
    const description = match[1].trim();
    if (description.length < 3) continue;

    steps.push({
      index: steps.length,
      description: truncateStep(description),
      status: 'pending' as AgentPlanStepStatus,
      filePath: extractFilePath(description),
    });
  }

  return steps;
}

function extractSummary(text: string): string {
  // Look for plan header line
  const lines = text.split('\n');
  for (const line of lines) {
    if (PLAN_HEADER.test(line)) {
      const cleaned = line.replace(/^[#*\-\s]+/, '').replace(PLAN_HEADER, '').trim();
      if (cleaned.length > 5) return truncateStep(cleaned);
    }
  }
  // Fallback: first non-empty line
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 5 && !trimmed.startsWith('```')) {
      return truncateStep(trimmed);
    }
  }
  return '';
}

function extractFilePath(description: string): string | undefined {
  // Match file paths like src/components/Login.tsx or ./pages/index.tsx
  const fileMatch = description.match(/(?:^|\s)((?:\.\/|src\/|packages\/|components\/|pages\/|lib\/|app\/)[^\s,)]+\.\w+)/);
  if (fileMatch) return fileMatch[1];

  // Match backtick-quoted paths
  const backtickMatch = description.match(/`([^`]+\.\w+)`/);
  if (backtickMatch) return backtickMatch[1];

  return undefined;
}

function truncateStep(text: string): string {
  if (text.length <= 200) return text;
  return text.substring(0, 197) + '...';
}

/**
 * Updates plan step statuses based on agent's current file activity.
 */
export function updatePlanProgress(plan: AgentPlan, currentFile: string): AgentPlan {
  const updatedSteps = plan.steps.map((step) => {
    if (step.filePath && currentFile.endsWith(step.filePath.replace(/^\.\//, ''))) {
      if (step.status === 'pending') {
        return { ...step, status: 'active' as AgentPlanStepStatus };
      }
    }
    return step;
  });

  // Find the highest active step
  let newCurrentIndex = plan.currentStepIndex;
  for (let i = 0; i < updatedSteps.length; i++) {
    if (updatedSteps[i].status === 'active') {
      newCurrentIndex = i;
      // Mark previous active steps as completed
      for (let j = 0; j < i; j++) {
        if (updatedSteps[j].status === 'active') {
          updatedSteps[j] = { ...updatedSteps[j], status: 'completed' as AgentPlanStepStatus };
        }
      }
    }
  }

  return {
    ...plan,
    steps: updatedSteps,
    currentStepIndex: newCurrentIndex,
  };
}
