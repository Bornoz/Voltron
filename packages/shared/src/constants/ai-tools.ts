import type { AiToolId, AiToolTier } from '../types/ai-tool.js';

export interface AiToolRegistryEntry {
  id: AiToolId;
  name: string;
  tier: AiToolTier;
  description: string;
  homepage: string;
  /** lucide-react icon name */
  icon: string;
  detection: {
    /** Binary names to search via which/where */
    binaryNames: string[];
    /** npm global packages to check */
    npmPackages: string[];
    /** pip packages to check */
    pipPackages: string[];
    /** Config directories under $HOME */
    configDirs: string[];
    /** Process names to search (for desktop apps) */
    processNames: string[];
    /** macOS .app bundle paths */
    appBundlePaths: string[];
    /** GitHub CLI extensions */
    ghExtensions: string[];
  };
  spawn: {
    /** Stream output format when spawned */
    streamFormat: 'json-stream' | 'plain-text';
    /** Supported model identifiers */
    supportedModels: string[];
  } | null;
}

export const AI_TOOL_REGISTRY: Record<AiToolId, AiToolRegistryEntry> = {
  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code',
    tier: 'spawn',
    description: 'Anthropic Claude Code CLI — full agent control',
    homepage: 'https://claude.ai/claude-code',
    icon: 'Bot',
    detection: {
      binaryNames: ['claude'],
      npmPackages: ['@anthropic-ai/claude-code'],
      pipPackages: [],
      configDirs: ['.claude'],
      processNames: [],
      appBundlePaths: [],
      ghExtensions: [],
    },
    spawn: {
      streamFormat: 'json-stream',
      supportedModels: [
        'claude-haiku-4-5-20251001',
        'claude-sonnet-4-6',
        'claude-opus-4-6',
      ],
    },
  },

  'aider': {
    id: 'aider',
    name: 'Aider',
    tier: 'spawn',
    description: 'AI pair programming in the terminal',
    homepage: 'https://aider.chat',
    icon: 'MessageSquareCode',
    detection: {
      binaryNames: ['aider'],
      npmPackages: [],
      pipPackages: ['aider-chat'],
      configDirs: ['.aider'],
      processNames: [],
      appBundlePaths: [],
      ghExtensions: [],
    },
    spawn: {
      streamFormat: 'plain-text',
      supportedModels: [],
    },
  },

  'codex-cli': {
    id: 'codex-cli',
    name: 'OpenAI Codex CLI',
    tier: 'spawn',
    description: 'OpenAI Codex command-line tool',
    homepage: 'https://github.com/openai/codex',
    icon: 'Sparkles',
    detection: {
      binaryNames: ['codex'],
      npmPackages: ['@openai/codex'],
      pipPackages: [],
      configDirs: [],
      processNames: [],
      appBundlePaths: [],
      ghExtensions: [],
    },
    spawn: {
      streamFormat: 'plain-text',
      supportedModels: [],
    },
  },

  'cursor': {
    id: 'cursor',
    name: 'Cursor',
    tier: 'monitor',
    description: 'AI-powered code editor — file change monitoring',
    homepage: 'https://cursor.com',
    icon: 'MousePointer2',
    detection: {
      binaryNames: ['cursor'],
      npmPackages: [],
      pipPackages: [],
      configDirs: ['.cursor'],
      processNames: ['Cursor', 'cursor'],
      appBundlePaths: [
        '/Applications/Cursor.app',
        '/snap/cursor/current',
      ],
      ghExtensions: [],
    },
    spawn: null,
  },

  'github-copilot': {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    tier: 'readonly',
    description: 'GitHub Copilot CLI extension',
    homepage: 'https://github.com/features/copilot',
    icon: 'Github',
    detection: {
      binaryNames: [],
      npmPackages: [],
      pipPackages: [],
      configDirs: [],
      processNames: [],
      appBundlePaths: [],
      ghExtensions: ['github/gh-copilot'],
    },
    spawn: null,
  },

  'windsurf': {
    id: 'windsurf',
    name: 'Windsurf',
    tier: 'monitor',
    description: 'Codeium Windsurf AI editor — file change monitoring',
    homepage: 'https://codeium.com/windsurf',
    icon: 'Wind',
    detection: {
      binaryNames: ['windsurf'],
      npmPackages: [],
      pipPackages: [],
      configDirs: ['.codeium', '.windsurf'],
      processNames: ['Windsurf', 'windsurf'],
      appBundlePaths: [
        '/Applications/Windsurf.app',
      ],
      ghExtensions: [],
    },
    spawn: null,
  },
};
