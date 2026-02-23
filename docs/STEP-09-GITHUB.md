# Adım 9: GitHub Entegrasyonu

## Amaç
Projelerin GitHub repo'larını analiz ederek bağımlılık grafiği, breaking change tespiti ve mimari uyumluluk kontrolü yapmak.

## Oluşturulan Dosyalar

| Dosya | Amaç |
|-------|------|
| `src/services/github-analyzer.ts` | Ana analiz servisi |
| `src/routes/github.ts` | REST API endpoints |
| `src/db/repositories/github-cache.ts` | Analiz sonuçlarını cache'leme (24h TTL) |

## Analiz Özellikleri

### 1. Dependency Analysis
- `package.json` parsing (dependencies + devDependencies)
- Versiyon conflict detection
- Outdated package detection
- Security vulnerability hints

### 2. Breaking Change Detection
- API signature değişiklikleri
- Type tanımı değişiklikleri
- Export kaldırma/yeniden adlandırma
- Behavioral değişiklikler (config format vb.)

### 3. Architecture Compliance
10 built-in kural:
- TypeScript strict mode zorunlu
- ESM-only (no CommonJS)
- Zod validation at boundaries
- No `any` type usage
- Error handling patterns
- Import structure rules
- Test coverage thresholds
- Documentation requirements
- Git commit message format
- Dependency pinning

## API Endpoints
```
POST /api/projects/:id/github/analyze   → Analiz başlat
GET  /api/projects/:id/github/deps      → Bağımlılık grafiği
GET  /api/projects/:id/github/breaking  → Breaking changes
GET  /api/projects/:id/github/compliance → Uyumluluk raporu
```

## Cache
- Analiz sonuçları SQLite'da cache'lenir
- 24 saat TTL
- Cache key: `{projectId}:{analysisType}:{repoUrl}`
