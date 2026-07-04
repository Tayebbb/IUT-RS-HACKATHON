# API Reference

Base URL: `http://localhost:4000`

All responses are JSON. Errors use `{ "error": "<code>" }` with an appropriate
HTTP status.

---

## REST

### `GET /api/health`

Liveness probe.

```json
{ "status": "ok", "uptime": 12.34 }
```

### `GET /api/devices`

Returns all 15 devices.

```json
{
  "devices": [
    {
      "id": "drawing-room-fan-1",
      "label": "Fan 1",
      "type": "fan",
      "room": "drawing-room",
      "status": "off",
      "wattage": 60,
      "power": 0,
      "lastChanged": "2026-07-04T09:00:00.000Z"
    }
  ]
}
```

### `GET /api/devices/:id`

Single device or `404 device_not_found`.

### `GET /api/rooms`

```json
{
  "rooms": [
    {
      "id": "drawing-room",
      "name": "Drawing Room",
      "devices": [/* Device[] */],
      "totalDevices": 5,
      "onCount": 2,
      "offCount": 3,
      "powerWatts": 90,
      "allOn": false
    }
  ]
}
```

### `GET /api/rooms/:id`

Single room summary or `404 room_not_found`.

### `GET /api/usage`

```json
{
  "usage": {
    "timestamp": 1720086400000,
    "currentPowerWatts": 210,
    "powerByRoom": { "drawing-room": 60, "work-room-1": 90, "work-room-2": 60 },
    "powerByType": { "fan": 120, "light": 90 },
    "highestConsumingRoom": {
      "roomId": "work-room-1",
      "name": "Work Room 1",
      "watts": 90
    },
    "energyTodayWh": 342.7,
    "energyTodayKwh": 0.343,
    "samples": [{ "timestamp": 1720086395000, "powerWatts": 200 }]
  }
}
```

### `GET /api/alerts?status=all|active`

Default `all`. Returns `{ "alerts": Alert[] }`.

### `GET /api/incidents?status=all|active`

Default `all`. Returns `{ "incidents": Incident[] }`.

---

## Socket.IO

Connect to `ws://localhost:4000` (`socket.io-client`). On connection the server
pushes a full snapshot of every stream. Thereafter, updates are pushed when
state changes.

| Event              | Payload         |
| ------------------ | --------------- |
| `devices:update`   | `Device[]`      |
| `rooms:update`     | `RoomSummary[]` |
| `usage:update`     | `UsageSnapshot` |
| `alerts:update`    | `Alert[]`       |
| `incidents:update` | `Incident[]`    |

The dashboard therefore **never needs a manual refresh**.

---

## Types (JSDoc)

- `Device` — `backend/src/store/deviceStore.js`
- `RoomSummary` — `backend/src/services/roomService.js`
- `UsageSnapshot` — `backend/src/services/usageService.js`
- `Alert` — `backend/src/alerts/alertStore.js`
- `Incident` — `backend/src/incidents/incidentAggregator.js`
