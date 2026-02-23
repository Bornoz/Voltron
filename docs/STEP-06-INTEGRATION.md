# Adım 6: Interceptor ↔ Server Entegrasyonu

## Amaç
Interceptor ve Server arasındaki WebSocket köprüsünü kurarak tam pipeline'ı çalıştırmak.

## Pipeline
```
[AI Agent dosya yazar]
      ↓
[@voltron/interceptor]
  FileWatcher → HashTracker → ZoneGuard → DiffGenerator → SnapshotManager
      ↓
  ServerBridge (WS client, auto-reconnect, message queue)
      ↓ (WebSocket - ACTION_EVENT message)
[@voltron/server]
  WS Handler → Zod validation → ActionRepository.insert()
      ↓
  RiskEngine.classify() → risk level + reasons
      ↓
  StateMachine check → CRITICAL ise AUTO_STOP
      ↓
  Broadcaster → tüm dashboard/simulator client'larına broadcast
      ↓
[@voltron/dashboard]
  useEventStream hook → eventStore → ActionFeed render
```

## ServerBridge (bridge.ts)
- **Auto-reconnect**: Exponential backoff (1s → 2s → 4s → ... max 30s)
- **Message queue**: Server offline iken event'ler bellekte kuyrukta bekler (max 1000)
- **Heartbeat**: 30s interval ping, 10s pong timeout → reconnect
- **Command handling**: Server'dan gelen STOP/CONTINUE komutlarını interceptor'a iletir

## Doğrulama Testleri
1. Dosya oluştur → Dashboard'da event görünsün
2. Dosya sil → DELETE event, risk classification
3. .env dosyası oluştur → CRITICAL risk alert
4. Koruma zone'una yaz → ZONE_VIOLATION + BLOCK
5. 100 dosya/sn → Circuit breaker trip → AUTO_STOP
6. Server restart → Interceptor reconnect → Queue flush
7. STOP komutu → Interceptor watcher pause
8. CONTINUE → Watcher resume
