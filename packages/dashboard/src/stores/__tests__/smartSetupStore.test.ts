import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSmartSetupStore } from '../smartSetupStore';

// Mock API functions
vi.mock('../../lib/api', () => ({
  startSmartSetup: vi.fn(),
  getSmartSetupRuns: vi.fn(),
  getSmartSetupRun: vi.fn(),
  applySmartSetup: vi.fn(),
}));

import {
  startSmartSetup,
  getSmartSetupRuns,
  getSmartSetupRun,
  applySmartSetup,
} from '../../lib/api';

const mockStartSmartSetup = vi.mocked(startSmartSetup);
const mockGetSmartSetupRuns = vi.mocked(getSmartSetupRuns);
const mockGetSmartSetupRun = vi.mocked(getSmartSetupRun);
const mockApplySmartSetup = vi.mocked(applySmartSetup);

function getState() {
  return useSmartSetupStore.getState();
}

function act<T>(fn: () => T): T {
  return fn();
}

const MOCK_RUN = {
  id: 'run-1',
  projectId: 'proj-1',
  status: 'ready',
  profile: {
    languages: ['TypeScript'],
    frameworks: ['React'],
    packageManager: 'pnpm',
    hasTests: true,
    testFramework: 'vitest',
    hasClaude: true,
    hasClaudeSkills: false,
    hasMcp: false,
    hasHooks: false,
    monorepo: true,
    linesOfCode: 1000,
    fileCount: 50,
    detectedPatterns: ['REST API'],
  },
  discoveries: [
    {
      id: 'd1', repoUrl: 'https://github.com/test/repo1',
      repoName: 'test/repo1', stars: 100, description: 'Test repo 1',
      category: 'skill', relevanceScore: 85, relevanceReason: 'Good match',
      installCommand: null, configSnippet: null, selected: true,
    },
    {
      id: 'd2', repoUrl: 'https://github.com/test/repo2',
      repoName: 'test/repo2', stars: 50, description: 'Test repo 2',
      category: 'hook', relevanceScore: 45, relevanceReason: 'Partial match',
      installCommand: null, configSnippet: null, selected: false,
    },
  ],
  appliedCount: 0,
  error: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('smartSetupStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    act(() => getState().reset());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should have null currentRun', () => {
      expect(getState().currentRun).toBeNull();
    });

    it('should have empty runs array', () => {
      expect(getState().runs).toHaveLength(0);
    });

    it('should not be loading', () => {
      expect(getState().isLoading).toBe(false);
    });

    it('should have no error', () => {
      expect(getState().error).toBeNull();
    });
  });

  describe('toggleRepoSelection', () => {
    it('should toggle selected state of a discovery', () => {
      act(() => getState().setCurrentRun(MOCK_RUN as any));

      // d1 starts as selected:true, toggle to false
      act(() => getState().toggleRepoSelection('d1'));
      expect(getState().currentRun!.discoveries[0].selected).toBe(false);

      // d2 starts as selected:false, toggle to true
      act(() => getState().toggleRepoSelection('d2'));
      expect(getState().currentRun!.discoveries[1].selected).toBe(true);
    });

    it('should not crash when no currentRun', () => {
      act(() => getState().toggleRepoSelection('nonexistent'));
      expect(getState().currentRun).toBeNull();
    });

    it('should toggle back and forth', () => {
      act(() => getState().setCurrentRun(MOCK_RUN as any));

      act(() => getState().toggleRepoSelection('d1'));
      expect(getState().currentRun!.discoveries[0].selected).toBe(false);

      act(() => getState().toggleRepoSelection('d1'));
      expect(getState().currentRun!.discoveries[0].selected).toBe(true);
    });
  });

  describe('setCurrentRun', () => {
    it('should set current run', () => {
      act(() => getState().setCurrentRun(MOCK_RUN as any));
      expect(getState().currentRun).toBeTruthy();
      expect(getState().currentRun!.id).toBe('run-1');
    });

    it('should clear current run with null', () => {
      act(() => getState().setCurrentRun(MOCK_RUN as any));
      act(() => getState().setCurrentRun(null));
      expect(getState().currentRun).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      act(() => getState().setCurrentRun(MOCK_RUN as any));
      act(() => getState().reset());

      const s = getState();
      expect(s.currentRun).toBeNull();
      expect(s.runs).toHaveLength(0);
      expect(s.isLoading).toBe(false);
      expect(s.error).toBeNull();
    });
  });

  describe('startRun', () => {
    it('should set loading and call API', async () => {
      mockStartSmartSetup.mockResolvedValue({ runId: 'run-new' });
      mockGetSmartSetupRun.mockResolvedValue(MOCK_RUN as any);

      const promise = getState().startRun('proj-1', false);

      // Should be loading
      expect(getState().isLoading).toBe(true);

      await promise;

      // Should have called API with correct args
      expect(mockStartSmartSetup).toHaveBeenCalledWith('proj-1', false);
      expect(mockGetSmartSetupRun).toHaveBeenCalledWith('proj-1', 'run-new');

      // Should set current run (since status is 'ready', polling stops)
      expect(getState().currentRun).toBeTruthy();
      expect(getState().isLoading).toBe(false);
    });

    it('should pass skipGithub=true when specified', async () => {
      mockStartSmartSetup.mockResolvedValue({ runId: 'run-skip' });
      mockGetSmartSetupRun.mockResolvedValue({ ...MOCK_RUN, id: 'run-skip' } as any);

      await getState().startRun('proj-1', true);

      expect(mockStartSmartSetup).toHaveBeenCalledWith('proj-1', true);
    });

    it('should set error on API failure', async () => {
      mockStartSmartSetup.mockRejectedValue(new Error('Network error'));

      await getState().startRun('proj-1', false);

      expect(getState().error).toBe('Network error');
      expect(getState().isLoading).toBe(false);
    });
  });

  describe('loadRuns', () => {
    it('should load runs for project', async () => {
      mockGetSmartSetupRuns.mockResolvedValue([MOCK_RUN as any]);

      await getState().loadRuns('proj-1');

      expect(mockGetSmartSetupRuns).toHaveBeenCalledWith('proj-1');
      expect(getState().runs).toHaveLength(1);
      expect(getState().runs[0].id).toBe('run-1');
    });

    it('should handle load failure silently', async () => {
      mockGetSmartSetupRuns.mockRejectedValue(new Error('fail'));

      await getState().loadRuns('proj-1');

      expect(getState().runs).toHaveLength(0);
    });
  });

  describe('loadRun', () => {
    it('should load single run detail', async () => {
      mockGetSmartSetupRun.mockResolvedValue(MOCK_RUN as any);

      await getState().loadRun('proj-1', 'run-1');

      expect(mockGetSmartSetupRun).toHaveBeenCalledWith('proj-1', 'run-1');
      expect(getState().currentRun).toBeTruthy();
      expect(getState().currentRun!.id).toBe('run-1');
    });
  });

  describe('applySelected', () => {
    it('should call apply API with selected repo IDs', async () => {
      act(() => getState().setCurrentRun(MOCK_RUN as any));
      mockApplySmartSetup.mockResolvedValue({ success: true });
      mockGetSmartSetupRun.mockResolvedValue({ ...MOCK_RUN, status: 'completed', appliedCount: 1 } as any);

      await getState().applySelected('proj-1', 'run-1');

      // Should only include selected repos (d1 is selected)
      expect(mockApplySmartSetup).toHaveBeenCalledWith('proj-1', 'run-1', ['d1']);
      expect(getState().currentRun!.status).toBe('completed');
      expect(getState().isLoading).toBe(false);
    });

    it('should not call API when no repos selected', async () => {
      const noSelectedRun = {
        ...MOCK_RUN,
        discoveries: MOCK_RUN.discoveries.map((d) => ({ ...d, selected: false })),
      };
      act(() => getState().setCurrentRun(noSelectedRun as any));

      await getState().applySelected('proj-1', 'run-1');

      expect(mockApplySmartSetup).not.toHaveBeenCalled();
    });

    it('should not call API when no currentRun', async () => {
      await getState().applySelected('proj-1', 'run-1');
      expect(mockApplySmartSetup).not.toHaveBeenCalled();
    });

    it('should set error on apply failure', async () => {
      act(() => getState().setCurrentRun(MOCK_RUN as any));
      mockApplySmartSetup.mockRejectedValue(new Error('Apply failed'));

      await getState().applySelected('proj-1', 'run-1');

      expect(getState().error).toBe('Apply failed');
      expect(getState().isLoading).toBe(false);
    });
  });

  describe('stopPolling', () => {
    it('should clear polling timer', () => {
      // Manually set a fake timer
      const timer = setInterval(() => {}, 1000);
      useSmartSetupStore.setState({ pollingTimer: timer });

      act(() => getState().stopPolling());

      expect(getState().pollingTimer).toBeNull();
    });
  });
});
