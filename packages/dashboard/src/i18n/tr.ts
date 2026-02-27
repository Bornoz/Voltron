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

  // StatusBar (moved to end of file)

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
    errorTitle: 'Bir hata olustu',
    errorDescription: 'Bu bolumde beklenmeyen bir hata meydana geldi. Sayfayi yenileyerek tekrar deneyebilirsiniz.',
    retry: 'Yenile',
    technicalDetails: 'Teknik Detay',
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
    simulator: 'Simulator',
    refreshSimulator: 'Simulatoru Yenile',
    openSimulator: 'Yeni Sekmede Ac',
    simulatorIdle: 'Simulator onizlemesi icin bir agent baslatin',
    preview: 'Onizleme',
    previewMode: 'Onizleme',
    simulatorMode: 'Simulator',
    switchToSimulator: 'Simulator moduna gec',
    switchToPreview: 'Onizleme moduna gec',
    planExtractionFailed: 'Plan cikarilamadi',
    noPlanDetected: 'Bu oturumda plan algilanamadi',
    planFromBreadcrumbs: 'Dosya izlerinden olusturulan plan',
    agentCompleted: 'Agent tamamlandi',
    agentCrashed: 'Agent coktu',
    pauseFailed: 'Duraklatma basarisiz',
    resumeFailed: 'Devam ettirme basarisiz',
    killFailed: 'Durdurma basarisiz',
    filesCreated: 'dosya olusturuldu',
    showFileList: 'Dosyalari goster',
    hideFileList: 'Dosyalari gizle',
    editorHint: 'Tikla: sec | Surukle: tasi | Cift tikla: metin | Sag tikla: isaretle',
    toolSelect: 'Sec',
    toolMove: 'Tasi',
    toolResize: 'Boyutla',
    toolColor: 'Renk',
    toolFont: 'Font',
    toolText: 'Metin',
    toolEffect: 'Efekt',
    toolError: 'Hata Isaretle',
    toolAdd: 'Buraya Ekle',
    toolNote: 'Not Birak',
    colorText: 'Yazi',
    colorBg: 'Arka Plan',
    colorBorder: 'Cizgi',
    customColor: 'Ozel Renk',
    fontSize: 'Boyut',
    shadow: 'Golge',
    dragHint: 'Secili elementi surukleyerek tasiyin',
    textHint: 'Elementin uzerine tiklayip metni duzenleyin',
    pendingEdits: 'degisiklik bekliyor',
    clearAll: 'Temizle',
    showEdits: 'Degisiklikleri Goster',
    hideEdits: 'Gizle',
    saveAndSend: "AI'a Gonder",
    editList: 'Degisiklikler',
    removeEdit: 'Geri al',
    errorNotePlaceholder: 'Hata aciklamasi: burada ne yanlis?',
    addNotePlaceholder: 'Buraya ne eklenmeli?',
    annotationPlaceholder: 'Not...',
    fileMap: 'Dosya Haritasi',
    noNavigation: 'Henuz dosya navigasyonu yok',
    startAgent: 'Baslatmak icin agent calistirin',
    clickToExpand: 'Genisletmek icin tiklayin',
    thinking: 'Dusunuyor...',
    showOutput: 'Ciktiyi Goster',
    hideOutput: 'Ciktiyi Gizle',
    visits: 'ziyaret',
    devServer: 'Dev Server',
    devServerStarting: 'Dev server baslatiliyor...',
    devServerReady: 'Dev server hazir',
    devServerError: 'Dev server basarilamadi',
    devServerPort: 'Port',
    devServerRestart: 'Yeniden Baslat',
    installing: 'Paketler kuruluyor...',
    modelDescHaiku: 'Hizli, ekonomik',
    modelDescSonnet: 'Dengeli, guclu',
    modelDescOpus: 'Maksimum yetenek',
    quickUseTailwind: 'Tailwind Kullan',
    quickFollowPatterns: 'Desenleri Takip Et',
    quickAddTypeScript: 'TypeScript Ekle',
    quickResponsive: 'Responsive Yap',

    // Hizli Baslat Sablonlari
    presets: {
      title: 'Hizli Sablonlar',
      landingPage: 'Landing Page',
      landingPageDesc: 'Hero, ozellikler, fiyatlandirma ve iletisim bolumlu modern sayfa',
      bugFix: 'Hata Duzeltme',
      bugFixDesc: 'Kod tabanini analiz et, hatalari bul ve duzelt',
      fullApp: 'Tam Uygulama',
      fullAppDesc: 'Proje gereksinimlerine gore eksiksiz web uygulamasi olustur',
      apiBackend: 'API Backend',
      apiBackendDesc: 'CRUD endpoint, validasyon ve hata yonetimli REST API',
      uiPolish: 'UI Cilalama',
      uiPolishDesc: 'Stil, animasyon ve responsive tasarim iyilestirmeleri',
      testSuite: 'Test Paketi',
      testSuiteDesc: 'Kapsamli unit ve entegrasyon testleri',
    },

    // Rules
    rules: {
      title: 'Proje Kurallari',
      placeholder: 'Proje kurallarinizi buraya yazin...\n- Her zaman Tailwind kullan\n- TypeScript strict mode\n- Dosya adlari kebab-case',
      active: 'Aktif',
      inactive: 'Devre Disi',
      toggle: 'Kurallari Degistir',
      saved: 'Kaydedildi',
      saving: 'Kaydediliyor...',
      autoSaveHint: 'Yazarken otomatik kaydeder',
      noRules: 'Kural tanimlanmamis',
      rulesWillBePrepended: 'Proje kurallari prompt\'a otomatik eklenir',
    },

    // Memory
    memory: {
      title: 'Proje Hafizasi',
      add: 'Ekle',
      edit: 'Duzenle',
      delete: 'Sil',
      pin: 'Sabitle',
      unpin: 'Sabitlemeyi Kaldir',
      pinned: 'Sabitlenmis',
      category: 'Kategori',
      search: 'Ara...',
      noMemories: 'Henuz hafiza yok',
      addNew: 'Yeni Hafiza Ekle',
      categoryArchitecture: 'Mimari',
      categoryConventions: 'Kurallar',
      categoryBugs: 'Bilinen Hatalar',
      categoryPatterns: 'Desenler',
      categoryGeneral: 'Genel',
      saveMemory: 'Kaydet',
      cancelMemory: 'Iptal',
      pinnedWillBeIncluded: 'sabitlenmis hafiza context\'e dahil edilecek',
      titlePlaceholder: 'Baslik...',
      contentPlaceholder: 'Icerik...',
    },

    // Session History
    history: {
      title: 'Oturum Gecmisi',
      noSessions: 'Henuz oturum yok',
      rerun: 'Tekrar Calistir',
      viewDetails: 'Detaylar',
      copyPrompt: 'Prompt Kopyala',
      spawnWithSame: 'Ayni Yapilandirma ile Baslat',
      filesCount: 'dosya',
      tokensUsed: 'token',
      duration: 'Sure',
      ago: 'once',
      completed: 'Tamamlandi',
      crashed: 'Coktu',
      empty: 'Bos',
    },

    // Context Menu
    contextMenu: {
      editText: 'Metni Duzenle',
      copySelector: 'Selektoru Kopyala',
      changeColor: 'Renk Degistir',
      colorText: 'Yazi Rengi',
      colorBg: 'Arka Plan',
      colorBorder: 'Cizgi Rengi',
      fontSize: 'Font Boyutu',
      addEffect: 'Efekt Ekle',
      shadowNone: 'Yok',
      shadowLight: 'Hafif',
      shadowMedium: 'Orta',
      shadowStrong: 'Guclu',
      shadowEmboss: 'Kabartma',
      resize: 'Genislet/Daralt',
      markError: 'Hata Isaretle',
      addHere: 'Buraya Ekle',
      addNote: 'Not Birak',
      addPrompt: 'Prompt Ekle',
      showPins: 'Tum Pinleri Goster',
      hidePins: 'Pinleri Gizle',
      addRefImage: 'Referans Gorsel Ekle',
      clearAll: 'Tum Duzenlemeleri Temizle',
      deletePin: 'Sil',
      editPin: 'Duzenle',
    },

    // Prompt Pins
    promptPin: {
      title: 'Prompt Pin',
      placeholder: 'Detayli talimatinizi yazin...',
      nearElement: 'Yakin element',
      coordinate: 'Koordinat',
      save: 'Kaydet',
      cancel: 'Iptal',
      ctrlEnter: 'Ctrl+Enter ile kaydet',
      count: 'pin',
      editTitle: 'Pin Duzenle',
    },

    // Reference Image
    refImage: {
      title: 'Referans Gorsel',
      opacity: 'Opakllik',
      remove: 'Kaldir',
      show: 'Goster',
      hide: 'Gizle',
    },

    // Phase Execution
    phase: {
      title: 'Faz Takibi',
      phase: 'Faz',
      approve: 'Onayla',
      reject: 'Reddet',
      pending: 'Bekliyor',
      running: 'Calisiyor',
      awaitingApproval: 'Onay Bekliyor',
      approved: 'Onaylandi',
      rejected: 'Reddedildi',
      completed: 'Tamamlandi',
      failed: 'Basarisiz',
      styleChanges: 'Stil Degisiklikleri',
      contentAdditions: 'Icerik Eklemeleri',
      errorFixes: 'Hata Duzeltmeleri',
      acceptCriteria: 'Kabul Kriteri',
    },

    // GPS Controls
    // Layout
    layout: {
      gpsFocus: 'GPS Odak',
      editorFocus: 'Editor Odak',
      balanced: 'Dengeli',
      showLeft: 'Sol Paneli Goster',
      hideLeft: 'Sol Paneli Gizle',
      showRight: 'Sag Paneli Goster',
      hideRight: 'Sag Paneli Gizle',
      doubleClickReset: 'Sifirlamak icin cift tikla',
    },

    // Toast Bildirimleri
    toast: {
      agentStarted: 'Agent baslatildi',
      agentCompleted: 'Agent basariyla tamamlandi',
      agentCrashed: 'Agent coktu',
      agentPaused: 'Agent duraklatildi',
      agentResumed: 'Agent devam ediyor',
      injectionApplied: 'Enjeksiyon uygulandi',
    },

    // Timeline
    timeline: {
      title: 'Aktivite Zaman Cizelgesi',
      empty: 'Henuz aktivite yok',
    },

    // Oturum Disa Aktarim
    sessionExport: {
      title: 'Oturum Disa Aktarimi',
      downloadJson: 'JSON Rapor Indir',
      copySummary: 'Ozeti Kopyala',
      copy: 'Kopyala',
      copied: 'Kopyalandi!',
      noSession: 'Aktif oturum yok',
    },

    // Window Manager
    windowManager: {
      panelMenu: 'Panel Menu',
      resetLayout: 'Duzeni Sifirla',
      presetIde: 'IDE Stili',
      presetGps: 'GPS Odak',
      presetMonitor: 'Monitor',
      minimize: 'Kucult',
      maximize: 'Tam Ekran',
      restore: 'Geri Yukle',
      close: 'Kapat',
      bringToFront: 'One Getir',
      panelVisualEditor: 'Gorsel Editor',
      panelGpsNavigator: 'GPS Navigator',
      panelAgentTracker: 'Agent Takip',
      panelPhaseViewer: 'Faz Gorunumu',
      panelPromptInjector: 'Prompt Enjeksiyon',
      panelActivityTimeline: 'Aktivite Zaman Cizelgesi',
      panelAgentOutput: 'Agent Ciktisi',
      panelRulesEditor: 'Kural Editoru',
      panelMemoryManager: 'Hafiza Yoneticisi',
      panelSessionHistory: 'Oturum Gecmisi',
    },

    // Klavye Kisayollari
    shortcuts: {
      title: 'Klavye Kisayollari',
      gpsFullscreen: 'Ctrl+Shift+G: GPS Tam Ekran',
      editorFullscreen: 'Ctrl+Shift+E: Editor Tam Ekran',
      promptFocus: 'Ctrl+Shift+P: Prompt Odakla',
      togglePause: 'Bosluk: Duraklat/Devam',
      toggleBreakpoint: 'Ctrl+Shift+B: Breakpoint Degistir',
      toggleOutput: 'Ctrl+Shift+O: Ciktiyi Ac/Kapat',
      escape: 'Escape: Tam Ekrandan Cik',
    },

    gps: {
      pauseAgent: 'Duraklat',
      stopAgent: 'Durdur',
      sendPrompt: 'Prompt Gonder',
      switchFile: 'Dosya Degistir',
      viewOutput: 'Mevcut Ciktiyi Gor',
      fileInfo: 'Dosya Bilgisi',
      duration: 'Sure',
      lastToolCalls: 'Son Tool Cagrilari',
      doInFile: 'Bu dosyada yap',
      viewContent: 'Icerigi Gor',
      viewHistory: 'Gecmisi Gor',
      compact: 'Kompakt',
      expanded: 'Genisletilmis',
      lineRange: 'Satir',
      toolName: 'Arac',
      searchFiles: 'Dosya ara...',
      heatmap: 'Isi Haritasi',
      panMode: 'Tasima Modu (El Araci)',
      minimap: 'Mini Harita',
      zoomIn: 'Yakinlastir',
      zoomOut: 'Uzaklastir',
      resetView: 'Gorunumu Sifirla',
      stats: 'Istatistikler',
      timeline: 'Zaman Cizelgesi',
      live: 'CANLI',
      replay: 'Tekrar Oynat',
      redirect: 'Agent\'i Buraya Yonlendir',
      setBreakpoint: 'Breakpoint Koy',
      removeBreakpoint: 'Breakpoint Kaldir',
      copyPath: 'Yolu Kopyala',
      previewFile: 'Dosya Onizleme',
      activity: 'Aktivite',
      noPreview: 'Onizleme mevcut degil',
      topFiles: 'En Cok Ziyaret',
      fullscreen: 'Tam Ekran',
      exitFullscreen: 'Tam Ekrandan Cik',
      visitCount: 'ziyaret',
      avgPerFile: 'Ort/dosya',
      filesVisited: 'Ziyaret Edilen',
      totalVisits: 'Toplam Ziyaret',
      breakpointHit: 'Breakpoint Tetiklendi',
      injectionQueued: 'Enjeksiyon Kuyrukta',
      conflictWarning: 'Cakisma Uyarisi',
      agentRedirected: 'Agent Yonlendirildi',
    },

    // Chat
    chat: {
      title: 'AI Sohbet',
      messages: 'mesaj',
      placeholder: 'Mesaj yaz...',
      empty: 'Henuz mesaj yok. Agent calistirinca yanitlar burada gorunecek.',
      attachFile: 'Dosya Ekle',
      send: 'Gonder',
    },

    // File Upload
    upload: {
      title: 'Dosya Yukleme',
      dragDrop: 'Dosyalari surukle & birak',
      maxSize: 'Maks 10MB',
      uploading: 'Yukleniyor...',
    },

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

  // Login
  login: {
    title: 'VOLTRON',
    subtitle: 'AI Operasyon Kontrol Merkezi',
    username: 'Kullanici Adi',
    password: 'Sifre',
    signIn: 'Giris Yap',
    invalidCredentials: 'Kullanici adi ve sifre bos birakilamaz.',
    signOut: 'Cikis Yap',
    welcomeBack: 'Tekrar Hosgeldiniz',
  },

  // Not Found
  notFound: {
    message: 'Aradiginiz sayfa bulunamadi.',
    backToDashboard: 'Dashboard\'a Don',
  },

  // Language
  language: {
    tr: 'TR',
    en: 'EN',
  },

  // Komut Paleti
  commandPalette: {
    placeholder: 'Komut yazin...',
    noResults: 'Eslesen komut bulunamadi',
    panels: 'Paneller',
    layout: 'Yerlesim',
    agent: 'Agent',
    navigation: 'Navigasyon',
    show: 'Goster',
    hide: 'Gizle',
    maximize: 'Tam Ekran',
    layoutIDE: 'IDE Yerlesimi',
    layoutGPS: 'GPS Odakli Yerlesim',
    layoutMonitor: 'Monitor Yerlesimi',
    layoutReset: 'Yerlesimi Sifirla',
    showShortcuts: 'Klavye Kisayollarini Goster',
    openSettings: 'Ayarlari Ac',
    switchLanguage: 'Dil Degistir',
    navigate: 'Gezin',
    execute: 'Calistir',
    close: 'Kapat',
  },

  // Klavye Kisayollari
  shortcuts: {
    title: 'Klavye Kisayollari',
    global: 'Genel',
    agent: 'Agent',
    panels: 'Paneller',
    gps: 'GPS Navigasyon',
    commandPalette: 'Komut Paleti',
    showShortcuts: 'Kisayollari Goster',
    emergencyStop: 'Acil Durdurma',
    closeModal: 'Modal Kapat / Cikis',
    pauseResume: 'Duraklat / Devam Et',
    focusPrompt: 'Prompt Alanina Odaklan',
    toggleBreakpoint: 'Kesme Noktasi Degistir',
    toggleOutput: 'Cikti Panelini Degistir',
    sendPrompt: 'Prompt Gonder',
    gpsFullscreen: 'GPS Tam Ekran',
    editorFullscreen: 'Editor Tam Ekran',
    togglePanelMenu: 'Panel Menusunu Degistir',
    cyclePanels: 'Paneller Arasi Gezin',
    searchFiles: 'Dosya Ara',
    zoomInOut: 'Yakinlastir / Uzaklastir',
    panAlways: 'Tasima (her zaman)',
    panMode: 'Tasima modu surukle',
    scroll: 'Kaydirma',
    middleClick: 'Orta Tik',
    handTool: 'El Araci',
    footer: 'Bu diyalogu gostermek icin ? tusuna basin',
  },

  // Hosgeldiniz Turu
  tour: {
    title: 'Voltron\'a Hosgeldiniz',
    subtitle: 'Temel ozellikleri kesfetmek icin hizli bir tur yapalim.',
    skipTour: 'Turu Atla',
    previous: 'Onceki',
    next: 'Sonraki',
    finish: 'Tamamla',
    stepOf: '{current} / {total}',
    completedTitle: 'Tur Tamamlandi!',
    completedMessage: 'Artik Voltron\'u kullanmaya hazirsiniz. Iyi calisma!',
    close: 'Basla',
    step1Title: 'Proje Secici',
    step1Desc: 'Sol ustteki proje secicisinden projeler arasinda gecis yapin. Her proje kendi koruma bolgeleri, kurallar ve agent oturumlarina sahiptir.',
    step2Title: 'Agent Sekmesi',
    step2Desc: 'Ana calisma alaniniz. AI agent\'i buradan baslatir, izler ve yonetirsiniz. Prompt enjeksiyonu, faz takibi ve cikti panelleri burada yer alir.',
    step3Title: 'Calistirma Kontrolleri',
    step3Desc: 'Agent\'i duraklatma, devam ettirme ve sonlandirma kontrolleri. Acil durumlarda Ctrl+Shift+S ile aninda durdurabilirsiniz.',
    step4Title: 'GPS Navigasyon Haritasi',
    step4Desc: 'Agent\'in dosya sisteminde nerede calistigini gercek zamanli gorsellestirir. Isi haritasi, zoom, pan ve breakpoint ozellikleri iceren interaktif harita.',
    step5Title: 'Gorsel Editor',
    step5Desc: 'Canli onizleme ile dogrudan UI uzerinde duzenleme yapin. Sag tik menusunden renk, metin, efekt degisiklikleri ve prompt pin\'leri ekleyin.',
    step6Title: 'Klavye Kisayollari',
    step6Desc: 'Ctrl+K ile komut paletini acin, ? ile tum kisayollari gorun. Bosluk tusuna basarak agent\'i hizla duraklatip devam ettirebilirsiniz.',
  },

  // Ayarlar
  settings: {
    title: 'Ayarlar',
    language: 'Dil',
    defaultModel: 'Varsayilan AI Modeli',
    defaultLayout: 'Varsayilan Yerlesim',
    notifications: 'Bildirimler',
    turkish: 'Turkce',
    modelFast: 'Hizli',
    modelBalanced: 'Dengeli',
    modelPowerful: 'Guclu',
  },

  // Durum Cubugu
  statusBar: {
    events: 'olay',
    noEvents: 'Olay yok',
    emergencyStop: 'Ctrl+Shift+S: Acil Durdurma',
    connected: 'WebSocket Bagli',
    disconnected: 'WebSocket Bagli Degil',
    eventRate: 'Dakika basina olay',
    uptime: 'Sunucu Calisma Suresi',
    commandPalette: 'Komutlar',
  },
} as const;

/** Deeply maps every leaf value of T to `string` */
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type TranslationKeys = DeepStringify<typeof tr>;
