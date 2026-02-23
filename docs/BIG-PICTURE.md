# Voltron - AI Operation Control Center

## Ne?
Voltron, dünyanın ilk **AI Agent Governance Platform**'u. AI kodlama ajanlarını (Claude Code, Cursor, Copilot, Devin vb.) gerçek zamanlı olarak izleyen, kontrol eden, koruyan ve denetleyen agent-agnostic bir meta-kontrol katmanı.

Bu sıradan bir web uygulaması DEĞİL - bu, AI coding agent'larının **NASA Mission Control**'ü.

## Neden?
AI coding agent'ları güçlü ama kontrolsüz. Bir agent:
- Yanlış dosyayı silebilir
- .env dosyasını commit'leyebilir
- Production config'ini bozabilir
- Sonsuz döngüye girip yüzlerce dosya oluşturabilir
- Kendi kontrol sistemini devre dışı bırakabilir

Voltron tüm bu senaryoları önler.

## Nasıl Çalışır?

```
[AI Agent] → dosya yazar
      ↓
[@voltron/interceptor] → yakalar, hash'ler, diff oluşturur, snapshot alır
      ↓ (WebSocket)
[@voltron/server] → risk analizi, state machine, DB'ye kaydeder
      ↓ (WebSocket)
[@voltron/dashboard] → operatör gerçek zamanlı izler
      ↓
[Operatör] → STOP/CONTINUE/RESET kontrolü
```

## 5 Katmanlı Mimari

| Katman | Paket | Amaç |
|--------|-------|------|
| Layer 1 | `@voltron/interceptor` | Dosya sistemi izleme, hash, diff, snapshot, zone guard |
| Layer 2 | `@voltron/server` | Merkezi beyin - API, WS hub, state machine, risk engine, DB |
| Layer 3 | `@voltron/dashboard` | Gerçek zamanlı izleme ve kontrol UI |
| Layer 4 | `@voltron/ui-simulator` | Sandbox'lı UI preview, bidirectional sync |
| Shared | `@voltron/shared` | Ortak tipler, şemalar, sabitler |

## Kritik Özellikler

### Risk Engine (14 Kural)
Her AI aksiyonu risk seviyesine göre sınıflandırılır:
- **NONE** → Sadece logla
- **LOW** → Logla + göster
- **MEDIUM** → Logla + vurgula
- **HIGH** → Logla + alarm + review gerektirir
- **CRITICAL** → Logla + alarm + **OTOMATİK DURDUR**

### State Machine (XState v5)
```
IDLE → RUNNING → STOPPED → RESUMING → RUNNING
                    ↑
              ERROR ←→ (recovery)
```

### Protection Zones
- **DO_NOT_TOUCH**: Mutlak koruma (nginx, SSL, Voltron kendisi)
- **SURGICAL_ONLY**: Sadece belirli operasyonlara izin

### Circuit Breaker
50+ event/saniye = otomatik durdurma (AI çılgına dönmüş)

## Tech Stack
- **Backend**: Fastify v5, better-sqlite3, XState v5, picomatch
- **Frontend**: React 19, Vite 6, Tailwind v4, Zustand v5, Recharts
- **Real-time**: WebSocket (@fastify/websocket)
- **Validation**: Zod (tüm giriş noktalarında)
- **Monorepo**: pnpm workspaces
- **Lang**: TypeScript (ESM throughout)

## Portlar
| Servis | Port | Protokol |
|--------|------|----------|
| Server (API + WS) | 3099 | HTTP + WS |
| Dashboard (dev) | 5173 | HTTP |
| Simulator (dev) | 5174 | HTTP |
| Production | 443 | HTTPS (nginx) |

## URL'ler
- Dashboard: `https://voltron.isgai.tr`
- Simulator: `https://voltron.isgai.tr/simulator/`
- API: `https://voltron.isgai.tr/api/`
- WebSocket: `wss://voltron.isgai.tr/ws`
- Health: `https://voltron.isgai.tr/api/health`
