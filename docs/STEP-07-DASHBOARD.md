# Adım 7: @voltron/dashboard

## Amaç
Mission Control operatör arayüzü. Gerçek zamanlı event izleme, kontrol paneli, dosya ağacı, diff viewer, zone yönetimi.

## Tech Stack
- React 19 + Vite 6
- Tailwind v4 (dark theme)
- Zustand v5 (state management)
- Recharts (grafikler)
- Lucide React (ikonlar)
- WebSocket (gerçek zamanlı)

## Oluşturulan Dosyalar

### Core
| Dosya | Amaç |
|-------|------|
| `src/main.tsx` | Entry point, createRoot |
| `src/App.tsx` | Ana bileşen - project selector, layout orchestration |
| `src/globals.css` | Tailwind imports, scrollbar styling |
| `index.html` | SPA shell |

### Library
| Dosya | Amaç |
|-------|------|
| `src/lib/api.ts` | REST client - tüm API endpoint'leri |
| `src/lib/ws.ts` | VoltronWebSocket - auto-reconnect, heartbeat |
| `src/lib/formatters.ts` | Zaman, boyut, risk level formatlama |
| `src/lib/node-stubs.ts` | Browser stubs for node:crypto, node:fs, node:path |

### Hooks
| Dosya | Amaç |
|-------|------|
| `src/hooks/useWebSocket.ts` | WS bağlantı yönetimi |
| `src/hooks/useEventStream.ts` | WS event'lerini store'lara yönlendirir |
| `src/hooks/useControl.ts` | STOP/CONTINUE/RESET API çağrıları |
| `src/hooks/useKeyboard.ts` | Ctrl+Shift+S = acil STOP |

### Stores (Zustand v5)
| Dosya | Amaç |
|-------|------|
| `src/stores/eventStore.ts` | Event listesi (max 5000), filtreleme |
| `src/stores/controlStore.ts` | Execution state, history |
| `src/stores/fileTreeStore.ts` | Dosya ağacı, değişiklik tracking |
| `src/stores/zoneStore.ts` | Protection zone listesi |
| `src/stores/notificationStore.ts` | Toast notification sistemi |

### Components
| Klasör | Amaç |
|--------|------|
| `components/Layout/` | MainLayout (3-column), Header, Sidebar |
| `components/ActionFeed/` | Live event stream, filterable, expandable |
| `components/FileTree/` | Real-time dosya ağacı, renk kodlu, heat map |
| `components/DiffViewer/` | Side-by-side diff, syntax highlight |
| `components/ControlPanel/` | ExecutionControls (STOP/CONTINUE/RESET), RiskGauge |
| `components/ZoneManager/` | Zone CRUD, pattern tester |
| `components/Stats/` | Recharts grafikleri |
| `components/common/` | Badge, Button, Card, EmptyState, Spinner |

## Layout
```
┌─────────────┬────────────────────────┬──────────────┐
│  Sidebar    │     Center Content     │  Right Panel │
│  - FileTree │     - Project Bar      │  - Controls  │
│  - Zones    │     - ActionFeed       │  - RiskGauge │
│             │                        │  - Stats     │
└─────────────┴────────────────────────┴──────────────┘
```

## Keyboard Shortcuts
- `Ctrl+Shift+S` → Emergency STOP (tüm agent'ları durdur)

## Komutlar
```bash
pnpm --filter @voltron/dashboard build   # Production build → dist/
pnpm --filter @voltron/dashboard dev     # Vite dev server :5173
```
