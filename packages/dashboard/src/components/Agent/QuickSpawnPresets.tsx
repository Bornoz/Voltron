import { useCallback, useState } from 'react';
import { Layout, Bug, Rocket, Server, Palette, TestTube2, Plus, Trash2, Star } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PresetConfig {
  model: string;
  prompt: string;
}

interface Preset {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  descKey: string;
  model: string;
  prompt: string;
  /** Tailwind ring/border accent for hover state */
  accent: string;
  /** Model badge colour */
  badgeColor: string;
}

interface QuickSpawnPresetsProps {
  onSelect: (config: PresetConfig) => void;
  currentModel?: string;
  currentPrompt?: string;
}

/* ------------------------------------------------------------------ */
/*  Preset definitions                                                 */
/* ------------------------------------------------------------------ */

const PRESETS: Preset[] = [
  {
    id: 'landing-page',
    icon: Layout,
    titleKey: 'agent.presets.landingPage',
    descKey: 'agent.presets.landingPageDesc',
    model: 'claude-haiku-4-5-20251001',
    prompt: 'Create a modern landing page with hero, features, pricing, and contact sections',
    accent: 'hover:border-blue-500/50 hover:ring-1 hover:ring-blue-500/20',
    badgeColor: 'bg-emerald-900/40 text-emerald-400',
  },
  {
    id: 'bug-fix',
    icon: Bug,
    titleKey: 'agent.presets.bugFix',
    descKey: 'agent.presets.bugFixDesc',
    model: 'claude-sonnet-4-6',
    prompt: 'Analyze the codebase, identify bugs, and fix them',
    accent: 'hover:border-red-500/50 hover:ring-1 hover:ring-red-500/20',
    badgeColor: 'bg-blue-900/40 text-blue-400',
  },
  {
    id: 'full-app',
    icon: Rocket,
    titleKey: 'agent.presets.fullApp',
    descKey: 'agent.presets.fullAppDesc',
    model: 'claude-opus-4-6',
    prompt: 'Build a complete web application based on the project requirements',
    accent: 'hover:border-purple-500/50 hover:ring-1 hover:ring-purple-500/20',
    badgeColor: 'bg-purple-900/40 text-purple-400',
  },
  {
    id: 'api-backend',
    icon: Server,
    titleKey: 'agent.presets.apiBackend',
    descKey: 'agent.presets.apiBackendDesc',
    model: 'claude-haiku-4-5-20251001',
    prompt: 'Create a REST API with CRUD endpoints, validation, and error handling',
    accent: 'hover:border-amber-500/50 hover:ring-1 hover:ring-amber-500/20',
    badgeColor: 'bg-emerald-900/40 text-emerald-400',
  },
  {
    id: 'ui-polish',
    icon: Palette,
    titleKey: 'agent.presets.uiPolish',
    descKey: 'agent.presets.uiPolishDesc',
    model: 'claude-haiku-4-5-20251001',
    prompt: 'Improve the UI/UX with better styling, animations, and responsive design',
    accent: 'hover:border-pink-500/50 hover:ring-1 hover:ring-pink-500/20',
    badgeColor: 'bg-emerald-900/40 text-emerald-400',
  },
  {
    id: 'test-suite',
    icon: TestTube2,
    titleKey: 'agent.presets.testSuite',
    descKey: 'agent.presets.testSuiteDesc',
    model: 'claude-haiku-4-5-20251001',
    prompt: 'Write comprehensive unit and integration tests for the codebase',
    accent: 'hover:border-cyan-500/50 hover:ring-1 hover:ring-cyan-500/20',
    badgeColor: 'bg-emerald-900/40 text-emerald-400',
  },
];

/* ------------------------------------------------------------------ */
/*  User Custom Presets Store (persisted in localStorage)             */
/* ------------------------------------------------------------------ */

interface CustomPreset {
  id: string;
  title: string;
  model: string;
  prompt: string;
}

interface CustomPresetsState {
  presets: CustomPreset[];
  addPreset: (preset: Omit<CustomPreset, 'id'>) => void;
  removePreset: (id: string) => void;
}

const useCustomPresetsStore = create<CustomPresetsState>()(
  persist(
    (set) => ({
      presets: [],
      addPreset: (preset) =>
        set((state) => ({
          presets: [...state.presets, { ...preset, id: `custom-${Date.now()}` }],
        })),
      removePreset: (id) =>
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== id),
        })),
    }),
    { name: 'voltron-custom-presets' },
  ),
);

/* ------------------------------------------------------------------ */
/*  Helper: resolve model label from ID                               */
/* ------------------------------------------------------------------ */

function modelLabel(modelId: string): string {
  if (modelId.includes('haiku')) return 'Haiku 4.5';
  if (modelId.includes('sonnet')) return 'Sonnet 4.6';
  if (modelId.includes('opus')) return 'Opus 4.6';
  return modelId;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function QuickSpawnPresets({ onSelect, currentModel, currentPrompt }: QuickSpawnPresetsProps) {
  const { t } = useTranslation();
  const customPresets = useCustomPresetsStore((s) => s.presets);
  const addCustomPreset = useCustomPresetsStore((s) => s.addPreset);
  const removeCustomPreset = useCustomPresetsStore((s) => s.removePreset);
  const [saveName, setSaveName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  const handleSelect = useCallback(
    (preset: Preset) => {
      onSelect({ model: preset.model, prompt: preset.prompt });
    },
    [onSelect],
  );

  const handleSavePreset = useCallback(() => {
    if (!saveName.trim() || !currentPrompt?.trim()) return;
    addCustomPreset({
      title: saveName.trim(),
      model: currentModel || 'claude-haiku-4-5-20251001',
      prompt: currentPrompt.trim(),
    });
    setSaveName('');
    setShowSaveForm(false);
  }, [saveName, currentModel, currentPrompt, addCustomPreset]);

  return (
    <div className="space-y-2">
      <label className="block text-[10px] text-gray-500 uppercase tracking-wider">
        {t('agent.presets.title')}
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelect(preset)}
              className={`
                group relative flex flex-col items-start gap-1.5 px-3 py-2.5
                bg-gray-800/60 border border-gray-700/50 rounded-lg
                text-left transition-all duration-150
                hover:bg-gray-800 ${preset.accent}
              `}
              aria-label={`${t(preset.titleKey)}: ${preset.prompt}`}
            >
              {/* Icon + Title row */}
              <div className="flex items-center gap-1.5 w-full">
                <Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-200 transition-colors shrink-0" />
                <span className="text-[11px] font-medium text-gray-300 group-hover:text-gray-100 transition-colors truncate">
                  {t(preset.titleKey)}
                </span>
              </div>

              {/* Description */}
              <span className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors line-clamp-2 leading-tight">
                {t(preset.descKey)}
              </span>

              {/* Model badge */}
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${preset.badgeColor}`}>
                {modelLabel(preset.model)}
              </span>
            </button>
          );
        })}

        {/* Custom presets */}
        {customPresets.map((cp) => (
          <button
            key={cp.id}
            type="button"
            onClick={() => onSelect({ model: cp.model, prompt: cp.prompt })}
            className="group relative flex flex-col items-start gap-1.5 px-3 py-2.5 bg-gray-800/60 border border-gray-700/50 rounded-lg text-left transition-all duration-150 hover:bg-gray-800 hover:border-yellow-500/50 hover:ring-1 hover:ring-yellow-500/20"
          >
            <div className="flex items-center gap-1.5 w-full">
              <Star className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
              <span className="text-[11px] font-medium text-gray-300 group-hover:text-gray-100 transition-colors truncate flex-1">
                {cp.title}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeCustomPreset(cp.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-900/30 rounded transition-all"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
            </div>
            <span className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors line-clamp-2 leading-tight">
              {cp.prompt.slice(0, 80)}{cp.prompt.length > 80 ? '...' : ''}
            </span>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400">
              {modelLabel(cp.model)}
            </span>
          </button>
        ))}
      </div>

      {/* Save current as preset */}
      {currentPrompt && currentPrompt.trim().length > 0 && (
        <div className="pt-1">
          {!showSaveForm ? (
            <button
              type="button"
              onClick={() => setShowSaveForm(true)}
              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Plus className="w-3 h-3" />
              {t('agent.presets.saveAsCurrent')}
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                placeholder={t('agent.presets.presetName')}
                className="flex-1 px-2 py-1 text-[10px] bg-gray-800 border border-gray-700 rounded text-gray-300 focus:outline-none focus:border-yellow-600"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!saveName.trim()}
                className="px-2 py-1 text-[10px] font-medium text-yellow-400 bg-yellow-900/30 hover:bg-yellow-900/50 rounded disabled:opacity-30 transition-colors"
              >
                {t('agent.presets.save')}
              </button>
              <button
                type="button"
                onClick={() => { setShowSaveForm(false); setSaveName(''); }}
                className="px-1.5 py-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
