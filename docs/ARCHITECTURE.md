# Architecture

## Guiding principles

- **Single source of truth.** The backend owns `DeviceStore` + `EnergyStore` +
  `AlertStore`. Dashboard and Discord bot are pure read models.
- **Feature-based folders.** Each module (`store`, `simulator`, `services`,
  `alerts`, `incidents`, `routes`, `sockets`) is independently composable and
  unit-testable.
- **Dependency injection.** Every engine / router receives its collaborators via
  its constructor. No hidden globals in features.
- **Event-driven.** Stores emit events; engines subscribe. This lets us swap the
  simulator for real hardware with zero changes downstream.

## Layered view

```
┌──────────────────────────── Backend ─────────────────────────────┐
│                                                                  │
│  Simulator (or MqttBridge in prod)                               │
│      │                                                           │
│      ▼                                                           │
│  DeviceStore ──emits─▶ AlertEngine ──emits─▶ IncidentAggregator  │
│      │                     │                       │             │
│      │                     │                       │             │
│      └──────┬──────────────┴──────────┬────────────┘             │
│             ▼                         ▼                          │
│         SocketBroadcaster        REST Routes                     │
│             │                         │                          │
└─────────────┼─────────────────────────┼──────────────────────────┘
              │                         │
        Socket.IO                    HTTP
              │                         │
      ┌───────┴────────┐        ┌───────┴────────┐
      │ React Dashboard │        │ Discord Bot   │
      │  (Vite/Tailwind │        │ (discord.js)  │
      │   Framer Motion)│        │ + AlertRelay  │
      └────────────────┘        └────────────────┘
```

## Event bus

| Producer                   | Event                                                                                 | Payload                    |
| -------------------------- | ------------------------------------------------------------------------------------- | -------------------------- |
| `DeviceStore`              | `device:changed`                                                                      | `DeviceChange`             |
| `DeviceStore`              | `devices:changed`                                                                     | `Device[]`                 |
| `AlertStore`               | `alert:opened` / `alert:updated` / `alert:resolved`                                   | `Alert`                    |
| `AlertStore`               | `alerts:changed`                                                                      | `Alert[]`                  |
| `IncidentAggregator`       | `incident:opened` / `:updated` / `:resolved`                                          | `Incident`                 |
| `IncidentAggregator`       | `incidents:changed`                                                                   | `Incident[]`               |
| `SocketBroadcaster` → `io` | `devices:update`, `rooms:update`, `usage:update`, `alerts:update`, `incidents:update` | matching arrays / snapshot |

## Startup ordering

`backend/src/server.js` composes the graph so **subscribers are always
registered before producers start**:

1. Instantiate stores (pure state, no timers).
2. Instantiate engines (`AlertEngine`, `IncidentAggregator`).
3. Instantiate broadcaster (subscribes to all stores + `io`).
4. Register REST routes.
5. Start incident aggregator → alert engine → broadcaster.
6. **Start the simulator last** so its first tick is delivered to every
   subscriber.

## Data flow of a device flip

```
Simulator tick (5s)
   └▶ deviceStore.applyBatch([{id, status}])
        ├▶ 'device:changed'  ──▶ AlertEngine.evaluate()
        │                          └▶ AlertStore.upsert / resolveMissing
        │                                └▶ 'alerts:changed'
        │                                     ├▶ IncidentAggregator.evaluate()
        │                                     │     └▶ 'incidents:changed'
        │                                     │          └▶ io.emit('incidents:update')
        │                                     └▶ io.emit('alerts:update')
        └▶ 'devices:changed' ──▶ SocketBroadcaster
                                    ├▶ energyStore.record(totalPower)
                                    ├▶ io.emit('devices:update')
                                    ├▶ io.emit('rooms:update')
                                    └▶ io.emit('usage:update')
```

## Swapping the simulator for hardware

See [HARDWARE.md](HARDWARE.md). A production `MqttBridge` calls the exact same
`deviceStore.applyBatch(...)` API — nothing else changes.
