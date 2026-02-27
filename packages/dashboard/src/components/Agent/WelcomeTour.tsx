import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, CheckCircle, Rocket, FolderOpen, Bot, Shield, Map, Paintbrush, Keyboard } from 'lucide-react';
import { useTranslation } from '../../i18n';

/* ─── Constants ─── */

const STORAGE_KEY = 'voltron_tour_completed';

interface TourStep {
  titleKey: string;
  descKey: string;
  icon: typeof Rocket;
  iconColor: string;
  accentColor: string;
  bgGradient: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    titleKey: 'tour.step1Title',
    descKey: 'tour.step1Desc',
    icon: FolderOpen,
    iconColor: 'text-amber-400',
    accentColor: 'border-amber-500/40',
    bgGradient: 'from-amber-500/10 to-transparent',
  },
  {
    titleKey: 'tour.step2Title',
    descKey: 'tour.step2Desc',
    icon: Bot,
    iconColor: 'text-blue-400',
    accentColor: 'border-blue-500/40',
    bgGradient: 'from-blue-500/10 to-transparent',
  },
  {
    titleKey: 'tour.step3Title',
    descKey: 'tour.step3Desc',
    icon: Shield,
    iconColor: 'text-red-400',
    accentColor: 'border-red-500/40',
    bgGradient: 'from-red-500/10 to-transparent',
  },
  {
    titleKey: 'tour.step4Title',
    descKey: 'tour.step4Desc',
    icon: Map,
    iconColor: 'text-emerald-400',
    accentColor: 'border-emerald-500/40',
    bgGradient: 'from-emerald-500/10 to-transparent',
  },
  {
    titleKey: 'tour.step5Title',
    descKey: 'tour.step5Desc',
    icon: Paintbrush,
    iconColor: 'text-purple-400',
    accentColor: 'border-purple-500/40',
    bgGradient: 'from-purple-500/10 to-transparent',
  },
  {
    titleKey: 'tour.step6Title',
    descKey: 'tour.step6Desc',
    icon: Keyboard,
    iconColor: 'text-cyan-400',
    accentColor: 'border-cyan-500/40',
    bgGradient: 'from-cyan-500/10 to-transparent',
  },
];

/* ─── Props ─── */

interface WelcomeTourProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ─── Component ─── */

export function WelcomeTour({ isOpen, onClose }: WelcomeTourProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [animating, setAnimating] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const totalSteps = TOUR_STEPS.length;

  // Check if already completed
  const alreadyCompleted = useMemo(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }, []);

  // Reset state when opening
  useEffect(() => {
    if (isOpen && !alreadyCompleted) {
      setCurrentStep(0);
      setCompleted(false);
      setDirection('next');
      setAnimating(false);
    }
  }, [isOpen, alreadyCompleted]);

  // Mark tour as completed in localStorage
  const markCompleted = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // localStorage might be unavailable
    }
  }, []);

  // Navigate to step with animation direction
  const goToStep = useCallback((step: number, dir: 'next' | 'prev') => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    // Brief timeout for CSS transition
    setTimeout(() => {
      setCurrentStep(step);
      setAnimating(false);
    }, 150);
  }, [animating]);

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      goToStep(currentStep + 1, 'next');
    } else {
      // Complete the tour
      setDirection('next');
      setAnimating(true);
      setTimeout(() => {
        setCompleted(true);
        setAnimating(false);
        markCompleted();
      }, 150);
    }
  }, [currentStep, totalSteps, goToStep, markCompleted]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      goToStep(currentStep - 1, 'prev');
    }
  }, [currentStep, goToStep]);

  const handleSkip = useCallback(() => {
    markCompleted();
    onClose();
  }, [markCompleted, onClose]);

  const handleFinish = useCallback(() => {
    onClose();
  }, [onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        handleSkip();
        break;
      case 'ArrowRight':
      case 'Enter':
        if (completed) handleFinish();
        else handleNext();
        break;
      case 'ArrowLeft':
        if (!completed) handlePrev();
        break;
    }
  }, [isOpen, completed, handleSkip, handleFinish, handleNext, handlePrev]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus trap
  const handleFocusTrap = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleFocusTrap);
    return () => document.removeEventListener('keydown', handleFocusTrap);
  }, [handleFocusTrap]);

  // Don't render if not open or already completed on mount
  if (!isOpen || alreadyCompleted) return null;

  const step = TOUR_STEPS[currentStep];
  const StepIcon = step?.icon ?? Rocket;

  // Interpolate step indicator
  const stepIndicator = t('tour.stepOf')
    .replace('{current}', String(currentStep + 1))
    .replace('{total}', String(totalSteps));

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200000] flex items-center justify-center"
      onClick={handleSkip}
      role="dialog"
      aria-modal="true"
      aria-label={t('tour.title')}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md mx-4 bg-gray-900/95 border border-gray-700/60 rounded-2xl shadow-2xl shadow-blue-500/10 backdrop-blur-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 p-1.5 hover:bg-gray-800 rounded-lg transition-colors z-10"
          aria-label={t('common.close')}
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>

        {completed ? (
          /* ─── Completion Screen ─── */
          <div
            className={`p-8 text-center transition-all duration-300 ${
              animating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
            }`}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-100 mb-2">
              {t('tour.completedTitle')}
            </h2>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              {t('tour.completedMessage')}
            </p>
            <button
              onClick={handleFinish}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-600/20 transition-all"
              autoFocus
            >
              <Rocket className="w-4 h-4" />
              {t('tour.close')}
            </button>
          </div>
        ) : (
          /* ─── Tour Step Screen ─── */
          <>
            {/* Header */}
            <div className="px-6 pt-5 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Rocket className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">
                  {t('tour.title')}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">{t('tour.subtitle')}</p>
            </div>

            {/* Progress bar */}
            <div className="px-6 pb-3">
              <div className="flex gap-1">
                {TOUR_STEPS.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      idx < currentStep
                        ? 'bg-blue-500'
                        : idx === currentStep
                          ? 'bg-blue-400'
                          : 'bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              <div className="text-[10px] text-gray-500 mt-1.5 text-right">
                {stepIndicator}
              </div>
            </div>

            {/* Step content */}
            <div
              className={`px-6 pb-4 transition-all duration-200 ${
                animating
                  ? direction === 'next'
                    ? 'opacity-0 translate-x-4'
                    : 'opacity-0 -translate-x-4'
                  : 'opacity-100 translate-x-0'
              }`}
            >
              <div className={`p-4 rounded-xl border ${step.accentColor} bg-gradient-to-br ${step.bgGradient}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-gray-800/80 border border-gray-700/50`}>
                    <StepIcon className={`w-5 h-5 ${step.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-100 mb-1.5">
                      {t(step.titleKey)}
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {t(step.descKey)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer navigation */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/60">
              <button
                onClick={handleSkip}
                className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                {t('tour.skipTour')}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {t('tour.previous')}
                </button>
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-600/20 transition-all"
                >
                  {currentStep === totalSteps - 1 ? t('tour.finish') : t('tour.next')}
                  {currentStep < totalSteps - 1 && <ChevronRight className="w-3.5 h-3.5" />}
                  {currentStep === totalSteps - 1 && <CheckCircle className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
