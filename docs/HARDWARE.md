# Hardware Documentation

> **Note:** The reference implementation ships with a **software simulator**.
> This document describes how the exact same backend + dashboard + Discord bot
> would talk to real hardware in a production deployment. Nothing in the
> frontend, REST API, Socket.IO layer, or Discord bot needs to change — only the
> `simulator/` module is swapped for a hardware bridge.

---

## 1. Bill of Materials (per room)

| Qty | Item                                               | Purpose                                 | Notes                                      |
| --: | -------------------------------------------------- | --------------------------------------- | ------------------------------------------ |
|   6 | Sonoff BASICR4 / Shelly Plus 1PM (10A)             | Individually switch + meter each device | 1 per fan, 1 per light                     |
|   5 | CT clamp (SCT-013-030, 30A) _or_ built-in metering | Measure real-time current draw          | Only needed if the relay lacks metering    |
|   1 | ESP32 DevKit v1                                    | Room-level aggregator / relay bridge    | Optional if all relays speak MQTT natively |
|   1 | 5V/2A PSU                                          | Powers the ESP32                        | —                                          |
|   1 | Wi-Fi AP with 2.4 GHz                              | Network for all IoT nodes               | Isolated VLAN recommended                  |

**Total for the office (3 rooms):** 18 smart relays with metering, 3 optional
ESP32 aggregators.

---

## 2. Reference Wiring

Each fan / light is wired _through_ a smart metering relay in series with its
existing switch:

```
        Live ─┬───────────┐
              │           │
              │      ┌────┴────┐
              │      │ Relay + │
              │      │  Meter  │  ── Wi-Fi ── MQTT broker ── Backend
              │      │ (Sonoff │
              │      │ /Shelly)│
              │      └────┬────┘
              │           │
              └───────────┴──── Fan / Light  ─── Neutral
```

**Safety**

- All mains wiring must be done by a licensed electrician.
- Neutral must be shared between the relay and the load.
- Use a certified in-line 6A / 10A fuse per branch circuit.
- Keep the low-voltage MCU / sensor side galvanically isolated from mains.

---

## 3. Transport & Protocols

| Layer        | Choice                                                 | Rationale                                      |
| ------------ | ------------------------------------------------------ | ---------------------------------------------- |
| Physical     | Wi-Fi 2.4 GHz                                          | Ubiquitous; Sonoff/Shelly/ESP32 all support it |
| Messaging    | MQTT (v3.1.1) over TLS                                 | Lightweight, pub/sub, well-supported           |
| Broker       | Mosquitto 2.x                                          | FOSS, simple, low resource                     |
| Topic scheme | `office/{roomId}/{deviceId}/state` and `.../telemetry` | Human-readable, easy to ACL                    |
| Payload      | JSON                                                   | Matches the internal `Device` shape            |

Example MQTT payloads:

`office/work-room-1/work-room-1-fan-1/state`

```json
{ "status": "on", "ts": "2026-07-04T09:12:33.501Z" }
```

`office/work-room-1/work-room-1-fan-1/telemetry`

```json
{
  "power": 61.4,
  "voltage": 231.2,
  "current": 0.266,
  "ts": "2026-07-04T09:12:38.001Z"
}
```

---

## 4. Backend Bridge (replaces the simulator)

The backend exposes a tiny contract: **anything that calls
`deviceStore.applyBatch([...])` at a reasonable cadence works**. A production
`HardwareBridge` therefore lives in `backend/src/hardware/` (added on
deployment) and looks like this:

```js
// backend/src/hardware/mqttBridge.js  (deployment-only)
const mqtt = require('mqtt');

class MqttBridge {
  constructor({ deviceStore, url, username, password }) {
    this._store = deviceStore;
    this._client = mqtt.connect(url, { username, password });
  }
  start() {
    this._client.on('connect', () => {
      this._client.subscribe('office/+/+/state');
      this._client.subscribe('office/+/+/telemetry');
    });
    this._client.on('message', (topic, buf) => {
      const [, , deviceId, kind] = topic.split('/');
      const payload = JSON.parse(buf.toString());
      if (kind === 'state') {
        this._store.applyBatch([{ id: deviceId, status: payload.status }]);
      }
      // telemetry payloads can update measured `power` field similarly
    });
  }
}
```

Swap the `Simulator` instantiation in `backend/src/server.js` for
`new MqttBridge({ deviceStore, url: process.env.MQTT_URL, ... })` and the rest
of the system (alerts, incidents, REST, Socket.IO, Discord) keeps working
unchanged. **This is by design — the simulator was built to the same interface
hardware would use.**

---

## 5. Calibration

If you rely on metering relays' built-in figures:

1. Turn one device ON.
2. Read the reported wattage over a 60-second window.
3. Compare against a plug-in reference meter (e.g. Kill A Watt).
4. Apply the correction factor in `backend/src/config/devices.js` by overriding
   the `wattage` per device id.

For CT-clamp based setups on an ESP32, calibrate `ICAL` and `VCAL` per the
[EmonLib](https://github.com/openenergymonitor/EmonLib) instructions before
publishing to MQTT.

---

## 6. Network Topology

```
   +----------------+       Wi-Fi (IoT VLAN)      +----------------------+
   | 18 metering    | -------------------------> | Mosquitto MQTT broker |
   | relays         |                            +----------+------------+
   +----------------+                                       |
                                                            v
                                              +-------------+------------+
                                              | Backend (Node.js)        |
                                              |  - MqttBridge            |
                                              |  - DeviceStore (SSoT)    |
                                              |  - AlertEngine           |
                                              |  - IncidentAggregator    |
                                              |  - REST + Socket.IO      |
                                              +------+---------+---------+
                                                     |         |
                                          Socket.IO  |         | HTTP
                                                     v         v
                                          +----------+--+ +----+----------+
                                          | React        | | Discord bot  |
                                          | Dashboard    | | (discord.js) |
                                          +--------------+ +--------------+
```

---

## 7. Failure Modes & Handling

| Failure         | Detection                   | Response                                                    |
| --------------- | --------------------------- | ----------------------------------------------------------- |
| Relay offline   | No MQTT message for >30s    | Mark device `stale`; alert engine ignores stale devices     |
| Broker down     | MQTT client disconnect      | Backend auto-reconnects; devices freeze at last known state |
| Backend restart | Socket.IO disconnect        | Dashboard reconnects; server re-emits full snapshots        |
| Discord outage  | REST 5xx or gateway timeout | Bot logs and retries; alert relay resumes on reconnect      |

The dashboard and bot **never** hold state that isn't derivable from the
backend, so a single restart of the backend restores the whole system.
