# Adım 8: @voltron/ui-simulator

## Amaç
Sandbox'lı UI preview ortamı. AI agent'ın ürettiği UI değişikliklerini izole iframe'de gösterir, CSS/layout düzenleme yapılabilir, bidirectional sync sağlar.

## Tech Stack
- React 19 + Vite 6
- Tailwind v4
- fast-json-patch (RFC 6902)
- Zustand v5

## Oluşturulan Dosyalar

### Sandbox
| Dosya | Amaç |
|-------|------|
| `src/sandbox/IframeSandbox.tsx` | Sandboxed iframe, CSP, postMessage |
| `src/sandbox/SandboxBridge.ts` | postMessage protocol manager, origin validation |
| `src/sandbox/InjectedScript.ts` | MutationObserver, ResizeObserver, click interception |

### Panels
| Dosya | Amaç |
|-------|------|
| `src/panels/CssPanel.tsx` | CSS property editor |
| `src/panels/ColorPicker.tsx` | HSL/HEX/RGB/Tailwind color picker |
| `src/panels/LayoutPanel.tsx` | Drag, resize, grid/flex inspector |
| `src/panels/PropEditor.tsx` | React prop auto-detection ve editing |
| `src/panels/ResponsivePanel.tsx` | Viewport presets (mobile/tablet/desktop) |

### Sync Engine
| Dosya | Amaç |
|-------|------|
| `src/sync/PatchEngine.ts` | fast-json-patch, RFC 6902 compliant |
| `src/sync/ConflictResolver.ts` | human_wins default strategy |
| `src/sync/StateTracker.ts` | State diff tracking |

### Stores
| Dosya | Amaç |
|-------|------|
| `src/stores/simulatorStore.ts` | Simulator global state |
| `src/stores/styleStore.ts` | Style editing state |
| `src/stores/historyStore.ts` | Undo/redo stack |

### Hooks
| Dosya | Amaç |
|-------|------|
| `src/hooks/useElementSelection.ts` | iframe içi element seçimi |
| `src/hooks/useStyleSync.ts` | Style değişikliklerini sync |
| `src/hooks/useUndoRedo.ts` | Ctrl+Z/Ctrl+Y |

## Iframe Sandbox
```html
<iframe sandbox="allow-scripts allow-same-origin" />
```
- CSP headers ile izole
- postMessage ile ana uygulamayla haberleşir
- InjectedScript iframe içine inject edilir

## Undo/Redo
- Her style değişikliği history stack'e eklenir
- Ctrl+Z = Undo, Ctrl+Shift+Z = Redo
- Max 100 adım

## Komutlar
```bash
pnpm --filter @voltron/ui-simulator build   # Production build → dist/
pnpm --filter @voltron/ui-simulator dev     # Vite dev server :5174
```
