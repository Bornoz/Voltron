export const tr = {
  // Header
  header: {
    title: 'VOLTRON',
    connected: 'Baglanti Aktif',
    connecting: 'Baglaniliyor',
    reconnecting: 'Yeniden Baglaniliyor',
    disconnected: 'Baglanti Kesildi',
  },

  // Sidebar
  sidebar: {
    fileExplorer: 'Dosya Gezgini',
    protectionZones: 'Koruma Bolgeleri',
    patternTester: 'Desen Testi',
    fileHistory: 'Dosya Gecmisi',
  },

  // ActionFeed
  actionFeed: {
    title: 'Canli Aksiyon Akisi',
    scrollToLatest: 'Son olaya git',
    events: 'olay',
    noEventsTitle: 'Henuz olay yok',
    noEventsDescription: 'Yapay zeka aksiyonlari yakalandikca burada gercek zamanli olarak gorunecek.',
  },

  // ActionFilter
  actionFilter: {
    filterByFilePath: 'Dosya yoluna gore filtrele...',
  },

  // ExecutionControls
  executionControls: {
    title: 'Calistirma Kontrolu',
    processed: 'Islenen:',
    pending: 'Bekleyen:',
    autoStopThreshold: 'Otomatik durdurma esigi:',
    stopReason: 'Durdurma nedeni:',
    stop: 'DURDUR',
    continue: 'DEVAM',
    reset: 'SIFIRLA',
    confirm: 'Emin misiniz?',
    stateHistory: 'Durum Gecmisi',
  },

  // RiskGauge
  riskGauge: {
    title: 'Risk Seviyesi',
    highestRisk: 'En Yuksek Risk',
  },

  // RiskTimeline
  riskTimeline: {
    title: 'Risk Zaman Cigisi',
    waitingForData: 'Yeterli veri bekleniyor...',
    risk: 'Risk',
  },

  // StateHistory
  stateHistory: {
    title: 'Durum Gecmisi',
    noTransitions: 'Henuz gecis yok',
    total: 'toplam',
  },

  // ZoneManager
  zoneManager: {
    noZones: 'Koruma bolgesi tanimlanmamis.',
    addZone: 'Bolge ekle',
    pathPattern: 'Yol deseni (orn., /etc/nginx/**)',
    reasonOptional: 'Neden (istege bagli)',
    save: 'Kaydet',
    cancel: 'Iptal',
    zoneCreated: 'Bolge Olusturuldu',
    zoneCreatedMessage: 'Koruma bolgesi "{path}" olusturuldu.',
    createFailed: 'Olusturma Basarisiz',
    zoneDeleted: 'Bolge Silindi',
    zoneDeletedMessage: 'Koruma bolgesi kaldirildi.',
    deleteFailed: 'Silme Basarisiz',
    cannotDeleteSystem: 'Sistem bolgesi silinemez',
    deleteZone: 'Bolgeyi sil',
  },

  // FileHistory
  fileHistory: {
    operations: 'islem',
    notFound: 'Gecmis bulunamadi',
    failedToLoad: 'Gecmis yuklenemedi',
  },

  // ActivityChart
  activityChart: {
    title: 'Aktivite',
    waitingForData: 'Yeterli veri bekleniyor...',
  },

  // RiskBreakdown
  riskBreakdown: {
    title: 'Risk Dagilimi',
    waitingForData: 'Veri bekleniyor...',
    total: 'Toplam',
  },

  // ProjectStats
  projectStats: {
    title: 'Istatistikler',
    totalEvents: 'Toplam Olay',
    byRiskLevel: 'Risk Seviyesine Gore',
    byActionType: 'Aksiyon Turune Gore',
  },

  // PatternTester
  patternTester: {
    title: 'Desen Test Araci',
    globPattern: 'Glob Deseni',
    testPath: 'Test Yolu',
    fileTreeMatches: 'Dosya Agaci Eslesen:',
    more: 'daha...',
    recursiveMatch: '= tekrarli esleme',
    singleLevelMatch: '= tek seviye esleme',
    singleCharacter: '= tek karakter',
  },

  // App
  app: {
    loadingVoltron: 'Voltron yukleniyor...',
    connectionError: 'Baglanti Hatasi',
    retry: 'Yeniden Dene',
    project: 'Proje',
    select: 'Sec...',
    noProjects: 'Proje yok',
    failedToLoadProjects: 'Projeler yuklenemedi',
    actionFeed: 'Aksiyon Akisi',
    github: 'GitHub',
    selectProjectFirst: 'Lutfen once bir proje secin',
    snapshots: 'Snapshot\'lar',
    behavior: 'Davranis',
    prompts: 'Promptlar',
  },

  // StatusBar
  statusBar: {
    events: 'olay',
    noEvents: 'Olay yok',
    emergencyStop: 'Ctrl+Shift+S: Acil Durdurma',
  },

  // Notifications (used in useEventStream)
  notifications: {
    executionStopped: 'Calistirma Durduruldu',
    executionResumed: 'Calistirma Devam Etti',
    executionReset: 'Calistirma Sifirlandi',
    riskAlert: 'Risk Alarmi',
    stoppedMessage: 'AI operasyonu operator tarafindan durduruldu.',
    resumedMessage: 'AI operasyonu devam ettirildi.',
    resetMessage: 'Calistirma durumu IDLE olarak sifirlandi.',
    stopFailed: 'Durdurma Basarisiz',
    continueFailed: 'Devam Ettirme Basarisiz',
    resetFailed: 'Sifirlama Basarisiz',
    unknownError: 'Bilinmeyen hata',
  },

  // EmptyState / Common
  common: {
    noFiles: 'Dosya yok',
    filesWillAppear: 'Olaylar alindikca dosyalar gorunecek.',
    loading: 'Yukleniyor...',
    ok: 'Tamam',
    close: 'Kapat',
  },

  // FileTree
  fileTree: {
    heatMap: 'Isi Haritasi',
  },

  // DiffViewer
  diffViewer: {
    diffTruncated: 'Diff kisildi - icerik tamamen gosterilmek icin cok buyuk',
    unified: 'Birlesik Gorunum',
    split: 'Yan Yana Gorunum',
    oldFile: 'Eski Dosya',
    newFile: 'Yeni Dosya',
  },

  // DiffHeader
  diffHeader: {
    created: 'Olusturuldu',
    modified: 'Degistirildi',
    deleted: 'Silindi',
    renamed: 'Yeniden Adlandirildi',
    dirCreated: 'Dizin Olusturuldu',
    dirDeleted: 'Dizin Silindi',
    dependency: 'Bagimlilik',
    config: 'Yapilandirma',
  },

  // GitHubReport
  github: {
    analyze: 'Analiz Et',
    analyzing: 'Analiz ediliyor...',
    dependencies: 'Bagimliliklar',
    devDependencies: 'Gelistirme Bagimliliklari',
    breakingChanges: 'Kirilici Degisiklikler',
    compliance: 'Uyumluluk',
    enterRepoUrl: 'GitHub repo URL girin ve analiz baslatin',
    noBreakingChanges: 'Kirilici degisiklik tespit edilmedi',
    breakingChange: 'kirilici degisiklik',
    noDependencyData: 'Bagimlilik verisi yok',
    noComplianceData: 'Uyumluluk verisi yok',
    complianceScore: 'Uyumluluk Puani',
    total: 'Toplam',
    outdated: 'Guncel Degil',
    conflicts: 'Catismalar',
    versionConflicts: 'Surum Catismalari',
    before: 'Once',
    after: 'Sonra',
    pass: 'basarili',
    fail: 'basarisiz',
    warn: 'uyari',
    searchAndAdapt: 'Claude ile Ara ve Adapte Et',
    searchPlaceholder: 'ornek: react login page tailwind',
    targetDir: 'Hedef dizin',
    anyFramework: 'Herhangi bir framework',
    searching: 'Araniyor...',
    searchAndAdaptBtn: 'Ara ve Adapte Et',
  },

  // Layout
  layout: {
    showSidebar: 'Kenar cubugunu goster',
    hideSidebar: 'Kenar cubugunu gizle',
    showPanel: 'Paneli goster',
    hidePanel: 'Paneli gizle',
  },

  // Operations
  operations: {
    fileCreate: 'Olustur',
    fileModify: 'Degistir',
    fileDelete: 'Sil',
    fileRename: 'Yeniden Adlandir',
    dirCreate: 'Dizin+',
    dirDelete: 'Dizin-',
    dependencyChange: 'Bagimlilik',
    configChange: 'Yapilandirma',
  },

  // Risk Levels
  riskLevels: {
    none: 'YOK',
    low: 'DUSUK',
    medium: 'ORTA',
    high: 'YUKSEK',
    critical: 'KRITIK',
  },

  // Snapshots
  snapshots: {
    title: 'Snapshot Tarayici',
    loadMore: 'Daha fazla yukle',
    noSnapshots: 'Henuz snapshot yok',
    label: 'Etiket',
    setLabel: 'Etiket ata',
    rollback: 'Geri Al',
    rollbackConfirm: 'Bu snapshot\'a geri donmek istediginizden emin misiniz?',
    rollbackSuccess: 'Geri alma basarili',
    rollbackMessage: 'Interceptor bu commit\'e geri donecek.',
    files: 'dosya',
    showFiles: 'Dosyalari goster',
    hideFiles: 'Dosyalari gizle',
    compare: 'Karsilastir',
    selectForCompare: 'Karsilastirmak icin sec',
    prune: 'Eski snapshot\'lari temizle',
    pruneConfirm: 'Son {keep} snapshot haricindeki tumunu silmek istediginizden emin misiniz?',
    pruneSuccess: 'Temizleme basarili',
    pruneMessage: '{deleted} snapshot silindi, {remaining} kaldi.',
    critical: 'Kritik',
    commit: 'Commit',
  },

  // Interceptor Status
  interceptor: {
    title: 'Agent Durumu',
    rate: 'Hiz',
    state: 'Durum',
  },

  // Behavior Scoring
  behavior: {
    title: 'Davranis Puani',
    calculate: 'Hesapla',
    overallScore: 'Genel Puan',
    riskScore: 'Risk Puani',
    velocityScore: 'Hiz Puani',
    complianceScore: 'Uyumluluk Puani',
    details: 'Detaylar',
    totalActions: 'Toplam Aksiyon',
    actionsPerMin: 'Aksiyon/dk',
    zoneViolations: 'Bolge Ihlalleri',
    trend: 'Trend',
    noData: 'Henuz davranis verisi yok',
  },

  // Prompt Versioning
  prompts: {
    title: 'Prompt Versiyonlari',
    newVersion: 'Yeni Versiyon',
    namePlaceholder: 'Versiyon adi...',
    contentPlaceholder: 'Prompt icerigi...',
    create: 'Olustur',
    cancel: 'Iptal',
    active: 'Aktif',
    activate: 'Aktif Et',
    compareParent: 'Onceki ile karsilastir',
    noVersions: 'Henuz prompt versiyonu yok',
    noChanges: 'Degisiklik yok',
  },

  // Agent Orchestration
  agent: {
    spawnAgent: 'Agent Baslat',
    prompt: 'Prompt',
    promptPlaceholder: 'Claude\'a ne yapmasini istiyorsunuz?',
    model: 'Model',
    targetDir: 'Hedef Dizin',
    spawn: 'Baslat',
    pause: 'Duraklat',
    resume: 'Devam',
    kill: 'Sonlandir',
    inject: 'Enjekte Et',
    tab: 'Agent',
    noLocation: 'Konum bekleniyor...',
    extractingPlan: 'Plan cikariliyor...',
    step: 'Adim',
    context: 'Baglam',
    injectPlaceholder: 'Agent\'a talimat enjekte et...',
    includeConstraints: 'Simulator kisitlamalarini dahil et',
    output: 'Cikti',
    search: 'Ara...',
    export: 'Disa Aktar',
    noOutput: 'Henuz cikti yok',
    scrollToBottom: 'Asagiya kay',
    gpsTracker: 'GPS Takip',
    plan: 'Plan',
    promptInjector: 'Prompt Enjeksiyonu',
    agentOutput: 'Agent Ciktisi',
    searchAndAdapt: 'Ara ve Adapte Et',
    searchQuery: 'Arama sorgusu...',
    framework: 'Framework',
    status: {
      idle: 'BOSTA',
      spawning: 'BASLATILIYOR',
      running: 'CALISIYOR',
      paused: 'DURAKLATILDI',
      injecting: 'ENJEKTE EDILIYOR',
      stopping: 'DURDURULUYOR',
      crashed: 'COKTU',
      completed: 'TAMAMLANDI',
    },
    activity: {
      thinking: 'Dusunuyor',
      reading: 'Okuyor',
      writing: 'Yaziyor',
      searching: 'Ariyor',
      executing: 'Calistiriyor',
      waiting: 'Bekliyor',
      idle: 'Bosta',
    },
  },

  // Language
  language: {
    tr: 'TR',
    en: 'EN',
  },
} as const;

/** Deeply maps every leaf value of T to `string` */
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type TranslationKeys = DeepStringify<typeof tr>;
