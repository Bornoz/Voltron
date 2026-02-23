# Adım 5: Server WS + State Machine + Risk Engine

## Amaç
Server'ın beyin katmanı: WebSocket hub, XState v5 state machine, 14 kurallı risk engine ve circuit breaker.

## Oluşturulan Dosyalar

| Dosya | Amaç |
|-------|------|
| `src/ws/broadcaster.ts` | Client pool yönetimi (interceptor/dashboard/simulator), dead client cleanup, broadcast |
| `src/ws/replayer.ts` | Reconnect'te kaçırılan event'leri replay |
| `src/ws/handler.ts` | WS lifecycle: registration, auth, message routing, ACTION_EVENT processing |
| `src/services/state-machine.ts` | XState v5 state machine + StateMachineService (DB persistence, crash recovery) |
| `src/services/risk-engine.ts` | 14 built-in risk kuralı, custom rules, auto-stop |
| `src/services/rate-monitor.ts` | CircuitBreaker sınıfı |
| `src/routes/control.ts` | STOP/CONTINUE/RESET API endpoints |

## State Machine (XState v5)
```
IDLE ──start──→ RUNNING ──stop──→ STOPPED ──continue──→ RESUMING ──resume_complete──→ RUNNING
                    │                                        │
                    └──error──→ ERROR ──reset──→ IDLE ←──reset──┘
```

Her state geçişi:
1. XState actor'e event gönderilir
2. Yeni state SQLite'a persist edilir
3. state_history tablosuna append edilir
4. WS ile tüm dashboard client'larına broadcast edilir

## Risk Engine (14 Kural)
| # | Kural | Risk Level |
|---|-------|-----------|
| 1 | Protection zone violation | CRITICAL |
| 2 | Destructive operations (rm -rf, DROP TABLE vb.) | CRITICAL |
| 3 | Config files (.env, .npmrc, nginx.conf) | HIGH |
| 4 | Schema/migration files | HIGH |
| 5 | Security files (SSL certs, keys) | CRITICAL |
| 6 | Large file changes (>10KB diff) | MEDIUM |
| 7 | Cascade detection (5+ dosya/10sn) | HIGH |
| 8 | API contract changes | MEDIUM |
| 9 | Test file deletion | MEDIUM |
| 10 | Binary files | LOW |
| 11 | Self-protection (Voltron files) | CRITICAL |
| 12 | Rate anomaly | HIGH |
| 13 | Hidden files (.git, .ssh) | HIGH |
| 14 | Package manager files (package.json, lock files) | MEDIUM |

## Circuit Breaker
- 50+ event/saniye → OTOMATİK DURDURMA
- Sliding window (10 saniye)
- Recovery: Manuel reset veya timeout

## WebSocket Protocol
- Client registration: `{ type: 'CLIENT_REGISTER', payload: { clientType, projectId, token? } }`
- Heartbeat: 30s interval, 10s timeout
- Replay: Reconnect'te `lastEventId` ile kaçırılan event'ler gönderilir
- Pool'lar: interceptor, dashboard, simulator ayrı yönetilir
