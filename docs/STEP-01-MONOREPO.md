# Adım 1: Monorepo Foundation

## Amaç
Tüm Voltron paketlerinin yaşayacağı monorepo altyapısını kurmak.

## Oluşturulan Dosyalar

| Dosya | Amaç |
|-------|------|
| `package.json` | Root workspace config, scripts, pnpm onlyBuiltDependencies |
| `pnpm-workspace.yaml` | `packages: ['packages/*']` - tüm paketleri workspace olarak tanımlar |
| `tsconfig.base.json` | Paylaşılan TS compiler seçenekleri (ES2022, Node16, strict) |
| `.gitignore` | node_modules, dist, *.db, .env, logs |
| `.npmrc` | pnpm config (shamefully-hoist=false, auto-install-peers=true) |
| `CLAUDE.md` | AI agent'ların bu projeyi anlaması için kontrol protokolü |
| `.env.example` | Environment variable template |
| `scripts/dev.sh` | Tüm dev server'ları paralel başlatır |
| `scripts/setup.sh` | İlk kurulum (corepack, pnpm install, .env) |
| `scripts/deploy.sh` | Production build + systemd restart |

## Yapı
```
/opt/voltron/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── .npmrc
├── .env.example
├── CLAUDE.md
├── scripts/
│   ├── dev.sh
│   ├── setup.sh
│   └── deploy.sh
├── data/              (runtime - SQLite DB)
└── packages/
    ├── shared/
    ├── interceptor/
    ├── server/
    ├── dashboard/
    └── ui-simulator/
```

## Komutlar
```bash
pnpm install     # Tüm bağımlılıkları kur
pnpm build       # Tüm paketleri derle
pnpm dev         # Dev ortamını başlat
pnpm typecheck   # Tip kontrolü
```
