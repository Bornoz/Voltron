import type { TranslationKeys } from './tr';

export const en: TranslationKeys = {
  // Header
  header: {
    title: 'VOLTRON',
    connected: 'Connected',
    connecting: 'Connecting',
    reconnecting: 'Reconnecting',
    disconnected: 'Disconnected',
  },

  // Sidebar
  sidebar: {
    fileExplorer: 'File Explorer',
    protectionZones: 'Protection Zones',
    patternTester: 'Pattern Test',
    fileHistory: 'File History',
  },

  // ActionFeed
  actionFeed: {
    title: 'Live Action Feed',
    scrollToLatest: 'Scroll to latest',
    events: 'events',
    noEventsTitle: 'No events yet',
    noEventsDescription: 'AI action events will appear here in real-time as they are captured.',
  },

  // ActionFilter
  actionFilter: {
    filterByFilePath: 'Filter by file path...',
  },

  // ExecutionControls
  executionControls: {
    title: 'Execution Control',
    processed: 'Processed:',
    pending: 'Pending:',
    autoStopThreshold: 'Auto-stop threshold:',
    stopReason: 'Stop reason:',
    stop: 'STOP',
    continue: 'CONTINUE',
    reset: 'RESET',
    confirm: 'Confirm?',
    stateHistory: 'State History',
  },

  // RiskGauge
  riskGauge: {
    title: 'Risk Level',
    highestRisk: 'Highest Risk',
  },

  // RiskTimeline
  riskTimeline: {
    title: 'Risk Timeline',
    waitingForData: 'Waiting for sufficient data...',
    risk: 'Risk',
  },

  // StateHistory
  stateHistory: {
    title: 'State History',
    noTransitions: 'No transitions yet',
    total: 'total',
  },

  // ZoneManager
  zoneManager: {
    noZones: 'No protection zones defined.',
    addZone: 'Add zone',
    pathPattern: 'Path pattern (e.g., /etc/nginx/**)',
    reasonOptional: 'Reason (optional)',
    save: 'Save',
    cancel: 'Cancel',
    zoneCreated: 'Zone Created',
    zoneCreatedMessage: 'Protection zone "{path}" created.',
    createFailed: 'Create Failed',
    zoneDeleted: 'Zone Deleted',
    zoneDeletedMessage: 'Protection zone removed.',
    deleteFailed: 'Delete Failed',
    cannotDeleteSystem: 'Cannot delete system zone',
    deleteZone: 'Delete zone',
  },

  // FileHistory
  fileHistory: {
    operations: 'operations',
    notFound: 'No history found',
    failedToLoad: 'Failed to load history',
  },

  // ActivityChart
  activityChart: {
    title: 'Activity',
    waitingForData: 'Waiting for sufficient data...',
  },

  // RiskBreakdown
  riskBreakdown: {
    title: 'Risk Breakdown',
    waitingForData: 'Waiting for data...',
    total: 'Total',
  },

  // ProjectStats
  projectStats: {
    title: 'Statistics',
    totalEvents: 'Total Events',
    byRiskLevel: 'By Risk Level',
    byActionType: 'By Action Type',
  },

  // PatternTester
  patternTester: {
    title: 'Pattern Tester',
    globPattern: 'Glob Pattern',
    testPath: 'Test Path',
    fileTreeMatches: 'File Tree Matches:',
    more: 'more...',
    recursiveMatch: '= recursive match',
    singleLevelMatch: '= single level match',
    singleCharacter: '= single character',
  },

  // App
  app: {
    loadingVoltron: 'Loading Voltron...',
    connectionError: 'Connection Error',
    retry: 'Retry',
    project: 'Project',
    select: 'Select...',
    noProjects: 'No projects',
    failedToLoadProjects: 'Failed to load projects',
    actionFeed: 'Action Feed',
    github: 'GitHub',
    selectProjectFirst: 'Please select a project first',
    snapshots: 'Snapshots',
    behavior: 'Behavior',
    prompts: 'Prompts',
  },

  // StatusBar
  statusBar: {
    events: 'events',
    noEvents: 'No events',
    emergencyStop: 'Ctrl+Shift+S: Emergency Stop',
  },

  // Notifications
  notifications: {
    executionStopped: 'Execution Stopped',
    executionResumed: 'Execution Resumed',
    executionReset: 'Execution Reset',
    riskAlert: 'Risk Alert',
    stoppedMessage: 'AI operation has been stopped by operator.',
    resumedMessage: 'AI operation has been resumed.',
    resetMessage: 'Execution state has been reset to IDLE.',
    stopFailed: 'Stop Failed',
    continueFailed: 'Continue Failed',
    resetFailed: 'Reset Failed',
    unknownError: 'Unknown error',
  },

  // EmptyState / Common
  common: {
    noFiles: 'No files',
    filesWillAppear: 'Files will appear as events are received.',
    loading: 'Loading...',
    ok: 'OK',
    close: 'Close',
    errorTitle: 'An error occurred',
    errorDescription: 'An unexpected error occurred in this section. You can try refreshing the page.',
    retry: 'Retry',
    technicalDetails: 'Technical Details',
  },

  // FileTree
  fileTree: {
    heatMap: 'Heat Map',
  },

  // DiffViewer
  diffViewer: {
    diffTruncated: 'Diff truncated - content is too large to display fully',
    unified: 'Unified View',
    split: 'Split View',
    oldFile: 'Old File',
    newFile: 'New File',
  },

  // DiffHeader
  diffHeader: {
    created: 'Created',
    modified: 'Modified',
    deleted: 'Deleted',
    renamed: 'Renamed',
    dirCreated: 'Dir Created',
    dirDeleted: 'Dir Deleted',
    dependency: 'Dependency',
    config: 'Config',
  },

  // GitHubReport
  github: {
    analyze: 'Analyze',
    analyzing: 'Analyzing...',
    dependencies: 'Dependencies',
    devDependencies: 'Dev Dependencies',
    breakingChanges: 'Breaking Changes',
    compliance: 'Compliance',
    enterRepoUrl: 'Enter a GitHub repo URL and start analysis',
    noBreakingChanges: 'No breaking changes detected',
    breakingChange: 'breaking change',
    noDependencyData: 'No dependency data',
    noComplianceData: 'No compliance data',
    complianceScore: 'Compliance Score',
    total: 'Total',
    outdated: 'Outdated',
    conflicts: 'Conflicts',
    versionConflicts: 'Version Conflicts',
    before: 'Before',
    after: 'After',
    pass: 'pass',
    fail: 'fail',
    warn: 'warn',
    searchAndAdapt: 'Search & Adapt with Claude',
    searchPlaceholder: 'e.g.: react login page tailwind',
    targetDir: 'Target directory',
    anyFramework: 'Any framework',
    searching: 'Searching...',
    searchAndAdaptBtn: 'Search & Adapt',
  },

  // Layout
  layout: {
    showSidebar: 'Show sidebar',
    hideSidebar: 'Hide sidebar',
    showPanel: 'Show panel',
    hidePanel: 'Hide panel',
  },

  // Operations
  operations: {
    fileCreate: 'Create',
    fileModify: 'Modify',
    fileDelete: 'Delete',
    fileRename: 'Rename',
    dirCreate: 'Dir+',
    dirDelete: 'Dir-',
    dependencyChange: 'Deps',
    configChange: 'Config',
  },

  // Risk Levels
  riskLevels: {
    none: 'NONE',
    low: 'LOW',
    medium: 'MED',
    high: 'HIGH',
    critical: 'CRIT',
  },

  // Snapshots
  snapshots: {
    title: 'Snapshot Browser',
    loadMore: 'Load more',
    noSnapshots: 'No snapshots yet',
    label: 'Label',
    setLabel: 'Set label',
    rollback: 'Rollback',
    rollbackConfirm: 'Are you sure you want to rollback to this snapshot?',
    rollbackSuccess: 'Rollback successful',
    rollbackMessage: 'Interceptor will restore to this git commit.',
    files: 'files',
    showFiles: 'Show files',
    hideFiles: 'Hide files',
    compare: 'Compare',
    selectForCompare: 'Select for compare',
    prune: 'Prune old snapshots',
    pruneConfirm: 'Are you sure you want to delete all snapshots except the last {keep}?',
    pruneSuccess: 'Prune successful',
    pruneMessage: '{deleted} snapshots deleted, {remaining} remaining.',
    critical: 'Critical',
    commit: 'Commit',
  },

  // Interceptor Status
  interceptor: {
    title: 'Agent Status',
    rate: 'Rate',
    state: 'State',
  },

  // Behavior Scoring
  behavior: {
    title: 'Behavior Score',
    calculate: 'Calculate',
    overallScore: 'Overall Score',
    riskScore: 'Risk Score',
    velocityScore: 'Velocity Score',
    complianceScore: 'Compliance Score',
    details: 'Details',
    totalActions: 'Total Actions',
    actionsPerMin: 'Actions/min',
    zoneViolations: 'Zone Violations',
    trend: 'Trend',
    noData: 'No behavior data yet',
  },

  // Prompt Versioning
  prompts: {
    title: 'Prompt Versions',
    newVersion: 'New Version',
    namePlaceholder: 'Version name...',
    contentPlaceholder: 'Prompt content...',
    create: 'Create',
    cancel: 'Cancel',
    active: 'Active',
    activate: 'Activate',
    compareParent: 'Compare with parent',
    noVersions: 'No prompt versions yet',
    noChanges: 'No changes',
  },

  // Agent Orchestration
  agent: {
    spawnAgent: 'Spawn Agent',
    prompt: 'Prompt',
    promptPlaceholder: 'What should Claude do?',
    model: 'Model',
    targetDir: 'Target Directory',
    spawn: 'Spawn',
    pause: 'Pause',
    resume: 'Resume',
    kill: 'Kill',
    inject: 'Inject',
    tab: 'Agent',
    noLocation: 'Waiting for location...',
    extractingPlan: 'Extracting plan...',
    step: 'Step',
    context: 'Context',
    injectPlaceholder: 'Inject instruction to agent...',
    includeConstraints: 'Include simulator constraints',
    output: 'Output',
    search: 'Search...',
    export: 'Export',
    noOutput: 'No output yet',
    scrollToBottom: 'Scroll to bottom',
    gpsTracker: 'GPS Tracker',
    plan: 'Plan',
    promptInjector: 'Prompt Injection',
    agentOutput: 'Agent Output',
    searchAndAdapt: 'Search & Adapt',
    searchQuery: 'Search query...',
    framework: 'Framework',
    simulator: 'Simulator',
    refreshSimulator: 'Refresh Simulator',
    openSimulator: 'Open in New Tab',
    simulatorIdle: 'Start an agent to preview simulator',
    preview: 'Preview',
    previewMode: 'Preview',
    simulatorMode: 'Simulator',
    switchToSimulator: 'Switch to Simulator mode',
    switchToPreview: 'Switch to Preview mode',
    planExtractionFailed: 'Plan extraction failed',
    noPlanDetected: 'No plan detected in this session',
    planFromBreadcrumbs: 'Plan generated from file activity',
    agentCompleted: 'Agent completed',
    agentCrashed: 'Agent crashed',
    filesCreated: 'files created',
    showFileList: 'Show files',
    hideFileList: 'Hide files',
    editorHint: 'Click: select | Drag: move | Double-click: text | Right-click: mark',
    toolSelect: 'Select',
    toolMove: 'Move',
    toolResize: 'Resize',
    toolColor: 'Color',
    toolFont: 'Font',
    toolText: 'Text',
    toolEffect: 'Effect',
    toolError: 'Mark Error',
    toolAdd: 'Add Here',
    toolNote: 'Note',
    colorText: 'Text',
    colorBg: 'Background',
    colorBorder: 'Border',
    customColor: 'Custom Color',
    fontSize: 'Size',
    shadow: 'Shadow',
    dragHint: 'Drag the selected element to move it',
    textHint: 'Click on element to edit its text',
    pendingEdits: 'edits pending',
    clearAll: 'Clear All',
    showEdits: 'Show Edits',
    hideEdits: 'Hide',
    saveAndSend: 'Send to AI',
    editList: 'Edits',
    removeEdit: 'Undo',
    errorNotePlaceholder: 'Describe the error: what is wrong here?',
    addNotePlaceholder: 'What should be added here?',
    annotationPlaceholder: 'Note...',
    fileMap: 'File Map',
    noNavigation: 'No file navigation yet',
    startAgent: 'Run an agent to start',
    clickToExpand: 'Click to expand',
    thinking: 'Thinking...',
    showOutput: 'Show Output',
    hideOutput: 'Hide Output',
    visits: 'visits',
    devServer: 'Dev Server',
    devServerStarting: 'Starting dev server...',
    devServerReady: 'Dev server ready',
    devServerError: 'Dev server failed',
    devServerPort: 'Port',
    devServerRestart: 'Restart',
    installing: 'Installing dependencies...',
    modelDescHaiku: 'Fast, economical',
    modelDescSonnet: 'Balanced, powerful',
    quickUseTailwind: 'Use Tailwind',
    quickFollowPatterns: 'Follow Patterns',
    quickAddTypeScript: 'Add TypeScript',
    quickResponsive: 'Responsive',

    // Context Menu
    contextMenu: {
      editText: 'Edit Text',
      copySelector: 'Copy Selector',
      changeColor: 'Change Color',
      colorText: 'Text Color',
      colorBg: 'Background',
      colorBorder: 'Border Color',
      fontSize: 'Font Size',
      addEffect: 'Add Effect',
      shadowNone: 'None',
      shadowLight: 'Light',
      shadowMedium: 'Medium',
      shadowStrong: 'Strong',
      shadowEmboss: 'Emboss',
      resize: 'Resize',
      markError: 'Mark Error',
      addHere: 'Add Here',
      addNote: 'Leave Note',
      addPrompt: 'Add Prompt',
      showPins: 'Show All Pins',
      hidePins: 'Hide Pins',
      addRefImage: 'Add Reference Image',
      clearAll: 'Clear All Edits',
      deletePin: 'Delete',
      editPin: 'Edit',
    },

    // Prompt Pins
    promptPin: {
      title: 'Prompt Pin',
      placeholder: 'Write your detailed instructions...',
      nearElement: 'Near element',
      coordinate: 'Coordinate',
      save: 'Save',
      cancel: 'Cancel',
      ctrlEnter: 'Ctrl+Enter to save',
      count: 'pins',
      editTitle: 'Edit Pin',
    },

    // Reference Image
    refImage: {
      title: 'Reference Image',
      opacity: 'Opacity',
      remove: 'Remove',
      show: 'Show',
      hide: 'Hide',
    },

    // Phase Execution
    phase: {
      title: 'Phase Tracker',
      phase: 'Phase',
      approve: 'Approve',
      reject: 'Reject',
      pending: 'Pending',
      running: 'Running',
      awaitingApproval: 'Awaiting Approval',
      approved: 'Approved',
      rejected: 'Rejected',
      completed: 'Completed',
      failed: 'Failed',
      styleChanges: 'Style Changes',
      contentAdditions: 'Content Additions',
      errorFixes: 'Error Fixes',
      acceptCriteria: 'Acceptance Criteria',
    },

    // GPS Controls
    gps: {
      pauseAgent: 'Pause',
      stopAgent: 'Stop',
      sendPrompt: 'Send Prompt',
      switchFile: 'Switch File',
      viewOutput: 'View Current Output',
      fileInfo: 'File Info',
      duration: 'Duration',
      lastToolCalls: 'Last Tool Calls',
      doInFile: 'Do in this file',
      viewContent: 'View Content',
      viewHistory: 'View History',
      compact: 'Compact',
      expanded: 'Expanded',
      lineRange: 'Line',
      toolName: 'Tool',
      searchFiles: 'Search files...',
      heatmap: 'Heatmap',
      minimap: 'Minimap',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      resetView: 'Reset View',
    },

    status: {
      idle: 'IDLE',
      spawning: 'SPAWNING',
      running: 'RUNNING',
      paused: 'PAUSED',
      injecting: 'INJECTING',
      stopping: 'STOPPING',
      crashed: 'CRASHED',
      completed: 'COMPLETED',
    },
    activity: {
      thinking: 'Thinking',
      reading: 'Reading',
      writing: 'Writing',
      searching: 'Searching',
      executing: 'Executing',
      waiting: 'Waiting',
      idle: 'Idle',
    },
  },

  // Login
  login: {
    title: 'VOLTRON',
    subtitle: 'AI Operation Control Center',
    username: 'Username',
    password: 'Password',
    signIn: 'Sign In',
    invalidCredentials: 'Username and password cannot be empty.',
    signOut: 'Sign Out',
    welcomeBack: 'Welcome Back',
  },

  // Not Found
  notFound: {
    message: 'The page you are looking for does not exist.',
    backToDashboard: 'Back to Dashboard',
  },

  // Language
  language: {
    tr: 'TR',
    en: 'EN',
  },
} as const;
