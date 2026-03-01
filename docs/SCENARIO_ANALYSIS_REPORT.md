# Voltron Senaryo Analizi & Arayuz Denetim Raporu

**Tarih:** 2026-03-01
**Analiz Kapsamı:** Dashboard UI, veri akışı, i18n, UX bütünlüğü
**Kaynak:** 79 bileşen, 12 store, 11 hook, 50+ API endpoint, 66+ WS mesaj tipi

---

## 1. VİZYON vs MEVCUT DURUM

### Kullanıcı Vizyonu
> Büyük bir AI yardımcısı — canlı izleme, mouse ile tam kontrol, sağ tık ile her şeye müdahale, premium tasarım, anlık önizleme, düzenleme, GitHub desteği.

### Mevcut Durum Özeti

| Alan | Hedef | Mevcut | Tamamlanma |
|------|-------|--------|------------|
| Canlı AI İzleme | Hangi dosya, ne işlem, ne değişti | Breadcrumb + GPS + Output paneli | %85 |
| AI Planı Görüntüleme | Plan, adımlar, sonraki aşama | PlanViewer + PhaseTracker | %75 |
| Mouse ile Tam Kontrol | Sağ tık + drag + sürükle-bırak | DesignContextMenu + FloatingPanel | %70 |
| Anlık Arayüz Önizleme | iframe canlı render | LivePreviewFrame + SimulatorEmbed | %80 |
| Düzenleme Yeteneği | Stil, metin, yapı düzenleme | DesignContextMenu (350+ seçenek) | %75 |
| GitHub Desteği | Repo analiz, PR, diff | RepoAnalyzer tab | %60 |
| Premium Tasarım | Glassmorphism, animasyon, tema | 2 tema, 7 accent renk, glass efektler | %80 |
| Bildirim Sistemi | Toast, durum bildirimleri | notificationStore + AgentToasts | %90 |
| i18n (Türkçe) | Tam Türkçe arayüz | %96.2 çeviri tamamlanmış | %96 |

---

## 2. SENARYO ANALİZİ

### Senaryo 1: Kullanıcı Agent Başlatır ve Canlı İzler

**Beklenti:** Agent başlat → hangi dosyada → ne yapıyor → plan ne → canlı output

**Mevcut Akış:**
```
Spawn butonu → API → WS: AGENT_STATUS_CHANGE(SPAWNING)
→ useAgentStream: setSession() + setStatus()
→ AgentControlBar güncellenir
→ WS: AGENT_LOCATION_UPDATE → GPSCanvas + GPSTracker
→ WS: AGENT_PLAN_UPDATE → PlanViewer
→ WS: AGENT_OUTPUT → AgentOutput paneli
→ WS: AGENT_BREADCRUMB → ActivityTimeline
```

**Eksikler:**

| # | Sorun | Önem | Açıklama |
|---|-------|------|----------|
| S1.1 | Agent output paneli varsayılan kapalı | YÜKSEK | Kullanıcı agent başlatınca agent-output paneli otomatik açılmalı. `AgentWorkspace.tsx` bunu yapıyor AMA sadece `useEffect` içinde — eğer panel daha önce kapatılmışsa race condition var |
| S1.2 | Breadcrumb overflow sessiz | ORTA | 500 breadcrumb dolunca eskiler sessizce siliniyor. Kullanıcıya "500+ işlem — eski kayıtlar silindi" uyarısı yok |
| S1.3 | Output overflow sessiz | ORTA | 1000 output mesajı dolunca eskiler sessizce siliniyor. Aynı sorun |
| S1.4 | Plan geç gelirse fallback zayıf | DÜŞÜK | 8 saniye sonra breadcrumb tabanlı sahte plan oluşturuluyor. Kafa karıştırıcı olabilir |

---

### Senaryo 2: Kullanıcı Sağ Tık ile Element Düzenler

**Beklenti:** iframe'de sağ tık → menü → stil değiştir → anında görülsün

**Mevcut Akış:**
```
iframe contextmenu event → postMessage(VOLTRON_CONTEXT_MENU)
→ SimulatorEmbed: onContextMenu() → DesignContextMenu açılır
→ Kullanıcı stil seçer → postMessage(VOLTRON_APPLY_STYLE)
→ iframe: target.style[prop] = value
→ postMessage(VOLTRON_STYLE_APPLIED) → SimulatorEmbed
```

**Eksikler:**

| # | Sorun | Önem | Açıklama |
|---|-------|------|----------|
| S2.1 | ~~Animasyon keyframes eksik~~ | ~~KRİTİK~~ | ✅ **Bu oturumda düzeltildi** |
| S2.2 | Undo stack sınırsız | ORTA | `useReducer` ile undo/redo var ama max limit yok. Uzun oturumlarda memory leak riski |
| S2.3 | Seçici çakışmaları | YÜKSEK | `el.className.split(' ')` ile CSS selector üretiliyor. Aynı class'a sahip birden fazla element varsa yanlış element seçilebilir |
| S2.4 | CSS değişiklikleri kalıcı değil | YÜKSEK | iframe'deki stil değişiklikleri sadece runtime. Sayfa yenilenince kaybolur. Kullanıcıya "değişiklikler geçici" uyarısı yok |
| S2.5 | Gradient/Shadow preview yok | ORTA | DesignContextMenu'da 10 gradient + 12 shadow preset var ama seçmeden önce hover preview yok, sadece küçük renk swatch'ları |
| S2.6 | Sağ tık menüsünde geri alma yok | YÜKSEK | Menüden stil değiştirdikten sonra menü içinde "Son değişikliği geri al" butonu yok. Undo sadece toolbar'dan |
| S2.7 | Metin düzenleme modal yok | ORTA | "İçerik Düzenle" seçeneği metin gönderiyor ama inline editing deneyimi yok — tam metin editörü gerekli |

---

### Senaryo 3: Kullanıcı Visual Editor'ı Büyütüp Düzenleme Yapar ve AI'ya Gönderir

**Beklenti:** Büyüt → düzenle → gönder → editor küçülsün → agent output açılsın

**Mevcut Akış (düzeltme sonrası):**
```
toggleMaximize('visual-editor') → zIndex: 99999, fullscreen
→ Kullanıcı düzenlemeler yapar
→ "Kaydet ve Gönder" → handleAgentInject()
→ ✅ visual-editor restore edilir
→ ✅ agent-output açılır + öne gelir
→ ✅ başarı bildirimi gösterilir
```

**Eksikler:**

| # | Sorun | Önem | Açıklama |
|---|-------|------|----------|
| S3.1 | ~~Gönderim sonrası yönlendirme yok~~ | ~~KRİTİK~~ | ✅ **Bu oturumda düzeltildi** |
| S3.2 | Maximize'da diğer paneller erişilemez | ORTA | Maximize edilen panel tüm ekranı kaplar — dock bile görünmez. Escape ile çıkış var ama kullanıcı bilmiyor |
| S3.3 | Maximize'dan çıkış ipucu yok | YÜKSEK | Büyütülmüş modda "Escape ile çık" veya "Çift tık ile küçült" ipucu gösterilmiyor |
| S3.4 | Gönderim onayı yok | ORTA | "AI'ya Gönder" tek tıkla tetikleniyor. "Emin misiniz?" diyaloğu yok. Yanlışlıkla gönderim riski |

---

### Senaryo 4: Kullanıcı AI Planını İnceler ve Aşamaları Onaylar/Reddeder

**Beklenti:** Plan görüntüle → aşama detayı → onayla/reddet → sonraki aşamaya geç

**Mevcut Akış:**
```
WS: AGENT_PLAN_UPDATE → agentStore.setPlan()
→ PlanViewer: plan özeti + adım listesi + confidence score
→ PhaseTracker: onay/red butonları (UI only!)
```

**Eksikler:**

| # | Sorun | Önem | Açıklama |
|---|-------|------|----------|
| S4.1 | Phase execution sadece UI | KRİTİK | Onay/red butonları sadece frontend state değiştirir. Server'a hiçbir komut gönderilmiyor! Agent bundan habersiz |
| S4.2 | Plan güncellenmesi gecikebilir | ORTA | Plan extraction debounce'lu. Hızlı çalışan agent'ta plan 2-3 saniye gecikmeli görünür |
| S4.3 | Plan adımları tıklanabilir değil | ORTA | Plan adımlarına tıklayınca ilgili dosyaya gitme özelliği yok. `filePath` alanı var ama kullanılmıyor |
| S4.4 | Reddedilen aşama sonrası ne olur belirsiz | YÜKSEK | Kullanıcı bir phase'i reddederse UI'da "rejected" olarak işaretleniyor ama agent çalışmaya devam ediyor — çelişkili durum |

---

### Senaryo 5: Kullanıcı GPS Haritasında Agent'ı Takip Eder

**Beklenti:** Force-directed graf → dosya düğümleri → agent imleci → tıkla → dosya önizle

**Mevcut Akış:**
```
WS: AGENT_LOCATION_UPDATE → fileTreeStore + agentStore
→ GPSCanvas: SVG graf + düğümler + kenarlar
→ GPSAgentCursor: mevcut dosyada pulsing daire
→ GPSMinimap: genel görünüm
→ Sağ tık düğüm → GPSContextMenu (Preview, Breakpoint, Redirect)
```

**Eksikler:**

| # | Sorun | Önem | Açıklama |
|---|-------|------|----------|
| S5.1 | Dosya içeriği önizlemesi lazy değil | ORTA | GPSFilePreview dosya içeriğini API'den çekiyor ama loading state'i zayıf |
| S5.2 | Agent'ı takip et (auto-follow) modu yok | YÜKSEK | Agent dosya değiştirdikçe kullanıcı manuel pan yapmalı. "Agent'ı takip et" toggle butonu gerekli |
| S5.3 | Kenar (edge) üstüne hover detay yok | DÜŞÜK | Dosyalar arası geçiş kenarlarına hover yapınca "A → B, 3 kez, risk: MEDIUM" bilgisi gösterilmiyor |
| S5.4 | Dosya düğümü boyutu sabit | DÜŞÜK | Tüm dosya düğümleri aynı boyutta. Değişiklik yoğunluğuna göre büyüme (heatmap size) güzel olurdu |
| S5.5 | Timeline scrub → canvas senkronizasyonu zayıf | ORTA | GPSTimeline'da zamanda geri gidince canvas düğümleri güncelleniyor ama animasyonlu geçiş yok |

---

### Senaryo 6: Kullanıcı Prompt Enjekte Eder (Çalışan Agent'a Talimat Verir)

**Beklenti:** Prompt yaz → gönder → queue'da göster → uygulandığında bildir

**Mevcut Akış:**
```
PromptInjector: textarea + "Gönder" butonu
→ api.agentInject(projectId, { prompt, context })
→ Server: injection DB'ye kaydedilir
→ Agent çalışırken injection uygulanır
→ ❌ AGENT_INJECTION_QUEUED event'i EMIT EDİLMİYOR
→ ❌ AGENT_INJECTION_APPLIED event'i EMIT EDİLMİYOR
```

**Eksikler:**

| # | Sorun | Önem | Açıklama |
|---|-------|------|----------|
| S6.1 | Injection event'leri emit edilmiyor | KRİTİK | Server'da `agent-runner.ts` injection'ı DB'ye kaydediyor ama `eventBus.emit()` çağırmıyor. Dashboard gerçek zamanlı injection durumunu göremez |
| S6.2 | Injection broadcast listesinde yok | KRİTİK | `ws/handler.ts:144-156` broadcast listesinde `AGENT_INJECTION_QUEUED/APPLIED` yok |
| S6.3 | Injection queue görsel feedback yok | YÜKSEK | Kullanıcı prompt gönderdikten sonra "Sırada" durumunu göremez. Sadece API response'a güveniyor |
| S6.4 | Çoklu injection sıralama belirsiz | ORTA | Birden fazla injection gönderildiğinde hangi sırayla uygulanacağı belli değil |

---

### Senaryo 7: Kullanıcı GitHub Entegrasyonu Kullanır

**Beklenti:** Repo analiz → breaking changes → PR oluştur → diff görüntüle

**Mevcut Akış:**
```
GitHub tab → RepoAnalyzer component
→ api.analyzeRepo() → repo özeti
→ Breaking change detection
→ Compliance check
```

**Eksikler:**

| # | Sorun | Önem | Açıklama |
|---|-------|------|----------|
| S7.1 | PR oluşturma yok | YÜKSEK | RepoAnalyzer sadece analiz yapıyor. Agent'ın değişikliklerinden PR oluşturma özelliği yok |
| S7.2 | Commit diff görüntüleme sınırlı | ORTA | DiffViewer var ama agent'ın yaptığı değişikliklerin commit bazlı diff'i gösterilmiyor |
| S7.3 | Branch yönetimi yok | ORTA | Kullanıcı branch oluşturamaz, değiştiremez. Tek branch (main) üzerinde çalışılıyor |
| S7.4 | GitHub webhook entegrasyonu yok | DÜŞÜK | Push/PR event'leri dinlenmiyor. Tek yönlü (Voltron → GitHub) |

---

### Senaryo 8: Kullanıcı Tema ve Premium Tasarım Deneyimi Yaşar

**Beklenti:** Her tema premium → glassmorphism → animasyonlar → gradient'ler → smooth geçişler

**Mevcut Durum:**
- 2 tema: `dark` (varsayılan), `midnight`
- 7 accent renk: blue, purple, green, orange, red, cyan, pink
- Glassmorphism: `backdrop-blur-md`, `glass-border`
- CSS Animasyonları: `fade-in-up`, `glow-pulse`, `shimmer`, `slide-in-right`

**Eksikler:**

| # | Sorun | Önem | Açıklama |
|---|-------|------|----------|
| S8.1 | Tema değişim animasyonu yok | ORTA | Tema değiştirilince anında geçiş var, smooth transition yok |
| S8.2 | Accent renk bazı yerlerde uygulanmıyor | ORTA | `--color-accent` CSS variable tanımlı ama bazı bileşenlerde hardcoded `blue-500` kullanılıyor |
| S8.3 | Light tema yok | DÜŞÜK | Sadece 2 koyu tema var. Gündüz kullanımı için light tema seçeneği yok |
| S8.4 | Panel başlık çubuğu tema duyarsız | DÜŞÜK | FloatingPanel başlık çubuğu her iki temada aynı görünüyor |
| S8.5 | Glassmorphism derinlik eksik | DÜŞÜK | Panel katmanları arasında derinlik farkı (gölge + blur yoğunluğu) yok. Hepsi aynı seviyede görünüyor |

---

### Senaryo 9: Kullanıcı Mobil/Tablet'ten Erişir

**Beklenti:** Responsive → touch desteği → bottom nav → panel yönetimi

**Mevcut Durum:**
- `useBreakpoint()` hook: mobile/tablet/desktop
- `MobileBottomNav`: 6 tab (feed, github, snapshots, behavior, prompts, agent)
- StatusBar mobilde gizli
- Tab bar tablet'te scroll edilebilir

**Eksikler:**

| # | Sorun | Önem | Açıklama |
|---|-------|------|----------|
| S9.1 | FloatingPanel touch drag desteği zayıf | YÜKSEK | `pointerdown` kullanılıyor ama touch-specific optimization yok (inertia, snap-to-grid) |
| S9.2 | DesignContextMenu mobilde kullanılamaz | KRİTİK | 320px genişliğinde menü + 272px side panel = 592px. Mobil ekrana sığmaz |
| S9.3 | GPS Canvas pinch-to-zoom yok | YÜKSEK | Sadece mouse wheel zoom var. Touch cihazlarda zoom yapılamaz |
| S9.4 | Agent workspace mobilde kaotik | YÜKSEK | 10 floating panel mobil ekranda yönetilemez. Mobil-specific layout gerekli |
| S9.5 | Prompt injection mobilde zor | ORTA | PromptInjector klavye açılınca panel boyutu sorunlu |

---

### Senaryo 10: Kullanıcı Breakpoint Koyar ve Agent'ı Durdurur

**Beklenti:** Dosyaya breakpoint → agent o dosyaya gelince dur → incele → devam et

**Mevcut Akış:**
```
GPSContextMenu veya Ctrl+Shift+B → addBreakpoint(filePath)
→ agentStore.breakpoints Set'ine eklenir
→ WS: AGENT_BREAKPOINT_HIT → output'a log yazılır
```

**Eksikler:**

| # | Sorun | Önem | Açıklama |
|---|-------|------|----------|
| S10.1 | Breakpoint set/remove broadcast yok | YÜKSEK | `AGENT_BREAKPOINT_SET` ve `AGENT_BREAKPOINT_REMOVED` event'leri server'da emit ediliyor ama dashboard broadcast listesinde yok |
| S10.2 | Breakpoint visual feedback zayıf | ORTA | GPS haritasında breakpoint'li dosya düğümlerinde belirgin görsel işaret yok |
| S10.3 | Koşullu breakpoint yok | DÜŞÜK | Sadece dosya bazlı breakpoint var. "Bu dosyaya YAZMA yapılırsa dur" gibi koşullu breakpoint yok |
| S10.4 | Breakpoint hit → otomatik pause yok | KRİTİK | `AGENT_BREAKPOINT_HIT` event'i sadece output'a log yazıyor. Agent otomatik olarak pause edilmiyor! |

---

### Senaryo 11: Kullanıcı Çoklu Panel Yönetimi Yapar

**Beklenti:** Panel aç/kapat → sürükle → boyutlandır → preset seç → düzen kaydet

**Mevcut Durum:**
- 10 panel: hepsi drag + resize + minimize + maximize + close
- 3 preset: IDE, GPS Focus, Monitor
- localStorage'a otomatik kayıt (debounced 300ms)
- Dock (sağ 40px): panel toggle butonları

**Eksikler:**

| # | Sorun | Önem | Açıklama |
|---|-------|------|----------|
| S11.1 | Panel snap-to-edge yok | ORTA | Paneller serbest sürüklenir. Kenar/köşe snap özelliği yok |
| S11.2 | Panel çakışma algılama yok | DÜŞÜK | İki panel üst üste geldiğinde uyarı veya otomatik düzenleme yok |
| S11.3 | Kullanıcı tanımlı preset kaydetme yok | ORTA | Sadece 3 sabit preset var. Kullanıcı kendi düzenini "Preset 4" olarak kaydedemez |
| S11.4 | Panel boyut sınırları dar | DÜŞÜK | minWidth/minHeight var ama maxWidth/maxHeight yok. Panel ekranın %200'ü kadar büyüyebilir |
| S11.5 | Minimize edilmiş paneller erişilemez | YÜKSEK | Minimize edilen panel sadece dock'tan açılabilir. Taskbar'da minimize durumu gösterilmiyor |

---

### Senaryo 12: Server Çökerse Ne Olur?

**Beklenti:** Graceful degradation → reconnect → state recovery

**Mevcut Akış:**
```
WS bağlantısı kopar → useWebSocket: status='disconnected'
→ Auto-reconnect (exponential backoff)
→ Reconnect → useAgentHydration: re-fetch session
→ CRASHED state DB'den geri yüklenmez (düzeltildi)
```

**Eksikler:**

| # | Sorun | Önem | Açıklama |
|---|-------|------|----------|
| S12.1 | Soft pause queue in-memory | KRİTİK | Agent pause durumundayken server çökerse, kuyrukta bekleyen event'ler kaybolur. DB'ye persist edilmiyor |
| S12.2 | Plan extraction data loss | YÜKSEK | `lastThinkingText` extraction denemesinden sonra temizleniyor. Başarısız extraction = kalıcı veri kaybı |
| S12.3 | WS reconnect sırasında event kaybı | ORTA | Bağlantı kopuk iken oluşan event'ler client'a hiç ulaşmaz. Reconnect sonrası sadece mevcut state hydrate edilir, eksik event'ler tamamlanmaz |
| S12.4 | Concurrent session koruması zayıf | ORTA | İki tarayıcı sekmesinden aynı agent'ı kontrol etmek mümkün. Lock mekanizması yok |

---

### Senaryo 13: Kullanıcı Her Şeyi Türkçe Görür

**Beklenti:** Tam Türkçe arayüz, hiçbir İngilizce string kalmasın

**Mevcut Durum:** %96.2 çeviri tamamlanmış

**Hardcoded İngilizce String'ler (15 adet):**

| Dosya | Satır | String | Önem |
|-------|-------|--------|------|
| PromptHistory.tsx | 281 | `Prompt History` | YÜKSEK |
| PromptHistory.tsx | 306 | `History` | YÜKSEK |
| PromptHistory.tsx | 325 | `Templates` | YÜKSEK |
| PromptHistory.tsx | 341 | `Search history...` | ORTA |
| PromptHistory.tsx | 355 | `No matching prompts found` | YÜKSEK |
| PromptHistory.tsx | 361 | `Prompts will appear here after...` | YÜKSEK |
| SettingsModal.tsx | 126 | `English` | YÜKSEK |
| SettingsModal.tsx | 178 | `IDE` / `GPS` / `Monitor` | ORTA |
| FloatingPanel.tsx | 176-192 | `Minimize/Maximize/Close` | ORTA |
| EditorToolbar.tsx | 48-97 | `Undo/Redo/DOM Tree/Diff View` | ORTA |
| SimulatorEmbed.tsx | 771 | `Agent Preview` | DÜŞÜK |
| FileNavigationMap.tsx | 1386 | `Prompt...` | ORTA |
| FileNavigationMap.tsx | 1517 | `What to do...` | ORTA |

---

## 3. MANTIK HATALARI

### MH-1: Phase Execution UI-Only (KRİTİK)
**Dosya:** `PhaseTracker.tsx` + `agentStore.ts`
**Sorun:** Kullanıcı bir phase'i "onayla" veya "reddet" tıkladığında sadece frontend state değişiyor. Server'a hiçbir mesaj gönderilmiyor. Agent bu karardan habersiz.
**Etki:** Kullanıcı phase'i reddetti sanıyor ama agent çalışmaya devam ediyor.

### MH-2: Injection Event'leri Hiç Emit Edilmiyor (KRİTİK)
**Dosya:** `packages/server/src/services/agent-runner.ts` (satır 413, 437)
**Sorun:** `AGENT_INJECTION_QUEUED` ve `AGENT_INJECTION_APPLIED` event'leri tanımlı, listener'lar var, ama server hiçbir zaman emit etmiyor.
**Etki:** Dashboard'da injection durumu her zaman stale. Gerçek zamanlı güncelleme çalışmıyor.

### MH-3: Breakpoint Hit → Agent Durmuyor (KRİTİK)
**Dosya:** `useAgentStream.ts`
**Sorun:** `AGENT_BREAKPOINT_HIT` event'i geldiğinde sadece output log'a yazılıyor. `api.agentStop()` çağrılmıyor.
**Etki:** Breakpoint koymanın pratik bir etkisi yok. Agent durmadan devam ediyor.

### MH-4: CSS Selector Çakışması (YÜKSEK)
**Dosya:** `LivePreviewFrame.tsx` (satır 76-77)
**Sorun:** `el.className.split(' ')` ile selector üretiliyor. Aynı class'a sahip birden fazla element varsa `querySelector()` ilkini seçer — yanlış element!
**Etki:** Kullanıcı bir elemente sağ tıklayıp stil değiştirince farklı bir element değişebilir.

### MH-5: Undo Stack Memory Leak (ORTA)
**Dosya:** `SimulatorEmbed.tsx`
**Sorun:** Undo/redo `useReducer` ile yönetiliyor ama past/future array'lerine limit yok. Uzun oturumlarda binlerce state birikir.
**Etki:** Uzun düzenleme oturumlarında tarayıcı belleği şişer.

### MH-6: Maximize Durumunda Dock Erişilemez (YÜKSEK)
**Dosya:** `WindowManager.tsx`
**Sorun:** Maximize edilen panel `zIndex: 99999` ile dock dahil her şeyi kaplar. Dock görünmez hale gelir.
**Etki:** Kullanıcı sıkışır — sadece Escape veya çift tık ile çıkabilir ama bunu bilmiyor.

### MH-7: Paused Event Queue Kalıcı Değil (YÜKSEK)
**Dosya:** `agent-runner.ts` (satır 804-810)
**Sorun:** Agent pause durumundayken event'ler in-memory queue'da tutuluyor. Server restart = veri kaybı.
**Etki:** Pause → server çökme → resume = eksik event'ler.

---

## 4. VERİ AKIŞI EKSİKLERİ

### Broadcast Listesinde Eksik Event'ler
`ws/handler.ts:144-156` broadcast konfigürasyonunda şu event'ler yok:

| Event | Tanımlı | Emit Ediliyor | Broadcast | Durum |
|-------|---------|---------------|-----------|-------|
| AGENT_INJECTION_QUEUED | ✅ | ❌ | ❌ | KRİTİK — hiç çalışmıyor |
| AGENT_INJECTION_APPLIED | ✅ | ❌ | ❌ | KRİTİK — hiç çalışmıyor |
| AGENT_BREAKPOINT_SET | ✅ | ✅ | ❌ | YÜKSEK — emit var ama broadcast yok |
| AGENT_BREAKPOINT_REMOVED | ✅ | ✅ | ❌ | YÜKSEK — emit var ama broadcast yok |
| AGENT_CHECKPOINT_SAVED | ✅ | ✅ | ❌ | ORTA — emit var ama broadcast yok |
| AGENT_REDIRECTED | ✅ | ✅ | ❌ | ORTA — emit var ama broadcast yok |

---

## 5. EKSİK ÖZELLİKLER (Vizyona Göre)

### Kategori: Canlı İzleme

| # | Özellik | Durum | Açıklama |
|---|---------|-------|----------|
| E1 | Dosya diff canlı gösterimi | YOK | Agent bir dosyayı değiştirdiğinde diff anında gösterilmiyor. Sadece breadcrumb'da `editDiff` alanı var ama render edilmiyor |
| E2 | Terminal çıktısı canlı stream | KISMI | Output paneli text chunk'ları gösteriyor ama ANSI renk desteği yok |
| E3 | Token kullanım grafiği | YOK | `setTokenUsage()` var ama zaman serisi grafiği yok. Sadece anlık rakamlar StatusBar'da |
| E4 | Agent hız metrikleri | YOK | Saniyede kaç token, ortalama dosya işleme süresi gibi metrikler yok |
| E5 | Dosya değişiklik özeti | KISMI | CompletionBanner'da dosya listesi var ama oturum sırasında canlı özet yok |

### Kategori: Mouse Kontrolü

| # | Özellik | Durum | Açıklama |
|---|---------|-------|----------|
| E6 | Drag-to-select (çoklu element) | YOK | iframe'de birden fazla elementi seçip toplu stil değişikliği yapılamaz |
| E7 | Element sürükleyerek taşıma | YOK | Sağ tık menüsünden position değiştirilebilir ama drag ile taşıma yok |
| E8 | Sağ tık → "AI'ya sor" | YOK | Element üstünde sağ tık → "Bu elementi iyileştir" gibi AI-powered seçenek yok |
| E9 | Hover inspector | KISMI | Mouse hover'da `outline: 1px dashed` gösteriliyor ama element bilgisi (tag, class, boyut) tooltip'te gösterilmiyor |
| E10 | Rulers ve guidelines | YOK | Drag sırasında hizalama çizgileri (snap guides) yok |

### Kategori: Premium Tasarım

| # | Özellik | Durum | Açıklama |
|---|---------|-------|----------|
| E11 | Tema geçiş animasyonu | YOK | Tema değişimi anında olur, crossfade veya morph animasyonu yok |
| E12 | Skeleton loading | KISMI | Bazı bileşenlerde Spinner var ama skeleton screen (shimmer placeholder) kullanılmıyor |
| E13 | Micro-interactions | KISMI | Buton hover efektleri var ama panel açılma, menü belirme gibi animasyonlar sert |
| E14 | Sound effects | YOK | Kritik event'lerde (agent tamamlandı, hata, breakpoint) ses efekti yok |
| E15 | Custom cursor | YOK | Drag, resize, pan modlarında özel cursor (grab, crosshair vb.) kullanılmıyor |

### Kategori: GitHub

| # | Özellik | Durum | Açıklama |
|---|---------|-------|----------|
| E16 | PR oluşturma | YOK | Agent değişikliklerinden otomatik PR oluşturma |
| E17 | Branch yönetimi | YOK | Branch oluşturma/değiştirme/silme |
| E18 | Commit geçmişi | YOK | Görsel commit timeline'ı |
| E19 | Code review | YOK | Agent değişikliklerini satır satır review etme |

---

## 6. ÖNCELİK MATRİSİ

### P0 — Acil (İşlevselliği Bozan)

| # | Sorun | Effort | Dosya |
|---|-------|--------|-------|
| MH-1 | Phase execution server bağlantısı yok | 8h | PhaseTracker + server routes + WS handler |
| MH-2 | Injection event'leri emit edilmiyor | 1h | agent-runner.ts (2 satır emit ekle) |
| MH-3 | Breakpoint hit agent'ı durdurmuyor | 2h | useAgentStream.ts + agent-runner.ts |
| S6.2 | Injection broadcast eksik | 30m | ws/handler.ts (1 array push) |

### P1 — Yüksek (Kullanıcı Deneyimi)

| # | Sorun | Effort | Dosya |
|---|-------|--------|-------|
| MH-4 | CSS selector çakışması | 3h | LivePreviewFrame.tsx (data-voltron-id ekle) |
| MH-6 | Maximize'da escape ipucu | 1h | FloatingPanel.tsx |
| S5.2 | GPS auto-follow modu | 2h | GPSNavigator.tsx + GPSCanvas.tsx |
| S2.4 | "Değişiklikler geçici" uyarısı | 30m | SimulatorEmbed.tsx |
| S2.6 | Context menu'de geri al butonu | 2h | DesignContextMenu.tsx |
| S10.1 | Breakpoint broadcast | 30m | ws/handler.ts |
| i18n | 15 hardcoded string | 2h | 5 dosya |

### P2 — Orta (İyileştirme)

| # | Sorun | Effort |
|---|-------|--------|
| MH-5 | Undo stack limit | 1h |
| MH-7 | Pause queue DB persist | 4h |
| S1.2 | Breadcrumb/output overflow uyarısı | 1h |
| S3.4 | Gönderim onay diyaloğu | 1h |
| S8.1 | Tema geçiş animasyonu | 2h |
| S9.2 | Context menu mobil uyum | 4h |
| S9.3 | GPS pinch-to-zoom | 3h |
| S11.1 | Panel snap-to-edge | 3h |
| S11.3 | Kullanıcı tanımlı preset | 2h |
| E1 | Dosya diff canlı gösterimi | 4h |
| E8 | Sağ tık "AI'ya sor" | 3h |
| E9 | Hover element inspector | 2h |

### P3 — Düşük (Gelecek Sürüm)

| # | Sorun | Effort |
|---|-------|--------|
| S8.3 | Light tema | 4h |
| E6 | Multi-select elements | 6h |
| E7 | Drag-to-move elements | 4h |
| E10 | Rulers ve snap guides | 6h |
| E14 | Sound effects | 2h |
| E15 | Custom cursors | 1h |
| E16-19 | GitHub PR/branch/review | 16h |

---

## 7. ÖZET SAYILAR

| Metrik | Değer |
|--------|-------|
| Toplam Senaryo | 13 |
| Tespit Edilen Sorun | 67 |
| Mantık Hatası | 7 |
| Eksik Özellik | 19 |
| Broadcast Eksik Event | 6 |
| Hardcoded İngilizce String | 15 |
| P0 (Acil) | 4 sorun |
| P1 (Yüksek) | 7 sorun |
| P2 (Orta) | 12 sorun |
| P3 (Düşük) | 7 sorun |
| Tahmini Toplam Effort (P0+P1) | ~22 saat |

---

## 8. SONUÇ

Voltron %82 tamamlanmış, mimari olarak sağlam bir platform. Ancak **kullanıcı vizyonundaki "her şeyi mouse ile kontrol" ve "premium otonom deneyim"** hedefine ulaşmak için:

1. **Önce P0 sorunları çözülmeli** — Phase execution, injection events, breakpoint hit, broadcast eksikleri. Bunlar temel işlevselliği bozuyor.

2. **Sonra P1 UX iyileştirmeleri** — Selector güvenliği, maximize escape ipucu, GPS auto-follow, i18n tamamlama.

3. **Son olarak P2-P3** — Mobil uyumluluk, gelişmiş GitHub, light tema, element drag, snap guides.

En kritik 4 sorun (P0) toplamda ~11.5 saat effort ile çözülebilir ve platformun güvenilirliğini ciddi oranda artırır.
