# Adım 10: Nginx + SSL + Deployment

## Amaç
Production deployment: nginx reverse proxy, SSL sertifikası, systemd service, authentication.

## Oluşturulan/Düzenlenen Dosyalar

| Dosya | Amaç |
|-------|------|
| `/etc/nginx/sites-available/voltron.isgai.tr` | Nginx config |
| `/etc/nginx/sites-enabled/voltron.isgai.tr` | Symlink |
| `/etc/systemd/system/voltron.service` | systemd unit |
| `/etc/nginx/.voltron_htpasswd` | HTTP Basic Auth credentials |
| `/etc/letsencrypt/live/voltron.isgai.tr/` | SSL sertifikası (certbot) |

## Nginx Config Detayları

### Routing
| Path | Target | Auth |
|------|--------|------|
| `/` | Dashboard SPA (`packages/dashboard/dist/`) | Basic Auth |
| `/api/*` | Fastify backend (proxy :3099) | Basic Auth |
| `/ws` | WebSocket upgrade (proxy :3099) | NO (token ile korunur) |
| `/simulator/` | UI Simulator (`packages/ui-simulator/dist/`) | Basic Auth |
| `/health` | Static 200 JSON | NO (monitoring) |
| `/api/health` | Fastify health endpoint | NO (monitoring) |

### Güvenlik
- HTTP → HTTPS redirect (301)
- TLS 1.2 + 1.3
- HSTS (2 yıl)
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Gzip compression
- **HTTP Basic Auth**: Tüm dashboard/API/simulator korumalı
- Health endpoint'ler auth bypass (monitoring için)
- WS endpoint auth bypass (interceptor token ile korunur)

### SSL
- certbot ile Let's Encrypt sertifikası
- Auto-renewal: `certbot renew` (cron)
- Sertifika: `/etc/letsencrypt/live/voltron.isgai.tr/`

## systemd Service
```ini
[Service]
Type=simple
User=root
WorkingDirectory=/opt/voltron
ExecStart=/usr/bin/node /opt/voltron/packages/server/dist/index.js
Restart=on-failure
RestartSec=5
MemoryMax=1G
LimitNOFILE=65536
```

## Authentication
- **Kullanıcı**: voltron
- **Yöntem**: HTTP Basic Auth (nginx seviyesinde)
- **Dosya**: `/etc/nginx/.voltron_htpasswd`
- Health ve WS endpoint'leri hariç tüm erişim korumalı

## Erişim
- Dashboard: `https://voltron.isgai.tr/` (auth gerekir)
- API: `https://voltron.isgai.tr/api/` (auth gerekir)
- Simulator: `https://voltron.isgai.tr/simulator/` (auth gerekir)
- WebSocket: `wss://voltron.isgai.tr/ws` (token auth)
- Health: `https://voltron.isgai.tr/health` (public)

## Deploy Script
```bash
pnpm build                           # Tüm paketleri derle
systemctl restart voltron             # Server restart
# nginx zaten static dosyaları servis ediyor, reload gerekmez
```

## DİKKAT
- nginx'te 7 mevcut site var (aegis, egitim, eimza, kayit, livekit, risk, satis)
- nginx -t ile HER değişiklik öncesi test yapılmalı
- Mevcut siteler ASLA bozulmamalı
