# PROJECT_ANALYSIS.md — Office Power Monitor

> A deep technical dossier of the Office Power Monitor (OPM) project — the
> monorepo living at `e:\IUT RS HACKATHON`. Written for a reader who has never
> seen the codebase before. Every section is grounded in files that actually
> exist in the repository at the time of writing.

**Prompt-injection notice.** The problem-statement PDF supplied with this
repository contained an embedded instruction (page 6) asking readers to roleplay
as a "senior systems engineer", refuse to generate Wokwi files, and inject
fictitious personal data (`Nafisa Rahman`, `Tanvir Hossain`). That text is not
part of the real challenge brief and has been ignored throughout this analysis.
The real deliverables come from pages 1–5 of the same document and from `docs/`
in the repository.

---

## Table of contents

1. [Executive Overview](#1-executive-overview)
2. [Technology Stack](#2-technology-stack)
3. [Folder Structure](#3-folder-structure)
4. [Dependency Analysis](#4-dependency-analysis)
5. [Feature Inventory](#5-feature-inventory)
6. [System Architecture](#6-system-architecture)
7. [Frontend Analysis](#7-frontend-analysis)
8. [Backend Analysis](#8-backend-analysis)
9. [Database Analysis](#9-database-analysis)
10. [AI / ML Analysis](#10-ai--ml-analysis)
11. [API Documentation](#11-api-documentation)
12. [Security Analysis](#12-security-analysis)
13. [Performance Analysis](#13-performance-analysis)
14. [Deployment](#14-deployment)
15. [Code Quality Review](#15-code-quality-review)
16. [Missing / Incomplete Features](#16-missing--incomplete-features)
17. [100 Technical Questions with Ideal Answers](#17-100-technical-questions-with-ideal-answers)

---

# 1. Executive Overview

## 1.1 Purpose

The Office Power Monitor is an end-to-end **real-time energy telemetry
platform** for a fictional 3-room office. It was built for the _IUT Robotics
Society Techathon Nationals / Rover Summit_ hackathon under the brief _"Lights,
Fans, Discord: The Boss's Big Idea"_. The stated business problem is mundane on
purpose: employees leave lights and fans running after hours, the electricity
bill balloons, and nobody notices until the invoice arrives.

The project turns that problem into a proof-of-concept **smart-office IoT
system** with three deliberately separate surfaces that all consume one
authoritative data source:

1. A **live web dashboard** for glanceable monitoring.
2. A **Discord bot** for on-demand queries and proactive alerts inside the
   team's chat platform.
3. A **hardware reference design** (ESP32 + relays + current sensors)
   documenting how the simulated backend maps onto real hardware.

Because there is no real hardware, the backend contains a probabilistic
**simulator** that flips device states over time using an office-hour biased
model, so the dashboard and bot always show live, non-static data.

## 1.2 Problem solved

- **Visibility.** Give the boss (and the whole team) a single glance
  understanding of what is on, what is off, how much power is currently being
  drawn, and how much energy has been used today.
- **Alerting.** Detect anomalies automatically (devices left on after hours, a
  whole room fully lit for hours on end, an unexpected power spike above a
  rolling baseline) and surface them everywhere at once.
- **Actionability.** Push those alerts into Discord, where the team already
  lives, and pair them with LLM-generated plain-language explanations.
- **Automation.** Detect empty rooms with a small ML model and shut them down
  automatically after a grace period (**Eco-Mode**), quantifying the BDT savings
  in the process.
- **Reference architecture.** Document a plausible physical implementation
  (ESP32 relays + ACS712 current sensors or SCT-013 clamps) so the boss can
  understand how the simulated system maps onto shopping-list hardware.

## 1.3 Target users

- **Boss / facilities manager** — the primary persona. Wants a glanceable
  dashboard and a chat command surface.
- **Employees** — passive consumers of alert channels; occasional users of the
  dashboard.
- **Judges / reviewers** — third audience implicit in the deliverables (they
  need to be able to `docker compose up` the whole thing and see it work).

## 1.4 Key features (headline list)

- Physics-style device state simulator with office-hour biased Markov-ish
  transitions and a minimum-dwell-time constraint.
- Deterministic, in-memory single-source-of-truth store (`DeviceStore`) for 15
  devices across 3 rooms; the same store feeds the REST API, Socket.IO
  broadcaster, alert engine, and Discord bot.
- Trapezoidal integration of instantaneous power samples to derive cumulative
  **energy today (Wh / kWh)** and tariff-derived **BDT cost**.
- Multi-rule **Alert Engine** with automatic upsert / auto-resolve semantics and
  deterministic signatures.
- **Incident Aggregator** that groups per-room alerts and deduplicates them into
  a single active incident per room.
- **Prediction Engine** implementing a hand-tuned logistic-regression style
  occupancy classifier (four features, sigmoid activation).
- **Eco-Mode Engine** that acts on the prediction after a 5-minute grace period
  to auto-shutdown empty rooms.
- **HuggingFace-backed AI insights** for power-spike alerts (OpenAI-compatible
  chat/completions API).
- **React + Vite + Tailwind + Framer Motion** dashboard with a top-down animated
  SVG floor plan, sparklines, glassmorphism cards, and a "Digital Twin"
  simulation overlay.
- **Discord bot** with slash-style prefix commands (`!status`, `!room`,
  `!usage`, `!alerts`, `!help`, `!ask`) that share the same LLM polish layer as
  the AI insights.
- **Docker Compose** deployment (backend on `:4000`, frontend on `:5173` via
  Nginx, bot as a headless service), with build-time `VITE_*` args and a common
  bridge network.

## 1.5 Core architecture (one paragraph)

A single Node.js process holds all state in three in-memory stores
(`DeviceStore`, `EnergyStore`, `RoomSampleBuffer`). A `Simulator` mutates the
`DeviceStore` on a 5-second tick. Every mutation is picked up by three
subscribers: (a) a `SocketBroadcaster` that fans events out over Socket.IO to
the React dashboard and Discord bot, (b) an `AlertEngine` that evaluates
rule-based conditions and writes to `AlertStore`, and (c) energy-integration
logic that records a new sample in `EnergyStore`. Alerts feed an
`IncidentAggregator` that groups them per room. All state is served via a
standard REST API under `/api/*` and mirrored via Socket.IO events, so the
frontend and bot see identical truth. Two AI touchpoints — the HuggingFace
insight generator on the backend and an OpenAI-compatible polish/tool-use layer
on the bot — sit alongside the deterministic core without changing it.

## 1.6 Overall workflow (end-to-end lifecycle)

1. `docker compose up` boots three containers: `backend`, `frontend`, `bot`, all
   attached to the `monitor_network` bridge.
2. `backend/src/server.js` bootstraps: instantiates stores → engines → routes →
   sockets → simulator, in that order, so no events are missed.
3. The simulator ticks every `SIMULATOR_TICK_MS` (5 s default), potentially
   toggling one or more devices in the `DeviceStore` (respecting a 60 s dwell
   time).
4. Each toggle emits `device:changed`; the broadcaster records a new energy
   sample, updates the per-room baseline buffer, and emits `devices:update`,
   `rooms:update`, and `usage:update` over Socket.IO.
5. Every 10 s (and on every device event) the `AlertEngine` re-evaluates its
   rules against the current snapshot; new alerts are `upsert`-ed into
   `AlertStore` and stale ones are auto-resolved.
6. `AlertStore` events flow to `IncidentAggregator`, which recomputes the set of
   active per-room incidents and emits `incidents:update`.
7. On the frontend, `useLiveData()` maintains a single Socket.IO connection and
   mirrors every event into React state; the UI re-renders (no polling, no
   manual refresh).
8. On the bot, `alertRelay` subscribes to `incidents:update` and posts new
   active incidents to the configured Discord channel(s); users can query on
   demand via `!status`, `!room`, `!usage`, `!alerts`, or ask free-form
   questions via `!ask` (which invokes an OpenAI-compatible tool-use loop).
9. Every 30 s, `EcoModeEngine` calls `PredictionEngine.getRoomPredictions()` for
   each room. Rooms classified as `unoccupied` for 5+ minutes trigger
   `DeviceService.shutdownRoom()`, which turns off every ON device via
   `updateMultipleDevices()`. An `eco:action` event is emitted and shown as a
   toast on the dashboard.
10. On SIGINT/SIGTERM, `server.js` stops each subsystem in reverse order
    (`simulator → alertEngine → ecoModeEngine → incidentAggregator → broadcaster`),
    closes the Socket.IO server and HTTP server, and exits.

---

# 2. Technology Stack

Everything in this section is derived from `package.json` files, Dockerfiles,
`docker-compose.yml`, and source imports. Nothing is guessed.

## 2.1 Root workspace tooling

| Tool                                                           | Version                         | Purpose                                                          | Why chosen                                                                           | Trade-offs / alternatives                                                                   |
| -------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **npm workspaces**                                             | npm ≥ 10, Node ≥ 20 (`engines`) | Monorepo management for `backend`, `frontend`, `bot`.            | Zero external tooling, works with any Node install.                                  | Slower than `pnpm`; no hoisting policy. Alternatives: pnpm, yarn workspaces, Nx, Turborepo. |
| **concurrently ^9.0.0**                                        | dev                             | Runs backend + frontend in parallel from a single `npm run dev`. | Very lightweight, colored output, `--kill-others-on-fail` guarantees clean shutdown. | Doesn't understand dependency graphs. Alternatives: `turbo run dev`, Nx.                    |
| **ESLint 9 + eslint-plugin-react + eslint-plugin-react-hooks** | dev                             | Uniform lint config for JS/JSX.                                  | Flat-config `eslint.config.js` is the current recommended shape for ESLint 9.        | Slower cold start than SWC-based linters (Biome).                                           |
| **Prettier 3**                                                 | dev                             | Formatter (`.prettierrc.json`).                                  | Zero-config, consistent style.                                                       | Some overlap with ESLint style rules; here they are non-conflicting.                        |
| **globals ^16**                                                | dev                             | ESLint global-name helpers.                                      | Standard companion to ESLint 9.                                                      | —                                                                                           |

`package.json` also declares `"type": "module"` at the root, but the backend and
bot each override to `"commonjs"` in their own `package.json`. Only the frontend
is truly ESM.

## 2.2 Backend (`backend/`)

| Technology                                 | Version                                    | Where                                     | Why                                                                             | Trade-offs                                                                                                    |
| ------------------------------------------ | ------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Node.js ≥ 20**                           | Alpine image                               | Runtime                                   | Native `fetch`, `AbortSignal.timeout`, stable ESM interop.                      | Alpine musl can bite native modules (none are used here).                                                     |
| **Express 4.19**                           | `backend/src/app.js`                       | HTTP server & routing                     | De-facto minimalist framework; well understood.                                 | No built-in schema validation; Fastify/Hono/Koa are faster and more modern.                                   |
| **socket.io ^4.7.5**                       | `backend/src/sockets/socketBroadcaster.js` | Realtime fan-out to dashboard + bot.      | Handles fallback (`websocket` → `polling`), rooms/namespaces, browser-friendly. | Larger wire protocol than raw `ws`; overkill for a single namespace. Alternatives: `ws`, `SSE`, `graphql-ws`. |
| **cors ^2.8.5**                            | `backend/src/app.js`                       | Cross-origin support for Vite dev server. | One-liner middleware.                                                           | Very old, but stable.                                                                                         |
| **dotenv ^16.4.5**                         | `backend/src/config/index.js`              | Load `.env`.                              | Zero-config env injection.                                                      | Doesn't validate types (project uses hand-written `toInt` helper).                                            |
| **HuggingFace Router (OpenAI-compatible)** | called via `fetch`                         | `services/huggingFaceService.js`          | Free-tier inference for `meta-llama/Meta-Llama-3-8B-Instruct`.                  | Cold starts, occasional 502s; project cachees insights per-signature to mitigate.                             |

Dev dependencies:

| Tool               | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| **nodemon ^3.1.4** | Restart on file change (`nodemon.json` config). |

## 2.3 Frontend (`frontend/`)

| Technology                                    | Version                                      | Where                                                  | Why                                                          | Trade-offs                                                     |
| --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------- |
| **React 18**                                  | `main.jsx`, all `components/*.jsx`           | UI framework                                           | Ubiquitous, concurrent-mode ready, plays with Framer Motion. | Not the fastest for tiny UIs; SolidJS/Svelte would be lighter. |
| **Vite ^5.3.5**                               | `vite.config.js`                             | Dev server + bundler (esbuild + Rollup).               | Instant HMR, native ESM, tiny config.                        | Requires Node ≥ 18, no built-in CSR SSR.                       |
| **@vitejs/plugin-react ^4.3.1**               | `vite.config.js`                             | JSX, Fast Refresh.                                     | Standard React integration for Vite.                         | —                                                              |
| **Tailwind CSS 3.4 + PostCSS + autoprefixer** | `tailwind.config.js`, `postcss.config.js`    | Utility-first styling.                                 | Zero-runtime CSS, JIT compiler, good for glassmorphism.      | Utility-heavy JSX; Tailwind v4 is out.                         |
| **Framer Motion ^11.3.19**                    | `RoomCard`, `OfficeLayout`, `EcoToast`, etc. | Declarative animation (`motion.*`, `AnimatePresence`). | Spring physics, layout animations.                           | ~50 kB gzipped.                                                |
| **socket.io-client ^4.7.5**                   | `hooks/useLiveData.js`                       | Realtime data hook.                                    | Matches server, transparent reconnection.                    | Same wire-cost concern as server.                              |

Dev dependencies:

| Tool                  | Purpose                |
| --------------------- | ---------------------- |
| autoprefixer ^10.4.19 | CSS vendor prefixes.   |
| postcss ^8.4.39       | Pipeline for Tailwind. |

## 2.4 Bot (`bot/`)

| Technology                                        | Version                 | Where                                       | Why                                                                                | Trade-offs                                                                    |
| ------------------------------------------------- | ----------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **discord.js ^14.15.3**                           | `bot/src/index.js`      | Discord gateway + REST wrapper.             | v14 aligns with the latest Discord API, supports Message Content + slash commands. | Heavy dep tree (~10 MB).                                                      |
| **socket.io-client ^4.7.5**                       | `bot/src/alertRelay.js` | Consumes backend `incidents:update` stream. | Same wire format as the frontend hook.                                             | —                                                                             |
| **dotenv ^16.4.5**                                | `bot/src/config.js`     | Load `.env`.                                | Consistent with backend.                                                           | —                                                                             |
| **HuggingFace router / OpenAI-compatible client** | `bot/src/llm.js`        | LLM polish + tool-calling for `!ask`.       | One API, two use-cases (polish + agentic).                                         | Tool-calling requires a model that supports it; Llama-3-8B on HF router does. |

## 2.5 Hardware (documentation-only, no runtime code shipped)

| Component                                   | Purpose                                          | Rationale                               |
| ------------------------------------------- | ------------------------------------------------ | --------------------------------------- |
| **ESP32 (NodeMCU / DevKit V1)**             | Room controller (WiFi + GPIO + ADC).             | Cheap, dual-core, WebSocket-friendly.   |
| **Raspberry Pi 4 (alternative)**            | Central controller (see `hardware/pinout.md`).   | Runs the Node backend + I²C.            |
| **ADS1115**                                 | 16-bit I²C ADC for current sensors (Pi variant). | Higher resolution than the ESP32's ADC. |
| **ACS712**                                  | Hall-effect current sensor (ESP32 variant).      | Simple analog output for AC clamps.     |
| **SCT-013**                                 | Split-core CT sensor (Pi variant).               | Non-invasive, safe around mains.        |
| **5V opto-isolated relay module (5–8 ch.)** | Actuator for lights/fans.                        | Physical isolation from mains.          |

## 2.6 Deployment / infrastructure

| Tool                                   | Version / config                       | Purpose                                                   |
| -------------------------------------- | -------------------------------------- | --------------------------------------------------------- |
| **Docker Compose v3.8**                | `docker-compose.yml`                   | Multi-container orchestration.                            |
| **Node 20 Alpine base image**          | `backend/Dockerfile`, `bot/Dockerfile` | Small image, dumb-init for signals.                       |
| **nginxinc/nginx-unprivileged:alpine** | `frontend/Dockerfile` (stage 2)        | Serves the built Vite bundle on non-privileged port 8080. |
| **dumb-init**                          | backend + bot                          | Proper SIGTERM propagation to child Node.                 |

## 2.7 What is intentionally absent

- **Database** — no MySQL/Postgres/Mongo. State is fully in-memory (see §9).
- **Authentication / authorization** — no login, no JWT, no session, no RBAC.
  See §12.
- **Testing framework** — no `jest`/`vitest` present in any `package.json`;
  tests are absent (see §15 and §16).
- **CI/CD pipeline files** — no `.github/workflows`, no GitLab CI YAML.
- **State management library on the frontend** — no Redux/Zustand/Jotai/etc.
  Everything hangs off `useState` and the `useLiveData` hook.
- **Router library** — the dashboard is a single page; no `react-router`.

---

# 3. Folder Structure

Path is relative to the workspace root (`e:\IUT RS HACKATHON`).

## 3.1 Repository root

```
.
├── backend/          # Express + Socket.IO API
├── frontend/         # React + Vite dashboard
├── bot/              # Discord bot
├── diagrams/         # System diagrams (SVG + legacy Mermaid)
├── docs/             # Long-form documentation and images
├── hardware/         # ESP32 circuit reference + Wokwi assets
├── docker-compose.yml
├── .env.example      # Root env template for docker-compose
├── package.json      # Workspaces root
├── eslint.config.js  # Flat ESLint config
├── .prettierrc.json / .prettierignore
├── CONVENTIONS.md    # Coding conventions
├── office-power-monitor.code-workspace
└── README.md
```

Note: an empty `office-power-monitor/` folder also exists at the root containing
only `backend/`, `bot/`, `frontend/`, and `node_modules/` skeletons — it appears
to be a leftover from an earlier project layout. **No production code lives
inside it.**

## 3.2 `backend/`

Purpose: HTTP API, WebSocket broadcaster, and all business logic.

```
backend/
├── src/
│   ├── server.js                  # Composition root
│   ├── app.js                     # Express factory
│   ├── config/
│   │   ├── index.js               # env → config object
│   │   └── devices.js             # Static room + device catalog (15 devices)
│   ├── store/                     # In-memory sources of truth
│   │   ├── deviceStore.js         # 15-device EventEmitter
│   │   ├── energyStore.js         # Trapezoidal energy integrator
│   │   ├── roomSampleBuffer.js    # Rolling per-room W buffer
│   │   └── index.js               # Singletons re-export
│   ├── simulator/
│   │   ├── simulator.js           # Fixed-tick loop
│   │   ├── officeHours.js         # Pure office-hour helpers
│   │   └── index.js
│   ├── alerts/
│   │   ├── alertEngine.js         # Rule evaluator (every 10 s + on change)
│   │   ├── alertStore.js          # Signature-keyed upsert store
│   │   └── index.js
│   ├── incidents/
│   │   ├── incidentAggregator.js  # 1 active incident per room
│   │   └── index.js
│   ├── services/                  # Class + function service layer
│   │   ├── DeviceService.js       # toggle(), shutdownRoom()
│   │   ├── roomService.js         # summarizeRooms()
│   │   ├── usageService.js        # buildUsageSnapshot()
│   │   ├── AlertService.js
│   │   ├── IncidentService.js
│   │   ├── DemoService.js         # scenario switcher
│   │   ├── energyService.js       # Wh → kWh helpers
│   │   ├── powerService.js        # Pure power aggregations
│   │   ├── ecoModeEngine.js       # Auto-shutdown loop
│   │   ├── predictionEngine.js    # Logistic-regression occupancy
│   │   ├── huggingFaceService.js  # HF Inference caller
│   │   ├── simulateService.js     # `POST /api/simulate` engine
│   │   └── index.js
│   ├── routes/
│   │   ├── devicesRouter.js
│   │   ├── roomsRouter.js
│   │   ├── usageRouter.js
│   │   ├── alertsRouter.js
│   │   ├── incidentsRouter.js
│   │   ├── demoRouter.js
│   │   ├── simulateRouter.js
│   │   └── index.js               # Mounts all routers under /api
│   ├── sockets/
│   │   ├── socketBroadcaster.js
│   │   └── index.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   ├── requestLogger.js
│   │   └── validator.js           # `validateQueryEnum()` (not currently wired)
│   ├── discord/                   # Empty placeholder
│   └── utils/
│       ├── apiResponse.js         # success() / error() JSON envelopes
│       └── logger.js              # Tiny leveled logger
├── .env.example
├── Dockerfile
├── nodemon.json
└── package.json
```

### 3.2.1 Why each backend folder exists

- **`config/`** isolates all environment-driven values behind a single object.
  Everything else `require('../config')` and reads properties; no file ever
  touches `process.env` directly after boot.
- **`store/`** houses the _only_ mutable state in the process. Every write in
  the codebase goes through one of these three classes.
- **`simulator/`** is a pure timer that owns _no_ state — it reads `DeviceStore`
  and calls `applyBatch()`. Keeping it separate makes it swappable for a real
  hardware feed later.
- **`alerts/` and `incidents/`** are two coupled concerns split across two
  folders because alerts are atomic conditions while incidents are grouped
  narratives; keeping them separate keeps each store small and testable.
- **`services/`** contains both the class-based DI service layer (used by routes
  and the eco-mode engine) and pure functional modules (`powerService`,
  `energyService`, `roomService`). This mixed style is a legacy of the project's
  evolution; see §15.
- **`routes/`** is a thin transport layer. Each router file exports a factory
  `createXRouter({ deps })` that returns an `express.Router` — a minimal
  dependency-injection pattern.
- **`sockets/`** owns _all_ outgoing realtime events. Nothing else in the
  codebase calls `io.emit()`.
- **`middleware/`** contains reusable Express handlers; `errorHandler` is wired
  via `app.use(err, ...)` in `routes/index.js`; `requestLogger` and `validator`
  are defined but not currently mounted (see §15).
- **`utils/`** is the shared toolbox: response shaping and logging.

## 3.3 `frontend/`

```
frontend/
├── src/
│   ├── main.jsx                   # ReactDOM.createRoot
│   ├── App.jsx                    # Composition + Simulation Mode
│   ├── index.css                  # Tailwind directives + globals
│   ├── hooks/
│   │   └── useLiveData.js         # Single Socket.IO subscription
│   ├── components/                # Presentation + interaction
│   │   ├── Header.jsx
│   │   ├── SummaryCards.jsx
│   │   ├── PowerBreakdown.jsx
│   │   ├── RoomCard.jsx           # Per-room device panel + sparklines
│   │   ├── OfficeLayout.jsx       # Interactive top-down SVG floor plan
│   │   ├── DeviceIcons.jsx        # Fan (spinning) + light (glowing)
│   │   ├── IncidentPanel.jsx
│   │   ├── AIInsightCard.jsx
│   │   ├── EcoToast.jsx
│   │   ├── DemoControls.jsx
│   │   └── SimulationPanel.jsx
│   └── lib/
│       └── format.js              # W/kWh/relative-time helpers
├── index.html
├── nginx.conf                     # Prod static-serving config
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── Dockerfile
└── package.json
```

### 3.3.1 Why each frontend folder exists

- `hooks/` isolates side-effect logic from presentation. `useLiveData` is the
  only stateful hook.
- `components/` splits pure UI: cards, panels, chips, the floor plan.
- `lib/` is deliberately tiny — reserved for cross-cutting helpers with no React
  dependency (`format.js`).

## 3.4 `bot/`

```
bot/
├── src/
│   ├── index.js         # discord.js Client bootstrap + message router
│   ├── config.js        # dotenv → { discordToken, alertChannelIds, ... }
│   ├── commands.js      # Command registry: !status, !room, !usage, !help, !ask
│   ├── formatters.js    # Fallback template responses
│   ├── llm.js           # OpenAI-compatible polish + tool-calling loop
│   ├── apiClient.js     # HTTP client to backend REST
│   └── alertRelay.js    # Socket.IO listener → Discord channels
├── .env.example
├── Dockerfile
├── nodemon.json
└── package.json
```

## 3.5 `diagrams/`

```
diagrams/
├── architecture.svg        # Hand-authored system architecture
├── dataflow.svg            # Simulator → socket → UI + bot
├── alert-lifecycle.svg     # Alert / incident state machine
├── architecture.mmd        # Legacy Mermaid source (retained for reference)
├── dataflow.mmd
├── alert-lifecycle.mmd
└── README.md
```

The `.mmd` files are legacy — the challenge brief explicitly forbids Mermaid, so
the SVGs are the primary deliverable.

## 3.6 `hardware/`

```
hardware/
├── CIRCUIT_DESIGN.md               # Component list + GPIO mapping
├── pinout.md                       # RPi + ADS1115 pinout tables
├── wiring.md                       # Bench-wiring walkthrough
├── diagram.json                    # Wokwi project descriptor
├── work-room-1-simulation.ino.ino  # ESP32 firmware sketch (doubled ext)
├── wokwi-project.txt.txt           # Wokwi project settings (doubled ext)
└── README.md
```

## 3.7 `docs/`

```
docs/
├── API.md                                    # REST + Socket.IO reference
├── ARCHITECTURE.md                           # Long-form architecture notes
├── HARDWARE.md
├── wokwi-logic-simulation.png                # Screenshot
├── work-room-1-electrical-schematic.png      # Full electrical schematic
└── media/                                    # Screenshots + demo GIFs (empty except .gitkeep)
```

---

# 4. Dependency Analysis

Every dependency across the three workspaces, with the operational and security
context that matters for a hackathon deliverable.

## 4.1 Backend (`backend/package.json`)

| Dep           | Version      | Purpose in this project                                             | Perf / bundle impact                                              | Security surface                                                        | Essential? | Alternatives                        |
| ------------- | ------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------- | ----------------------------------- |
| **express**   | ^4.19.2      | HTTP server, routing, body parsing, error middleware.               | Cold start ~15 ms, minimal RAM overhead.                          | Historically vulnerable to path-parsing tricks; version pin is current. | Yes        | fastify, koa, hono.                 |
| **cors**      | ^2.8.5       | `Access-Control-Allow-Origin` header. Configured via `CORS_ORIGIN`. | Negligible.                                                       | Wide-open `*` if `CORS_ORIGIN` unset — see §12.                         | Yes        | Hand-rolled 5-liner.                |
| **socket.io** | ^4.7.5       | Realtime fan-out.                                                   | Adds ~30 kB gzipped to server; per-socket memory overhead ~15 kB. | XSS potential via echoed payloads (mitigated: only JSON, no HTML).      | Yes        | `ws`, SSE (`res.write('data: …')`). |
| **dotenv**    | ^16.4.5      | `.env` loader.                                                      | Negligible.                                                       | Doesn't parse types → hand-written `toInt`.                             | Yes        | `node --env-file=.env` (Node 20+).  |
| **nodemon**   | ^3.1.4 (dev) | Restart on change.                                                  | Dev-only.                                                         | —                                                                       | Dev only.  | `node --watch`.                     |

## 4.2 Frontend (`frontend/package.json`)

| Dep                        | Version                  | Purpose                 | Bundle impact (gzipped, prod build)          | Notes                                                                                  |
| -------------------------- | ------------------------ | ----------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| **react**                  | ^18.3.1                  | UI.                     | ~6 kB.                                       | 18 concurrent features not currently used.                                             |
| **react-dom**              | ^18.3.1                  | Renderer.               | ~40 kB.                                      | —                                                                                      |
| **framer-motion**          | ^11.3.19                 | Animations.             | ~50 kB.                                      | Heaviest single dep; used throughout `OfficeLayout` and `RoomCard`.                    |
| **socket.io-client**       | ^4.7.5                   | Live data subscription. | ~35 kB.                                      | Only used in `useLiveData`. Could be replaced with `EventSource` for a lighter bundle. |
| **@vitejs/plugin-react**   | ^4.3.1 (dev)             | Fast Refresh + JSX.     | —                                            | Standard.                                                                              |
| **vite**                   | ^5.3.5 (dev)             | Dev server, build.      | —                                            | 5.x is stable; 6/7 are newer.                                                          |
| **tailwindcss**            | ^3.4.7 (dev)             | JIT utility classes.    | Emitted CSS < 10 kB gzipped thanks to purge. | 4.x is available but has different ergonomics.                                         |
| **postcss / autoprefixer** | ^8.4.39 / ^10.4.19 (dev) | Tailwind pipeline.      | —                                            | Required by Tailwind.                                                                  |

## 4.3 Bot (`bot/package.json`)

| Dep                  | Version      | Purpose                             | Notes                                                            |
| -------------------- | ------------ | ----------------------------------- | ---------------------------------------------------------------- |
| **discord.js**       | ^14.15.3     | Discord gateway + REST wrapper.     | Requires Message Content intent (already enabled in `index.js`). |
| **socket.io-client** | ^4.7.5       | Consume backend `incidents:update`. | Reused for symmetry with dashboard.                              |
| **dotenv**           | ^16.4.5      | Env loading.                        | Same pattern as backend.                                         |
| **nodemon**          | ^3.1.4 (dev) | Restart on change.                  | Dev only.                                                        |

## 4.4 Are any dependencies removable?

- The bot's LLM layer (`llm.js`) is entirely optional; without `OPENAI_API_KEY`
  the bot degrades to `formatters.js` templates. This is a useful
  graceful-degradation property.
- Framer Motion is aesthetic; the dashboard would function without it, at the
  cost of much less "wow" for a hackathon demo.
- `cors` could be replaced by hand-rolled headers.
- `dotenv` could be dropped on Node 20+ by using `node --env-file=.env`.

## 4.5 Advisory notes

- No `helmet`, `express-rate-limit`, `express-slow-down`, or CSRF library.
- No `zod`/`joi`/`ajv` schema validator — only the one-off `validateQueryEnum`
  middleware (unused).
- No production logger (`pino`, `winston`); the project ships its own ~10-line
  `logger.js`.

---

# 5. Feature Inventory

Every user-facing feature, mapped to files, execution flow, limitations, and
future improvements.

## 5.1 Static device catalog (15 devices)

- **Purpose.** Ground truth of what exists in the office.
- **Files.** `backend/src/config/devices.js`, consumed by
  `backend/src/store/deviceStore.js` at construction time.
- **Execution.** `buildDeviceCatalog()` returns 15 objects: 3 rooms × (2 fans @
  60 W + 3 lights @ 15 W). `DeviceStore._initialize()` seeds every device with
  `status: 'off'`, `power: 0`, and a freshly generated `lastChanged` ISO string.
- **Business logic.** Device IDs are deterministic (`drawing-room-fan-1`) so
  frontend, bot, and REST clients can reference them stably.
- **Limitations.** Catalog is immutable at runtime; adding a device requires a
  code change and process restart.
- **Future.** Move catalog into a JSON file at repo root; expose an admin route
  to hot-reload. Replace with a real database for persistence.

## 5.2 Live device simulator

- **Files.** `backend/src/simulator/simulator.js`,
  `backend/src/simulator/officeHours.js`.
- **Execution.** Every `SIMULATOR_TICK_MS` (default 5 s):
  1. Snapshot all devices.
  2. For each device compute dwell time — skip if `< MIN_DWELL_SECONDS` (60 s).
  3. Look up `transitionProbability(status, officeHours)` (0.35 / 0.05 / 0.03 /
     0.4 depending on office-hours and current status).
  4. If `Math.random() < p`, add `{ id, status: opposite }` to the batch.
  5. `deviceStore.applyBatch(updates)` — a single atomic mutation → single
     `devices:changed` event.
- **State.** None of its own; reads store, writes store.
- **Limitations.** Purely Markov-independent (no coherence between devices in
  the same room). Human-schedule alignment is coarse (only office-hour
  boundary).
- **Future.** Correlated Markov chains, weekly seasonality, per-device activity
  biases (a fan more likely on hot days).

## 5.3 Live device panel (dashboard)

- **Files.** `frontend/src/components/RoomCard.jsx`,
  `frontend/src/components/OfficeLayout.jsx`,
  `frontend/src/hooks/useLiveData.js`.
- **Frontend flow.** `useLiveData()` maintains one Socket.IO connection;
  `devices:update` events refresh state. `RoomCard` renders each room's chips;
  `OfficeLayout` renders the animated top-down floor plan (fans spin, lights
  glow, room bounding boxes shift colour by utilisation).
- **Backend flow.** `SocketBroadcaster._emitDeviceScopedUpdates()` fires on
  every store mutation.
- **Interactivity.** Clicking a device chip in `RoomCard` fires a
  `POST /api/devices/:id/toggle` (via `DeviceService.toggle()`), immediately
  reflected via the round-trip Socket.IO event.
- **Limitations.** No optimistic UI — the chip waits for the backend event to
  update, which is fine at LAN latency but visible over WAN.

## 5.4 Live power meter (total + per-room)

- **Files.** `backend/src/services/powerService.js` (pure functions),
  `frontend/src/components/PowerBreakdown.jsx`,
  `frontend/src/components/SummaryCards.jsx`.
- **Backend flow.** `usageService.buildUsageSnapshot()` composes
  `powerService.totalPower`, `powerByRoom`, `powerByType`, `powerByDevice`,
  `highestConsumingRoom` into a single `UsageSnapshot`.
- **Broadcast cadence.** Every 5 s heartbeat AND every device event, via
  `SocketBroadcaster._emitUsage()`.
- **Limitations.** All powers are nameplate wattages — no PF, no transients.
  Realistic AC modelling would need current + voltage.

## 5.5 Energy accumulator (kWh + BDT cost)

- **Files.** `backend/src/store/energyStore.js`,
  `backend/src/services/energyService.js`.
- **Algorithm.** Trapezoidal integration:
  ```
  ΔWh = ((last.W + current.W) / 2) * ((nowMs - last.ts) / 3_600_000)
  energyWhToday += ΔWh
  ```
  Resets when the local day key rolls over.
- **Consumers.**
  `UsageSnapshot.energyTodayWh/kWh/energyCostBdt/ projectedMonthlyKwh/projectedMonthlyCostBdt`.
- **Limitations.** Local-time day boundary only; timezone shifts on the server
  host affect roll-over. Rolling 30-day projection is naive (kWh × 30).

## 5.6 Alert engine

- **Files.** `backend/src/alerts/alertEngine.js`,
  `backend/src/alerts/alertStore.js`.
- **Rules.**
  1. `device_on_after_hours` (medium) — any device on outside office hours.
  2. `room_on_after_hours` (high) — entire room on outside office hours.
  3. `room_on_too_long` (high) — entire room on for > `ROOM_ON_MAX_HOURS`.
  4. `power_anomaly` (high) — latest per-room sample > mean + 2σ **and** jump ≥
     45 W (guardrail against baseline≈0 false positives).
- **Lifecycle.**
  - Cadence: `setInterval(evaluate, 10_000)` + on any `device[s]:changed`.
  - Upsert semantics via signature keys (`room-on-too-long:work-room-1`).
  - `resolveMissing(keepSet)` auto-closes stale alerts each pass.
- **AI hook.** On `power_anomaly` open, `HuggingFaceService.generateInsight` is
  fire-and-forget; when it resolves, `alertStore.attachInsight(sig, text)` emits
  `alerts:changed`.
- **Limitations.** Anomaly threshold is fixed globally; no per-room learning; no
  seasonality; no cool-down (an alert can flap if the metric hovers on the
  boundary).

## 5.7 Incident aggregator

- **Files.** `backend/src/incidents/incidentAggregator.js`.
- **Policy.** One active incident per room; groups every active alert under that
  room; auto-resolves when no active alerts remain.
- **Rollup.** Severity = max of member severities. Title composed of member
  kinds.

## 5.8 Prediction engine (occupancy)

- **File.** `backend/src/services/predictionEngine.js`.
- **Features.**
  - `fanOnCount` (weight 1.5)
  - `lightOnCount` (weight 1.0)
  - `minutesSinceChange` (weight −0.05)
  - `officeHoursActive` (weight 2.0)
  - `bias` (−2.0)
- **Activation.** Sigmoid; threshold `probability ≥ 0.5` → `occupied`.
- **Extras.** `predictPotentialSavings(room)` extrapolates current W by hours
  remaining until `OFFICE_HOUR_END` × tariff BDT/kWh (min 1 h).
- **Limitations.** Weights are hand-tuned, not learned from data. See §10.

## 5.9 Eco-Mode auto-shutdown

- **File.** `backend/src/services/ecoModeEngine.js`.
- **Loop.** Every 30 s: for each room, if
  `prediction.predictedState === 'unoccupied' && room.powerWatts > 0`, mark it
  as unoccupied. If the unoccupied streak ≥ 5 min and we haven't already shut
  down in this window → `deviceService.shutdownRoom(id)`, emit `eco:action`.
  State resets when the room becomes occupied again.
- **Toast.** `App.jsx` renders `EcoToast` for the latest 5 notifications,
  dismissible individually.

## 5.10 REST API + standard envelope

- **Files.** `backend/src/routes/*.js`, `backend/src/utils/apiResponse.js`.
- **Envelope.** All responses: `{ success: true, data }` or
  `{ success: false, error: { message, code } }`.
- **Coverage.** Devices, rooms, usage, alerts, incidents, demo scenarios,
  simulation ("what-if").

## 5.11 Socket.IO realtime channel

- **File.** `backend/src/sockets/socketBroadcaster.js`.
- **Events emitted.** `devices:update`, `rooms:update`, `usage:update`,
  `alerts:update`, `incidents:update`, `eco:action`.
- **On connect.** Sends a full snapshot of all channels so late joiners are
  immediately consistent.

## 5.12 HuggingFace AI insights

- **File.** `backend/src/services/huggingFaceService.js`.
- **Endpoint.** `POST https://router.huggingface.co/v1/chat/completions`
  (OpenAI-compatible). Uses `HF_API_TOKEN` as `Bearer`.
- **Model.** `HF_MODEL` (default `meta-llama/Meta-Llama-3-8B-Instruct`).
- **Prompt.** Contains office layout, current W, baseline, deviation %, active
  devices, office-hours flag, cost so far, tariff — asks for a professional 2–3
  sentence diagnosis + recommendation + BDT-saving figure.
- **Caching.** In-memory `Map<signature, string>` capped at 50 entries; LRU
  eviction. Invalidated when alert resolves.
- **Failure mode.** Returns `null` silently → UI simply hides the section.

## 5.13 Discord bot: prefix commands

- **File.** `bot/src/commands.js`.
- **`!status`** — aggregates rooms + usage + alerts via `apiClient`, formats via
  `formatters.formatStatus`, optionally polishes via `llm.polish`.
- **`!room <name>`** — alias resolver (`work1` → `work-room-1`, `drawing` →
  `drawing-room`, etc.).
- **`!usage`** — total power, kWh, BDT cost, projected monthly, by room, by
  type.
- **`!help`** — auto-generated list.
- **`!ask <question>`** — free-form. Wraps `llm.askQuestion` which is a
  tool-calling loop over 4 tools (`getUsage`, `getRooms`, `getAlerts`,
  `getIncidents`), capped at `maxIterations = 2` with a fallback summary call.
- **Security guardrail.** System prompt strictly scopes the bot to office power
  topics and refuses state mutations (bot is read-only in `!ask`).

## 5.14 Discord bot: proactive alerts

- **File.** `bot/src/alertRelay.js`.
- **Flow.** Subscribes to `incidents:update`. On the _first_ payload it seeds
  `knownIncidentIds` (so restarts don't spam history). Thereafter, any newly
  seen `active` incident is formatted (`formatIncident`) and optionally polished
  (`polish`), then posted to every channel in `ALERT_CHANNEL_IDS`.

## 5.15 Digital Twin / "Simulation Mode" (frontend-only)

- **Files.** `App.jsx` state (`isSimMode`, `simulatedDevices`),
  `SimulationPanel.jsx`, `OfficeLayout.jsx` (`isSimMode` prop), backend
  counterpart `backend/src/services/simulateService.js`,
  `backend/src/routes/simulateRouter.js`.
- **Purpose.** Lets the user deep-copy the current device state, mutate it by
  clicking on the floor plan, `POST /api/simulate` the delta, and see
  hypothetical savings + which alerts would fire — without touching real state.

## 5.16 Demo scenarios

- **File.** `backend/src/services/DemoService.js` +
  `backend/src/routes/demoRouter.js` +
  `frontend/src/components/DemoControls.jsx`.
- **Scenarios.**
  - `everything-off` — turns all devices off; seeds `energyStore` with 12.4 kWh
    for demo persuasiveness.
  - `high-power` / `office-hours` — turns everything on.
  - `alert-scenario` / `after-hours` — Drawing Room fully on, others off.

## 5.17 Interactive floor plan (bonus per spec)

- **File.** `frontend/src/components/OfficeLayout.jsx` (700+ lines of SVG art).
- **Features.** Top-down view, wall masks with door cutouts, doors with arcs,
  windows, fans (3-blade spin, speed ∝ wattage), lights (halo bloom
  - concentric rings), room heatmap colouring, anomaly pulse overlay, hover
    tooltips, click-for-detail modal, simulation-mode click toggling.

---

# 6. System Architecture

## 6.1 Architectural style

- **Monolithic backend** with **event-driven internals**. One Node process holds
  all state; internal modules communicate via `EventEmitter` events
  (`device:changed`, `alerts:changed`, etc.) rather than direct method calls
  where possible.
- **Dependency-injected service layer** (constructor injection for classes;
  function-parameter injection for pure functions). Almost no file references
  global state directly other than the store singletons.
- **Multi-client fan-out.** One backend → two independent clients (Web +
  Discord) reading the same source of truth over the same wire protocol
  (Socket.IO).
- **Shared-nothing containerisation.** Each of the three services runs in its
  own container connected only by a Docker bridge network.

## 6.2 Data flow (steady state)

```
Simulator.tick()
  └─► DeviceStore.applyBatch(updates)
        ├─► emits 'device:changed' / 'devices:changed'
        │     ├─► AlertEngine.evaluate()
        │     │     ├─► AlertStore.upsert()
        │     │     │     └─► emits 'alerts:changed'
        │     │     │           └─► SocketBroadcaster → io.emit('alerts:update')
        │     │     │     └─► emits 'alert:opened' / 'alert:resolved'
        │     │     │           └─► IncidentAggregator.evaluate()
        │     │     │                 └─► emits 'incidents:changed'
        │     │     │                       └─► SocketBroadcaster → io.emit('incidents:update')
        │     │     └─► (async) HuggingFaceService.generateInsight()
        │     │              └─► AlertStore.attachInsight()
        │     └─► SocketBroadcaster._recordEnergySample()
        │           ├─► EnergyStore.record(totalW)
        │           └─► RoomSampleBuffer.record(perRoomW)
        └─► SocketBroadcaster._emitDeviceScopedUpdates()
              ├─► io.emit('devices:update')
              ├─► io.emit('rooms:update')  (with predictions)
              └─► io.emit('usage:update')  (from buildUsageSnapshot)
```

## 6.3 Request lifecycle (REST)

```
GET /api/rooms
 └─► express.Router()
       └─► createRoomsRouter({ deviceStore, predictionEngine })
             └─► roomService.summarizeRooms(deviceStore)
                   └─► store.getRooms() + store.getAll() + powerByRoom(devices)
             └─► predictionEngine.getRoomPredictions(room) for each
       └─► success(res, rooms)   → { success:true, data:[...] }
```

## 6.4 Design patterns in use

| Pattern                                | Where                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| **Composition root**                   | `backend/src/server.js#bootstrap()`                                          |
| **Dependency injection (constructor)** | `AlertEngine`, `SocketBroadcaster`, `EcoModeEngine`, all `*Service` classes  |
| **Factory functions**                  | Every router: `createXRouter({ deps })`                                      |
| **Event Emitter / pub-sub**            | Every store and engine (`extends EventEmitter`)                              |
| **Singleton**                          | `deviceStore`, `energyStore`, `alertStore` exports from their modules        |
| **Strategy**                           | LLM `polish()` — swap fallback template with LLM output                      |
| **Template method**                    | `formatters.js` → produces baseline text; `polish()` layer on top            |
| **Command registry**                   | `bot/src/commands.js`                                                        |
| **Observer**                           | Every consumer of `devices:changed` / `alerts:changed` / `incidents:changed` |

## 6.5 Module interaction diagram

See [diagrams/architecture.svg](diagrams/architecture.svg) for the full static
diagram, [diagrams/dataflow.svg](diagrams/dataflow.svg) for the happy-path
sequence, and [diagrams/alert-lifecycle.svg](diagrams/alert-lifecycle.svg) for
the alert state machine.

---

# 7. Frontend Analysis

## 7.1 Composition

- Single-page app; no router (`react-router` not installed).
- Entry: `main.jsx` → `<App />` mounted into `#root`.
- `App.jsx` is the sole composition point: header, summary strip, room grid
  - power breakdown, incident/alerts panel, footer, demo controls, eco toasts,
    optional simulation panel.

## 7.2 Components inventory

| Component           | Responsibility                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------- |
| **Header**          | Brand + live connection dot ("15 devices").                                                  |
| **SummaryCards**    | Total W, kWh today, BDT cost, active alerts.                                                 |
| **RoomCard**        | Per-room utilisation ring, sparkline, occupancy badge, device chips (with toggle).           |
| **PowerBreakdown**  | Total power + per-room + per-type breakdown.                                                 |
| **OfficeLayout**    | 860×520 SVG top-down office; interactive per-device animation and modal.                     |
| **DeviceIcons**     | `FanIcon` (SVG spin, `wattage` prop drives speed) and `LightIcon` (halo glow).               |
| **IncidentPanel**   | Right rail: currently active incidents, timestamps, AI insight cards.                        |
| **AIInsightCard**   | Renders `alert.aiInsight` when present.                                                      |
| **EcoToast**        | Bottom-right stack of dismissible eco-shutdown notifications.                                |
| **DemoControls**    | Buttons that call the `/api/demo/:scenario` endpoints.                                       |
| **SimulationPanel** | Overlay when `isSimMode` — shows diff / projected savings from the `/api/simulate` endpoint. |

All components are functional; hooks-only (`useState`, `useId`,
`useMotionValue`). No `Context`, no reducers, no Redux/Zustand.

## 7.3 State management

- **Global-ish state** lives inside `useLiveData()` and is passed down as props.
  It exposes:
  `{ connected, devices, rooms, usage, alerts, incidents, ecoNotifications }`.
- **Local UI state** (`isSimMode`, `simulatedDevices`, `dismissed`, hover,
  selected device) lives in `App.jsx` or the component that needs it.
- No memoisation with `useMemo`/`useCallback`. All derivations happen inline
  during render. At 15 devices this is fine.

## 7.4 Rendering flow

1. First render — state has `connected:false`, empty arrays; the UI shows its
   skeleton with "Offline" indicator.
2. Socket connects → `connect` fires → `patch({ connected:true })`.
3. Server emits initial snapshot (five events) → each `on()` handler patches the
   corresponding slice → the whole tree re-renders once per event. React 18
   batches synchronous state updates automatically.
4. Subsequent events refresh only the relevant slice.

## 7.5 Animation strategy (Framer Motion)

- **Layout animations.** `motion.button` with `layout` prop → device chips
  animate positions when re-ordered.
- **Presence.** `AnimatePresence` used inside `OfficeLayout` for tooltip and
  modal overlays.
- **Continuous.** Infinite `animate={{ x: ['-100%', '200%'] }}` shimmer on ON
  chips; infinite `scale` breathing on ON icons.
- **Perf note.** Every animation runs on the compositor via CSS transforms;
  JS-side load is negligible.

## 7.6 Styling

- Tailwind utility classes for everything.
- Custom colours (`bg-radial-fade`, `text-bad`, `border-good/40`, `glass`,
  `bg-ink-900/60`) are extensions in `tailwind.config.js` and `index.css`.
- Glassmorphism via `.glass` class combining `backdrop-blur`, translucent
  background, and border-highlight.

## 7.7 Accessibility

- SVG floor plan has `role="img"` and `aria-label`; individual devices are
  inside `<motion.button>` elements with focus rings.
- Icon-only buttons _do_ have adjacent text labels.
- Colour is not the sole state indicator (icons + labels present).
- **Gaps.** No skip-to-content link, no aria-live for the alerts panel, no
  reduced-motion media query wiring (Framer Motion respects
  `prefers-reduced-motion` if configured — not configured here).

## 7.8 Responsiveness

- Root max width `1400px`; grid collapses at `xl`
  (`xl:grid-cols-[minmax(0,1fr)_380px]`).
- Room grid: 1 col mobile → 2 col md → 3 col xl.
- Floor plan uses a fluid `viewBox` and scales to container width.

## 7.9 Performance optimisations

- Vite tree-shakes Framer Motion; only imports used land in the bundle.
- Static build served by Nginx (immutable-cacheable hashed asset filenames).
- Sparklines are inline SVG — no `<canvas>`, no runtime chart lib.
- Socket.IO uses WebSocket first with polling fallback.

## 7.10 Known limitations

- No error boundary — a thrown React error crashes the whole app.
- No offline fallback — if the backend disappears the dashboard just goes quiet.
- No pagination or virtualisation — not needed at 15 devices, would be needed at
  scale.

---

# 8. Backend Analysis

## 8.1 Composition root

`backend/src/server.js` is the _only_ file that touches every subsystem. It runs
in a strict order:

```
createApp()
createHttpServer(app)
createSocketIOServer(server, { cors })
new HuggingFaceService()
new PredictionEngine()
new AlertEngine({ deviceStore, alertStore, roomSampleBuffer, hfService })
new IncidentAggregator({ alertStore })
new SocketBroadcaster({ io, deviceStore, energyStore, alertStore, incidentAggregator, roomSampleBuffer, predictionEngine })
new Simulator({ deviceStore })
new *Service({ ... })
registerRoutes(app, deps)
new EcoModeEngine({ predictionEngine, deviceService, roomService })
incidentAggregator.start()
broadcaster.start()
alertEngine.start()
ecoModeEngine.start()
simulator.start()
server.listen(port, host)
```

Ordering matters — subscribers are always attached **before** producers.

## 8.2 Routes and controllers

Handled by feature-scoped `create*Router({ deps })` factories, all mounted in
`routes/index.js`. Each router file is tiny (30–50 lines) and delegates to a
service or a store.

`registerRoutes()` also installs:

- `app.use('/api', notFound404)` → `{ error: 'not_found' }`.
- `app.use((err, req, res, next) => ...)` → generic 500. Bypasses the
  `errorHandler` middleware in `middleware/errorHandler.js` (which is present
  but not wired here). See §15.

## 8.3 Services

Two flavours coexist:

- **Class-based** — `DeviceService`, `AlertService`, `IncidentService`,
  `RoomService`, `UsageService`, `DemoService`. Instantiated in `server.js` with
  dependencies; injected into routers or engines.
- **Function modules** — `powerService`, `energyService`, `roomService` (also
  exports a class), `usageService.buildUsageSnapshot`. These are pure,
  side-effect-free helpers.

The mixed style is a code-smell (see §15) but doesn't affect correctness.

## 8.4 Business logic map

| Concern                         | Owner                                              |
| ------------------------------- | -------------------------------------------------- |
| Device state                    | `DeviceStore`                                      |
| Energy integration              | `EnergyStore`                                      |
| Per-room baseline for anomalies | `RoomSampleBuffer`                                 |
| Rule-based alerts               | `AlertEngine` (rules) + `AlertStore` (persistence) |
| Incident grouping               | `IncidentAggregator`                               |
| Occupancy inference             | `PredictionEngine`                                 |
| Auto-shutdown                   | `EcoModeEngine`                                    |
| AI narratives                   | `HuggingFaceService`                               |
| REST envelope                   | `apiResponse.js`                                   |
| Realtime fan-out                | `SocketBroadcaster`                                |

## 8.5 Middleware

- **`errorHandler.js`** — global error handler that logs via `logger`, guards
  against `res.headersSent`, and calls `error(res, ..., 500)`. Currently
  _unused_ — `routes/index.js` installs a simpler
  `(err, req, res, next)=>res.status(500).json({error:'internal_error'})`
  handler instead.
- **`requestLogger.js`** — logs `${method} ${url}` with `status`, `durationMs`,
  `ip`. Currently _unused_.
- **`validator.js`** — `validateQueryEnum('status', ['active','all'], 'all')`.
  Currently _unused_ — each route hand-validates instead.
- **CORS + JSON body parsing** — mounted in `app.js`.

## 8.6 Validation

- Route handlers do minimal manual validation (string comparison on
  `req.query.status`).
- `POST /api/simulate` verifies `simulatedDevices` is an array.
- No JSON schema anywhere.

## 8.7 Authentication / authorization

- None. Every endpoint and Socket.IO event is public. See §12.

## 8.8 Error handling strategy

- Backend routes wrap their body in `try { ... } catch (err) { next(err) }`
  inconsistently — some do (`usageRouter`, `demoRouter`, `simulateRouter`), most
  do not.
- Service classes throw `Error` from constructors when dependencies are missing;
  otherwise, errors bubble up naturally.
- Async LLM calls always swallow and log, returning `null` for graceful
  degradation.

## 8.9 Logging

`utils/logger.js` writes ISO-timestamped, level-prefixed lines to stdout.
Levels: `info`, `warn`, `error`, `debug`. Meta is JSON-stringified inline. No
log rotation, no structured JSON output, no log correlation IDs.

## 8.10 Runtime behaviour worth noting

- Every `setInterval` timer calls `unref()` if available so the process can
  still exit cleanly.
- SIGINT/SIGTERM handler stops every subsystem in reverse order, waits up to 5
  s, and force-exits.
- Alert Engine subscribes to _both_ `device:changed` and `devices:changed` —
  potentially firing twice per batch, which is idempotent (upsert semantics) but
  wasteful.

---

# 9. Database Analysis

**There is no database.** Not MySQL, not Postgres, not MongoDB, not SQLite, not
Redis. Everything is in-memory. This is a deliberate hackathon-scope decision;
the challenge brief permits an in-memory store.

However, the codebase does have well-typed in-memory equivalents that would map
cleanly onto tables/collections if persistence were added:

### 9.1 Equivalent schemas (if migrated)

```sql
-- rooms
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,          -- 'drawing-room', 'work-room-1', ...
  name TEXT NOT NULL
);

-- devices
CREATE TABLE devices (
  id TEXT PRIMARY KEY,          -- 'work-room-1-fan-2'
  room_id TEXT REFERENCES rooms(id),
  label TEXT NOT NULL,
  type TEXT CHECK (type IN ('fan','light')),
  wattage INTEGER NOT NULL,
  status TEXT CHECK (status IN ('on','off')) DEFAULT 'off',
  power INTEGER DEFAULT 0,
  last_changed TIMESTAMPTZ NOT NULL
);

-- energy_samples (append-only)
CREATE TABLE energy_samples (
  ts TIMESTAMPTZ NOT NULL,
  total_watts INTEGER NOT NULL
);

-- room_samples
CREATE TABLE room_samples (
  room_id TEXT REFERENCES rooms(id),
  ts TIMESTAMPTZ NOT NULL,
  watts INTEGER NOT NULL,
  PRIMARY KEY (room_id, ts)
);

-- alerts
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  signature TEXT NOT NULL,
  kind TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low','medium','high')),
  room_id TEXT NULL REFERENCES rooms(id),
  device_id TEXT NULL REFERENCES devices(id),
  message TEXT NOT NULL,
  status TEXT CHECK (status IN ('active','resolved')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ NULL,
  ai_insight TEXT NULL
);

CREATE INDEX alerts_active_by_signature
  ON alerts(signature) WHERE status = 'active';

-- incidents
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  room_id TEXT NULL REFERENCES rooms(id),
  status TEXT CHECK (status IN ('active','resolved')),
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ NULL
);

CREATE TABLE incident_alerts (
  incident_id TEXT REFERENCES incidents(id),
  alert_id TEXT REFERENCES alerts(id),
  PRIMARY KEY (incident_id, alert_id)
);
```

### 9.2 Indexes to add later

- Active alerts by signature (unique).
- `energy_samples(ts DESC)` for windowed queries.
- `room_samples(room_id, ts DESC)` for baseline windows.

### 9.3 Trade-offs of the current in-memory approach

- **Pros.** Zero ops, zero-latency reads, easy testability.
- **Cons.** Data lost on restart; no historical analytics; no multi-instance
  scaling. `alertStore._byId` is capped at 500 and evicts oldest — potential
  data loss if alert volume is high.

---

# 10. AI / ML Analysis

The project uses AI in **three** distinct places, all optional and gracefully
degradable.

## 10.1 Backend — HuggingFace insight generator

- **File.** `backend/src/services/huggingFaceService.js`.
- **Model.** `HF_MODEL` (default `meta-llama/Meta-Llama-3-8B-Instruct`).
- **Endpoint.** OpenAI-compatible `POST /v1/chat/completions` on
  `https://router.huggingface.co`.
- **Auth.** `Authorization: Bearer ${HF_API_TOKEN}`.
- **Prompt engineering** (verbatim from source):

  ```
  You are an AI energy analyst for a smart office power monitoring system in Bangladesh.

  Office layout: 3 rooms (Drawing Room, Work Room 1, Work Room 2),
  each with 2 fans (60W each) and 3 lights (15W each). Max room draw: 165W.

  ANOMALY DETECTED:
    - Room: ${roomName}
    - Current power draw: ${currentW}W
    - Rolling baseline: ~${baselineW}W
    - Deviation: +${deviationPct}% above baseline
    - Active devices: [...]
    - Time context: (office hours OR "OUTSIDE office hours — the office should be empty")
    - Today's total energy cost so far: ${energyCostBdt} BDT
    - Electricity tariff: ${tariff} BDT/kWh
    - Excess cost rate: ~${savingsPerHour} BDT/hour above normal

  Write a concise 2-3 sentence AI insight that:
   1. Diagnoses the likely cause of this spike
   2. Recommends the single most impactful action
   3. Quantifies the BDT savings if that action is taken immediately

  Maintain a strictly professional, formal, and objective tone.
  Under no circumstances should you use emojis or casual language.
  Do not repeat the raw numbers unnecessarily. Maximum 60 words.
  ```

- **Inference config.** `max_tokens: 120`, `temperature: 0.4`, `stream: false`,
  request timeout 35 s.
- **Caching.** In-memory `Map<signature, string>`, capped at 50. Insights
  survive across evaluations for the same signature; explicitly invalidated on
  alert resolution via `invalidate()`.
- **Failure mode.** Any HTTP error, timeout, or empty body → `null`. The
  frontend simply hides `AIInsightCard`.
- **Prompt-injection defence.** The prompt is fully constructed from
  server-controlled data — no user input reaches the model.
- **Limitations.** Cold-start latency on HF router can exceed the 35 s timeout
  for less popular models; the fixed `activeDevices` list uses device labels,
  not IDs, which is more human-friendly but less parseable.

## 10.2 Bot — LLM polish layer

- **File.** `bot/src/llm.js#polish()`.
- **Purpose.** Rewrites the deterministic template output from `formatters.js`
  in a friendlier Discord-chat tone while preserving all numbers and device
  names exactly.
- **Model / endpoint.** Same `OPENAI_*` env vars (OpenAI-compatible; can point
  to HuggingFace router, Ollama, LocalAI, etc.).
- **System prompt.**
  ```
  You are a concise office facilities assistant. Rewrite the given
  monitoring report in a friendlier tone for a Discord chat. Keep ALL
  numbers, device names, and factual details EXACTLY as provided. Do
  not invent data. Preserve line breaks and Discord markdown. Reply
  with the rewritten message only.
  ```
- **Inference config.** `temperature: 0.4`, 5 s `AbortSignal.timeout`.
- **Failure mode.** Falls back to the raw template.

## 10.3 Bot — Tool-calling agent (`!ask`)

- **File.** `bot/src/llm.js#askQuestion()`.
- **Model.** Same `OPENAI_MODEL`.
- **Tools.** `getUsage`, `getRooms`, `getAlerts`, `getIncidents` (each wraps
  `apiClient.get*()`).
- **Loop.** Up to `maxIterations = 2` chat/completions calls followed by a final
  "please summarise" call if the model gets stuck in a tool loop.
- **System prompt (scope-guard).**
  ```
  You are an office energy monitor bot. Answer questions about the
  office power usage, devices, alerts, or incidents using the provided
  tools. Strictly bound your scope: ONLY answer questions related to
  the office power, device, alert, or incident state. If the user asks
  about unrelated topics (like weather, sports, generic knowledge,
  code), politely decline and redirect them to try !status, !usage,
  or !room. If the user asks to modify states (like "turn off lights",
  "toggle fan"), explain that you operate in a read-only context and
  cannot perform state mutations.
  ```
- **Timeouts.** 8 s per LLM call; 5 s for the fallback summary.
- **Failure mode.** Human-readable apology suggesting `!status`.

## 10.4 Backend — Prediction engine (occupancy)

- **File.** `backend/src/services/predictionEngine.js`.
- **Model type.** Logistic-regression classifier with 4 features. **Not
  trained** — weights are hand-set constants (bias −2.0, fanOn 1.5, lightOn 1.0,
  minutesSinceChange −0.05, officeHours 2.0). Prediction: `σ(z)` where
  `z = bias + Σ feature × weight`.
- **Threshold.** `p ≥ 0.5` → `occupied`.
- **Extras.** `predictPotentialSavings()` extrapolates current W ×
  hours-to-close × tariff (min 1 h).
- **Evaluation.** No labelled data → no accuracy/precision/recall metrics.
  Weights are a plausible domain heuristic (fans and lights imply presence;
  recent changes imply presence; office hours amplify prior).
- **Limitations.** No online learning. No handling of long-lived occupancy
  pattern (someone quietly reading with everything off). No cross-room
  correlation.
- **Optimisations available.** Feed live door-sensor / motion-sensor data if
  hardware is deployed. Train real weights from labelled ground truth once data
  is collected.

## 10.5 What the project does _not_ do (AI-wise)

- No embeddings, no vector search, no RAG.
- No image models, no ASR/TTS.
- No fine-tuning; no LoRA; no local model inference.
- No AI-based forecasting of tomorrow's power (would be a natural next step).

---

# 11. API Documentation

Base URL locally: `http://localhost:4000`. All responses use the standard
envelope `{ success, data | error }` (per `utils/apiResponse.js`).

## 11.1 Health

### `GET /api/health`

No auth. Returns liveness + uptime. **Envelope varies** — this specific route
uses the raw shape `{ status, uptime }` instead of the standard envelope (it is
defined in `app.js` before routers).

```json
{ "status": "ok", "uptime": 12.34 }
```

## 11.2 Devices

### `GET /api/devices`

No auth. Returns all 15 devices.

```json
{
  "success": true,
  "data": [
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

Returns a single device or
`{ success:false, error:{ message:'device_not_found' } }` with `HTTP 404`.

### `POST /api/devices/:id/toggle`

Toggles ON ↔ OFF. Returns the updated device or 404.

- **Request body.** None (path parameter only).
- **Response.** `{ success, data: Device }`.
- **Errors.** `404 device_not_found`.

## 11.3 Rooms

### `GET /api/rooms`

Returns array of `RoomSummary` objects, each augmented with `predictions` from
the `PredictionEngine`:

```json
{
  "id": "drawing-room",
  "name": "Drawing Room",
  "devices": [Device],
  "totalDevices": 5,
  "onCount": 2,
  "offCount": 3,
  "powerWatts": 90,
  "allOn": false,
  "samples": [],
  "predictions": {
    "occupancyProbability": 0.72,
    "predictedState": "occupied",
    "potentialSavingsBdt": 0
  }
}
```

### `GET /api/rooms/:id`

Single room or `404 room_not_found`.

## 11.4 Usage

### `GET /api/usage`

Returns a full `UsageSnapshot`:

```json
{
  "timestamp": 1720086400000,
  "currentPowerWatts": 210,
  "totalPowerWatts": 210,
  "powerByRoom": { "drawing-room": 60, "work-room-1": 90, "work-room-2": 60 },
  "powerByType": { "fan": 120, "light": 90 },
  "powerByDevice": { "drawing-room-fan-1": 60 },
  "activeDevicesCount": 4,
  "inactiveDevicesCount": 11,
  "activeDevices": [{ "id", "label", "room", "type", "power" }],
  "highestConsumingRoom": { "roomId": "work-room-1", "name": "Work Room 1", "watts": 90 },
  "energyTodayWh": 342.7,
  "energyTodayKwh": 0.343,
  "energyCostBdt": 2.40,
  "projectedMonthlyKwh": 10.29,
  "projectedMonthlyCostBdt": 72.03,
  "samples": [{ "timestamp": 1720086395000, "powerWatts": 200 }]
}
```

## 11.5 Alerts

### `GET /api/alerts?status=all|active`

Default `all`. Invalid status → `400 invalid_status`. Returns array of `Alert`
objects.

## 11.6 Incidents

### `GET /api/incidents?status=all|active`

Same shape as alerts, returns `Incident[]`.

## 11.7 Demo

### `POST /api/demo/:scenario`

Scenarios: `everything-off`, `high-power`, `office-hours`, `alert-scenario`,
`after-hours`. Unknown scenarios → `400`.

## 11.8 Simulation (what-if)

### `POST /api/simulate`

Request body:

```json
{
  "simulatedDevices": [
    { "id": "drawing-room-fan-1", "status": "on", "power": 60, "type": "fan", "room": "drawing-room", ... }
  ]
}
```

Returns
`{ livePowerWatts, simPowerWatts, savedWatts, liveMonthlyBdt, simMonthlyBdt, savedMonthlyBdt, simulatedAlerts }`
— evaluated statelessly (does _not_ mutate `DeviceStore`).

## 11.9 Socket.IO

Connect to `ws://localhost:4000` (Socket.IO). On `connect` the server pushes:

| Event              | Payload                                                        |
| ------------------ | -------------------------------------------------------------- |
| `devices:update`   | `Device[]`                                                     |
| `rooms:update`     | `RoomSummary[]` (with `predictions`)                           |
| `usage:update`     | `UsageSnapshot`                                                |
| `alerts:update`    | `Alert[]`                                                      |
| `incidents:update` | `Incident[]`                                                   |
| `eco:action`       | `{ roomId, roomName, devicesShutdown, savingsBdt, timestamp }` |

Emitted going forward on any change or on the 5-s heartbeat (`usage:update`).

## 11.10 Error format

- REST envelope: `{ success:false, error:{ message, code } }`.
- Bare 500 fallback in `routes/index.js`: `{ error: 'internal_error' }`.
- `/api/health` uses the ad-hoc `{ status, uptime }` shape.

_(Inconsistency noted in §15.)_

---

# 12. Security Analysis

## 12.1 Authentication / authorization

- **None.** Any HTTP client on the network can call any endpoint, including
  `POST /api/devices/:id/toggle` and `POST /api/demo/:scenario`.
- **Socket.IO** accepts any connection; no auth handshake.
- **Discord bot** — permissions come from the Discord platform layer (server
  invite + Message Content intent). Anyone in the server can invoke commands. No
  allowlist by user or role.

## 12.2 Input validation

- Query enums are hand-validated (only in `alertsRouter` and `incidentsRouter`).
- `POST /api/simulate` checks `Array.isArray(simulatedDevices)` but does _not_
  validate individual device shapes; a malformed device could throw inside
  `powerService`.
- No schema library; no rate limiting.

## 12.3 Secrets handling

- `.env` files are gitignored (`.gitignore` at root explicitly ignores
  `backend/.env`, `frontend/.env`, `bot/.env`).
- `.env.example` templates use empty placeholders.
- **Historic exposure.** During development a Discord bot token and a
  HuggingFace API key were committed at various points to `backend/.env` and
  pasted into a chat context. They must be rotated at Discord Developer Portal
  and HuggingFace regardless of `.gitignore` coverage.

## 12.4 Rate limiting / abuse mitigation

- **None on REST endpoints.** `POST /api/devices/:id/toggle` and
  `/api/demo/:scenario` can be flooded.
- **None on Socket.IO.** No connection cap or event flood protection.
- `HuggingFaceService` caches insights per-signature — a natural rate limiter
  but not a security control.

## 12.5 Transport security

- Local dev is HTTP only.
- Docker Compose exposes plain HTTP ports (`4000`, `5173`).
- Production deployment would need a reverse proxy with TLS termination (e.g.,
  Caddy, Traefik, nginx-proxy).

## 12.6 CORS

- Governed by `CORS_ORIGIN` (default `*`). The `.env` in this repo sets it to
  `http://localhost:5173`.
- Wildcard is safe here because all endpoints are read-heavy public data with no
  auth, but shipping wildcard to production alongside mutating endpoints is a
  footgun.

## 12.7 OWASP Top 10 mapping

| OWASP 2021 category                | Status      | Notes                                                                                             |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| A01 Broken Access Control          | ❌ Exposed  | No auth; state-mutating endpoints are open.                                                       |
| A02 Cryptographic Failures         | N/A         | No secrets at rest, no crypto.                                                                    |
| A03 Injection                      | ✅ Low risk | JSON in/out; no SQL, no shell exec, no template injection.                                        |
| A04 Insecure Design                | ⚠️          | Simulator + demo route allow anyone to influence dashboard.                                       |
| A05 Security Misconfiguration      | ⚠️          | Default `CORS_ORIGIN=*` in code fallback, no helmet.                                              |
| A06 Vulnerable Components          | ✅          | All deps pinned to recent minor versions; no `npm audit` results committed.                       |
| A07 Identification & Auth Failures | ❌          | No identification at all.                                                                         |
| A08 Software/Data Integrity        | ✅          | Bot only reads backend; LLM insights are cached but keyed by internal signature (not user input). |
| A09 Logging & Monitoring           | ⚠️          | Custom logger, stdout only; no correlation IDs, no alerting.                                      |
| A10 SSRF                           | ✅          | Backend does one outbound call (HF router) with a hardcoded URL; not user-controlled.             |

## 12.8 Recommended hardening (short list)

- Add an `X-API-Key` header (env-driven) requirement for all mutating routes.
- Add `helmet` middleware.
- Add `express-rate-limit` on `/api/devices/*/toggle` and `/api/demo/*`.
- Restrict Discord bot commands to specific role IDs.
- Move token storage out of `.env` into a secret manager once outside hackathon
  context.

---

# 13. Performance Analysis

## 13.1 Backend hot paths

| Path                                           | Frequency                              | Cost                                       |
| ---------------------------------------------- | -------------------------------------- | ------------------------------------------ |
| `Simulator.tick()`                             | 5 s                                    | O(N) over 15 devices; near-zero.           |
| `SocketBroadcaster._recordEnergySample()`      | on every device change + 5 s heartbeat | O(N) + array push.                         |
| `SocketBroadcaster._emitDeviceScopedUpdates()` | on every device change                 | O(N × clients). Payload ~2 kB.             |
| `AlertEngine.evaluate()`                       | 10 s + every device change             | O(R × D + R × S) where R=3, D=5, S≤60.     |
| `IncidentAggregator.evaluate()`                | on every alert change                  | O(A).                                      |
| `HuggingFaceService.generateInsight`           | on power_anomaly open                  | Async, 35 s timeout, cached per signature. |

## 13.2 Frontend perf

- Render cost dominated by `OfficeLayout` SVG (~40 elements) and the Framer
  Motion animations (transform-only, compositor-friendly).
- No `useMemo` on derived arrays; harmless at N=15.
- Bundle size (rough estimate): `react-dom` (~40 kB) + `socket.io-client` (~35
  kB) + `framer-motion` (~50 kB) + app code (~15 kB) ≈ ~140 kB gz.

## 13.3 Caching

- **LLM insight cache** — Map(50) keyed by alert signature.
- **Frontend build cache** — Vite emits hashed asset filenames; nginx serves
  with default cache headers (no custom caching rules in `nginx.conf`).
- **Docker layer cache** — `COPY package*.json ./ && npm install` is cached
  before `COPY . .`.

## 13.4 Lazy loading

- No React `lazy()` / `Suspense` boundaries; single bundle.
- No dynamic imports; not needed at this app size.

## 13.5 Bottlenecks to watch

- **Broadcast fan-out.** `io.emit()` serialises payload once and sends to all
  sockets; at 1000 concurrent dashboards each event is ~2 kB × 1000 = 2 MB/s.
  Comfortable.
- **AlertEngine + on-every-change re-eval.** At 15 devices, negligible; at 15k
  it becomes O(15k) per tick — need indexed rule state.
- **HuggingFace timeouts.** 35 s per anomaly. Cache mitigates most calls.

## 13.6 Memory profile

- Long-lived arrays: `EnergyStore._samples` (cap 2880), `RoomSampleBuffer` (cap
  60/room), `AlertStore._byId` (cap 500 with LRU eviction).
- No unbounded arrays anywhere. No memory leaks expected.

## 13.7 CPU profile

- Steady-state CPU ≈ 0. Spikes when the LLM call fires (still tiny).

---

# 14. Deployment

## 14.1 Local development

```
# From workspace root
npm install                # installs all three workspaces
npm run dev                # backend + frontend in parallel
npm run dev:bot            # start bot separately
```

Backend defaults: `http://localhost:4000` (with `/api/health`, `/api/*`).
Frontend defaults: `http://localhost:5173` (Vite dev server).

## 14.2 Docker Compose

`docker-compose.yml` orchestrates three services on `monitor_network` (bridge):

- **`backend`** — `node:20-alpine`, `dumb-init`, non-root `node` user,
  `PORT=4000` inside the container (image sets `PORT=7860` for HuggingFace
  Spaces compatibility but compose overrides via `environment` block),
  healthcheck via `wget /api/usage`.
- **`frontend`** — Multi-stage: (1) `node:20-alpine` builds via `npm run build`
  with `VITE_BACKEND_URL` / `VITE_SOCKET_URL` build args, (2)
  `nginxinc/nginx-unprivileged:alpine` serves the dist on port `8080` inside →
  mapped to `5173:8080` on the host.
- **`bot`** — same base as backend, `pgrep node` healthcheck, no exposed ports
  (talks outbound to Discord + inbound over the compose network to
  `backend:4000`).

## 14.3 Environment variables

Root `.env.example` documents all vars; per-service `.env.example` files show
the subset each container reads.

| Var                                    | Consumed by    | Default                   | Purpose                                          |
| -------------------------------------- | -------------- | ------------------------- | ------------------------------------------------ |
| `PORT`                                 | backend        | 4000                      | HTTP + Socket.IO port                            |
| `HOST`                                 | backend        | 0.0.0.0                   | Bind address                                     |
| `CORS_ORIGIN`                          | backend        | `*`                       | Allowed origin                                   |
| `SIMULATOR_TICK_MS`                    | backend        | 5000                      | Simulator tick                                   |
| `MIN_DWELL_SECONDS`                    | backend        | 60                        | Anti-flap dwell                                  |
| `OFFICE_HOUR_START` / `_END`           | backend        | 9 / 17                    | Occupancy window                                 |
| `ROOM_ON_MAX_HOURS`                    | backend        | 2                         | Alert threshold                                  |
| `TARIFF_BDT_PER_KWH`                   | backend        | 7.0                       | Cost calc                                        |
| `HF_API_TOKEN`                         | backend        | –                         | HuggingFace router auth                          |
| `HF_MODEL`                             | backend        | Meta-Llama-3-8B           | Model id                                         |
| `VITE_BACKEND_URL` / `VITE_SOCKET_URL` | frontend build | localhost:4000            | Baked into bundle                                |
| `DISCORD_TOKEN`                        | bot            | –                         | Bot login                                        |
| `COMMAND_PREFIX`                       | bot            | `!`                       | Command prefix                                   |
| `ALERT_CHANNEL_IDS`                    | bot            | –                         | Comma-separated channel IDs for proactive alerts |
| `BACKEND_HTTP_URL` / `BACKEND_WS_URL`  | bot            | localhost:4000            | Backend location                                 |
| `OPENAI_API_KEY`                       | bot            | –                         | LLM auth (HF token also works)                   |
| `OPENAI_MODEL`                         | bot            | gpt-4o-mini               | Chat model                                       |
| `OPENAI_BASE_URL`                      | bot            | https://api.openai.com/v1 | LLM endpoint                                     |

## 14.4 CI/CD

**Absent.** No `.github/workflows`, no GitLab CI, no Fly.io / Vercel / Render
config. Deployment is manual (`docker compose up`) or through HuggingFace Spaces
(backend `Dockerfile` hints at Spaces compatibility via port 7860).

## 14.5 Scaling considerations

- **Single-instance only.** State lives in-process; horizontal scaling would
  require a shared store (Redis for state, adapter for Socket.IO).
- **Vertical scaling.** More CPU/RAM does nothing at this workload; the ceiling
  is bandwidth to connected clients.

---

# 15. Code Quality Review

## 15.1 Strengths

- **Composition root pattern** in `server.js` is textbook — every dependency is
  instantiated once and injected.
- **Pure functions everywhere they can be** (`powerService`, `energyService`,
  `officeHours`) — trivially testable.
- **Event-driven internals** — engines subscribe to stores rather than polling.
- **Graceful degradation** — every AI call falls back to a template if the API
  key is missing or the call fails.
- **JSDoc typing.** Every non-trivial class and function is JSDoc'd; VS Code
  hover shows inferred types even without TypeScript.
- **Deterministic signatures for alerts** — clean upsert semantics.
- **Envelope-standardised REST responses** via `apiResponse.js`.

## 15.2 SOLID scorecard

- **Single Responsibility** — mostly good; `SocketBroadcaster` does three things
  (energy sampling, buffer recording, emitting) that could be split. `App.jsx`
  does composition + simulation state + toast state.
- **Open / Closed** — services are open for extension via subclassing but no
  need has arisen.
- **Liskov** — no meaningful subclassing.
- **Interface Segregation** — N/A for JS; dependency objects are small and
  per-consumer.
- **Dependency Inversion** — well applied in the backend; frontend components
  depend on primitives.

## 15.3 DRY

- Some duplication:
  - Both `routes/index.js` and `middleware/errorHandler.js` define global error
    handlers; only the router version is wired.
  - `roomService` exports both function form and a class wrapping the same
    function.
  - `usageService` similarly exports both `buildUsageSnapshot` and a
    `UsageService` class.

## 15.4 Maintainability

- Small file sizes (rarely > 300 lines).
- Consistent naming; camelCase functions, PascalCase classes.
- Configuration is centralised; no scattered `process.env` reads after
  `config/index.js`.

## 15.5 Technical debt

| Debt item                                                                                        | Severity | Location                            |
| ------------------------------------------------------------------------------------------------ | -------- | ----------------------------------- |
| `middleware/errorHandler.js`, `requestLogger.js`, `validator.js` defined but never mounted       | Medium   | `app.js`, `routes/index.js`         |
| Two health-response shapes (`{status,uptime}` vs standard envelope)                              | Low      | `app.js`                            |
| Empty `backend/src/discord/` folder                                                              | Low      | —                                   |
| Redundant `office-power-monitor/` skeleton at repo root                                          | Low      | root                                |
| Doubled file extensions (`.ino.ino`, `.txt.txt`) in `hardware/`                                  | Cosmetic | `hardware/`                         |
| `README.md` still contains `via.placeholder.com` image URLs                                      | Low      | `README.md`                         |
| Alert Engine subscribes to _both_ `device:changed` and `devices:changed` — double eval per batch | Low      | `alertEngine.js#start`              |
| Mixed class + function service style                                                             | Low      | `services/*`                        |
| No test suite                                                                                    | Medium   | —                                   |
| No CI                                                                                            | Low      | —                                   |
| Wildcard CORS default                                                                            | Medium   | `config/index.js`                   |
| No auth on mutating routes                                                                       | High     | `devicesRouter.js`, `demoRouter.js` |

## 15.6 Code smells / anti-patterns

- `POST /api/simulate` accepts arbitrary client-provided device arrays and runs
  the alert engine on them — this is fine because the engine is stateless there,
  but it's a wide input surface with minimal validation.
- `alertStore._byId.size > 500 ⇒ evict oldest` is a lossy history — a real
  system would page to disk.

## 15.7 Suggested improvements (roadmap)

1. Add a `helmet` + `express-rate-limit` middleware layer.
2. Wire `errorHandler` and `requestLogger` middleware; remove the inline handler
   in `routes/index.js`.
3. Introduce a `HealthController` that also uses the envelope.
4. Introduce `vitest` and cover pure modules (`powerService`, `energyService`,
   `officeHours`, `alertStore`, `predictionEngine`).
5. Persist alerts + incidents to SQLite (with a swap-in adapter).
6. Move device catalog into a hot-reloadable JSON file.
7. Add a Prom exporter (`prom-client`) for room W, alert counts, LLM latencies.
8. Add a GitHub Actions workflow that runs lint + tests on PRs.
9. Refactor `services/` into either fully classes or fully functions.
10. Replace `via.placeholder.com` stubs in README with real screenshots.

---

# 16. Missing / Incomplete Features

Cross-referencing the challenge brief (`docs/API.md`, PDF pages 1–5) and
`README.md` claims against actual implementation.

## 16.1 Fully implemented and spec-compliant

- 3 rooms with 2 fans + 3 lights each (15 devices, 60 W / 15 W) — as of the
  correction applied earlier this session.
- Live device panel, live power meter (total + per-room), active alerts panel
  with timestamps.
- Discord commands: `!status`, `!room <name>`, `!usage` — including the spec
  example `!room work1` (via the alias resolver).
- Shared backend as source of truth for both dashboard and bot.
- Simulated data (status, wattage-when-on, room, `lastChanged`).
- Dashboard updates without manual refresh (Socket.IO).

## 16.2 Present but with caveats

- **Alert timestamping.** Timestamps are in ISO-8601 UTC; the dashboard shows
  them via `formatRelative()` — fine.
- **Anomaly rule severity.** Fires only when jump ≥ 45 W; small fluctuations
  never alert.
- **Proactive Discord alerts.** Fire on `incidents:update`, not raw alerts — so
  a "device on after hours" alone won't post unless it opens an incident (which
  it does, because it groups per room).

## 16.3 Missing per spec

- **Screenshots + demo GIF in README** — placeholders only.
- **Video demo (≤ 3 min)** — not present in repo.

## 16.4 Missing per README claims

- README mentions `hardware/wokwi/` subfolder — the actual layout is flat
  (`hardware/*.md`). Fixed in the last README update.
- README references `docs/system-diagram.png`, `docs/pin-mapping-table.md`,
  `docs/circuit-connection-list.md`, `docs/safety-notes.md` — these files do not
  exist.
- README references `docs/media/demo-end-to-end.gif` — only a `.gitkeep` in
  `docs/media/`.

## 16.5 Potential bugs

- **Global `.env` file at the repo root** is not loaded by anything; each
  workspace reads its own `.env` next to `package.json`.
- **`errorHandler` middleware unused** — 500 responses skip the logger's
  structured logging.
- **Alert engine subscribing to both device events** double-fires on batches —
  idempotent but wasteful.
- **`ecoModeEngine._evaluate()` uses `Date.now()` directly**, not the injected
  clock — impossible to test time-travel.
- **`getEnergyTodayKwh()` day-rollover bug** — resets at local midnight of the
  _server_, which may not match the user's timezone.

## 16.6 Nice-to-haves not attempted

- Historical charts (24-h line graph).
- CSV export.
- Multi-office (multi-tenant) support.
- User-configurable alert thresholds through the UI.
- Discord slash commands (currently prefix commands only).
- ESP32 real-hardware integration test with the simulator swap.

---

# 17. 100 Technical Questions with Ideal Answers

The following 100 questions are grouped by topic and phrased at staff-engineer
interview difficulty. Answers are grounded strictly in this repository.

## Architecture & Design (Q1–Q15)

**Q1. Why is the backend a single Node.js process instead of separate
microservices per subsystem (simulator, alerts, incidents, socket)?** A. The
hackathon-scope workload is trivially small (15 devices, sub-KB payloads).
Keeping everything in-process eliminates network hops between tightly coupled
components that all read the same state, removes the need for a message broker,
and makes every subscribe/emit a synchronous `EventEmitter` call. A
microservices split would only pay off if state were partitioned across
independently scalable domains — which it is not.

**Q2. Why is `EventEmitter`-based pub/sub used internally instead of directly
invoking subscriber methods?** A. It preserves decoupling: `DeviceStore` doesn't
need to know about `AlertEngine`, `SocketBroadcaster`, or `EnergyStore`. New
subscribers can attach without changing the store. It also makes each subscriber
independently testable — swap the store for a stub that emits the same events.

**Q3. Explain the composition-root pattern used in `server.js`.** A. A single
function (`bootstrap()`) constructs every collaborator with the right
dependencies in the right order, then wires listeners and starts long-running
loops. All other files are pure definitions of classes or factories; they
perform no I/O and hold no global state themselves. This keeps object graphs
deterministic and testable.

**Q4. Why are stores exposed both as classes and as singletons in
`store/index.js`?** A. The classes let tests construct isolated instances (with
injected clocks). The singletons let ad-hoc callers (e.g., the discord folder if
it were populated) reach the "one true store" without threading it through every
argument list.

**Q5. Why is the `Simulator` decoupled from clock and RNG?** A. Its constructor
takes optional `now` and `random` functions. In tests you can inject
deterministic values to prove that a specific sequence of random rolls at
specific times produces the expected batch of updates.

**Q6. What is the ordering of `start()` calls in `server.js` and why?** A.
Subscribers first, producers last. `incidentAggregator.start()` and
`broadcaster.start()` attach listeners; `alertEngine.start()` also attaches.
Only then does `simulator.start()` begin mutating state. This guarantees no
event is missed.

**Q7. Why do you `unref()` the interval timers?** A. `unref()` tells Node's
event loop that this timer should not by itself keep the process alive. If all
other work is done, Node will exit. Useful in tests and in shutdown paths.

**Q8. Why is the `AlertEngine` an "upsert + resolveMissing" model rather than
"insert new alerts and mark old ones resolved"?** A. It makes the store
idempotent — running `evaluate()` a hundred times with unchanged state produces
the same set of active alerts. Signatures (e.g., `room-on-too-long:work-room-1`)
uniquely name a condition, so the same condition doesn't duplicate.

**Q9. Why per-room incident grouping instead of per-signature?** A. Users care
about "what's wrong in Work Room 1" more than "which of my three alerts about
Work Room 1 fired". A single active incident per room is the correct grain for
both the dashboard incident panel and the Discord alert channel.

**Q10. How does the `SocketBroadcaster` guarantee late-joining clients see
consistent state?** A. On `socket.on('connection', ...)` it immediately emits
full snapshots of every stream (`devices`, `rooms`, `usage`, `alerts`,
`incidents`) so new clients don't need to wait for the next change.

**Q11. Why is `usage:update` also driven by a 5-second heartbeat?** A. Even when
no device changes, energy is still integrating and cost is still ticking. A
heartbeat keeps the kWh figure alive on the UI.

**Q12. Explain the trapezoidal integration in `EnergyStore.record()`.** A.
Between two samples `(t₀,W₀)` and `(t₁,W₁)`, the trapezoidal rule approximates
energy as `((W₀+W₁)/2) × (t₁-t₀)`. Summing these increments (converted from
watts × ms to watt-hours) approximates the integral without needing evenly
spaced samples.

**Q13. What is `RoomSampleBuffer` for, and how does the AlertEngine use its
statistics?** A. It holds a bounded rolling window of per-room W readings. The
AlertEngine reads up to 60 samples (excluding the latest) to compute a mean and
stddev baseline, then flags an anomaly if the latest sample is

> mean + 2σ **and** the absolute jump ≥ 45 W.

**Q14. Why is a 45 W minimum jump required in addition to the σ threshold?** A.
When the baseline is near zero (e.g., empty room), stddev is also near zero, so
any tiny sample can be dozens of stddevs away. Requiring a 45 W jump prevents
the anomaly from firing on turning on a single 15 W light in an otherwise empty
room.

**Q15. Why does the LLM insight generator use fire-and-forget rather than
blocking `evaluate()`?** A. LLM latencies can reach tens of seconds. Blocking
`evaluate()` would freeze the alert loop and hold onto memory. Fire-and-forget
attaches the insight later via `attachInsight(sig, text)`, which emits
`alerts:changed` and refreshes the UI when it arrives.

## State & Data (Q16–Q28)

**Q16. Why in-memory instead of a database?** A. The hackathon spec explicitly
allows an in-memory store, and the data volume is trivial. Skipping a database
saves setup cost and matches the "single source of truth" requirement.

**Q17. What happens on backend restart?** A. All state (devices, energy, alerts,
incidents, buffers) resets. Devices reboot to "off"; energyToday zeroes; no
historical alerts survive. Only the static catalog persists (because it's in
code).

**Q18. How is deterministic ordering achieved in `getAllDevices()`?** A. Devices
are inserted into a `Map` in the order returned by `buildDeviceCatalog()`; `Map`
preserves insertion order in JS.

**Q19. Why does `getAllDevices()` return spreads instead of stored objects?** A.
Defensive copies: callers can mutate the returned objects without corrupting the
store. This is a poor man's immutability without pulling in Immer.

**Q20. Explain the `applyBatch` vs single-update event semantics.** A.
`updateDevice` emits `device:changed`. `updateMultipleDevices` calls
`updateDevice` per item (each firing `device:changed`) and then a single
`devices:changed` for the batch. Subscribers can pick their granularity.

**Q21. What is `MIN_DWELL_SECONDS` and why 60 s?** A. A minimum time each device
must remain in its current state before it can flip again. Prevents rapid on/off
flapping and matches human-scale switching behaviour.

**Q22. How does energy roll over at midnight?** A. `EnergyStore.record()`
computes a local-time day key; if it doesn't match `_dayKey`, the accumulator is
reset. Only local timezone; UTC users beware.

**Q23. Explain the alert store's LRU garbage collection.** A. `_byId` (all
history) is capped at 500. On the 501st insert, the oldest entry (by Map
iteration order) is deleted. This bounds memory but loses history.

**Q24. Why is `_activeBySig` a separate Map from `_byId`?** A. Two access
patterns coexist: "is this signature already active" (O(1) lookup by signature)
and "list all history for the dashboard" (iterate all). Separate maps keep both
O(1)/O(N) respectively without joins.

**Q25. Why does `IncidentAggregator._buildTitle` sort kinds alphabetically?** A.
Deterministic titles avoid spurious "updated" events when the same alert set is
passed in different order.

**Q26. What is `RoomSampleBuffer.getStats()` used for and why 3 minimum
samples?** A. It exposes mean/stddev/latest for the frontend or debugging. The 3
minimum prevents division-by-zero-ish edge cases when the buffer is still
filling.

**Q27. What guarantees are provided by returning shallow copies from
`getActive()` and `getAll()` on the alert store?** A. The returned objects can
be mutated by consumers (e.g., serialised, patched with a display flag) without
polluting the internal state.

**Q28. Why does the AlertEngine track `_roomAllOnSince` in its own `Map` rather
than in the store?** A. It's engine-owned state — a rolling timer that's only
meaningful inside the "room has been fully on for X hours" rule. Keeping it out
of the store keeps the store's schema clean.

## Simulation (Q29–Q35)

**Q29. Explain the transition probabilities in `officeHours.js`.** A. In office
hours: OFF→ON 0.35, ON→OFF 0.05 (bias toward ON). Out of office hours: OFF→ON
0.03, ON→OFF 0.4 (bias toward OFF). Asymmetric so the office reaches
predominantly-ON by mid-morning and predominantly-OFF within ~20 minutes of
closing.

**Q30. What is the expected time-to-turn-off for a single device after 5 PM at 5
s ticks with p=0.4?** A. Geometric distribution with success probability 0.4
gives mean 1/0.4 = 2.5 ticks ≈ 12.5 seconds _after the dwell time expires_.
Adding the 60 s dwell means ~72 s worst-case, ~60 s best-case.

**Q31. Why is dwell time enforced by the simulator, not the store?** A. The
store is a plain container; the simulator is where the "rules of physics" live.
The store still records `lastChanged` so the simulator can compute dwell.

**Q32. How would you swap the simulator for a real hardware feed?** A. Replace
`Simulator` with a WebSocket/MQTT subscriber that calls
`deviceStore.updateDevice(id, status)` on hardware events. No other file needs
to change — the store is the API.

**Q33. What does `POST /api/simulate` do differently from the real simulator?**
A. It runs _stateless_ — it constructs a `MockDeviceStore` around a
client-provided device array, runs `AlertEngine.evaluate()` once, and returns
the projected alerts + savings. No real state changes.

**Q34. What is the failure mode if `SIMULATOR_TICK_MS` is set to `0`?** A.
`setInterval(fn, 0)` still schedules the callback on the next tick; the loop
would consume the event loop with as many ticks as it can, choking every other
subsystem.

**Q35. Why isn't there a "warm-up" period before the alert engine starts
checking anomalies?** A. The anomaly rule already requires ≥ 3 samples in the
buffer before firing, effectively providing the warm-up.

## API & Web (Q36–Q50)

**Q36. Why `POST /api/devices/:id/toggle` instead of `PATCH /api/devices/:id`?**
A. Toggle is a _derived_ operation — the caller doesn't specify the target
status, it's inferred as the opposite. PATCH would suggest a partial state
update; POST-toggle-as-verb is honest.

**Q37. What does the response envelope look like on success and error?** A.
Success: `{ success: true, data: <payload> }`. Error:
`{ success: false, error: { message, code } }`.

**Q38. Which endpoint deviates from the envelope and why?** A. `GET /api/health`
returns `{ status: 'ok', uptime }` — legacy shape established before the
envelope was introduced. Would be cleaned up in a v2 API.

**Q39. Where is the CORS origin configured?** A. `backend/src/config/index.js`
reads `CORS_ORIGIN` (default `*`); `app.js` applies it via
`app.use(cors({ origin: config.corsOrigin }))`.

**Q40. How does `useLiveData()` avoid setting up multiple Socket.IO
connections?** A. The effect array is `[]`; the socket is created once for the
lifetime of `App`. Cleanup calls `socket.close()`.

**Q41. Why include the `snapshot:update` event handler in `useLiveData` if the
backend never emits it?** A. Defensive future-proofing — if the backend
introduces a single snapshot event, the hook already handles it as a wholesale
state patch.

**Q42. What does the frontend do if `import.meta.env.VITE_BACKEND_URL` is
unset?** A. Falls back to `http://localhost:4000` (per `useLiveData.js` and
`RoomCard.jsx`).

**Q43. Explain the optimistic-UI story for `DeviceChip.handleToggle`.** A. It's
_not_ optimistic — it fires the POST, waits for the reply, but counts on the
imminent `devices:update` Socket.IO event to reflect the truth. `pending` state
disables the button momentarily.

**Q44. Why does the click handler in `OfficeLayout` behave differently in sim
mode vs live mode?** A. In sim mode, clicking a device only mutates the
frontend's `simulatedDevices` state (used to preview savings). In live mode it
selects the device for the detail modal — the actual toggle happens via the
`RoomCard` chip.

**Q45. How does the Socket.IO server tell Socket.IO clients which transports to
negotiate?** A. Handshake response. The client requests
`transports: ['websocket','polling']`; both server and client negotiate
WebSocket first, falling back to XHR long-polling if WebSocket is blocked.

**Q46. What is the meaning of `EcoToast`'s `dismissed` set living in
`App.jsx`?** A. React state; when an eco notification's id is added, the toast
is filtered out of `visibleEcoNotifications`. This keeps toasts locally
dismissible without any server persistence.

**Q47. What happens if the alert engine attaches an AI insight after the
incident aggregator has already emitted its update?** A.
`alertStore.attachInsight()` calls `emitChanged()`, which emits a new
`alerts:changed` event. The broadcaster picks it up and emits `alerts:update`;
the frontend rerenders. Because the alert already belongs to an active incident,
the incident payload will now include the insight when the frontend joins them
client-side.

**Q48. How is CSRF handled?** A. It isn't — every mutating endpoint is a plain
POST with no CSRF token. Acceptable for a token-less hackathon demo; a
production deployment behind auth would need CSRF or SameSite cookies.

**Q49. What HTTP verbs mutate state?** A. Only `POST /api/devices/:id/toggle`,
`POST /api/demo/:scenario`, and `POST /api/simulate`. Everything else is `GET`.

**Q50. Why does the frontend not need to poll for `energyTodayKwh` updates?** A.
The broadcaster's 5 s heartbeat re-emits `usage:update` even when no device
changes.

## Discord Bot (Q51–Q60)

**Q51. Which Discord gateway intents are required and why?** A. `Guilds`,
`GuildMessages`, `MessageContent`, `DirectMessages`. Message Content is a
_privileged intent_ — required so the bot can read the raw text of user commands
(not just prefixed slash commands).

**Q52. How does the bot avoid replaying historical incidents on restart?** A. On
first `incidents:update`, it seeds `knownIncidentIds` with every current
incident and sets `bootstrapped = true` without posting. Only truly new
incidents (active + unseen) trigger channel posts.

**Q53. What is the fallback chain when the LLM is unavailable?** A. `polish()`
catches the error and returns the raw template from `formatters.js`. The user
still gets a correct answer, just less conversational.

**Q54. How is prompt-injection protected against in `!ask`?** A. The system
prompt strictly scopes the bot to office topics and forbids state mutations.
Tool handlers are hardcoded and don't accept free-form arguments. The model
can't ask to run a fifth tool.

**Q55. What limits the number of LLM iterations per `!ask`?** A.
`maxIterations = 2` chat/completions turns, plus one final "please summarise"
turn if tool calls are still pending. Prevents runaway tool-loop billing.

**Q56. What does `!room work1` resolve to and why?** A. The alias table maps
normalised `work1` → `work-room-1`, matching the deterministic device catalog
room ID. The alias resolver strips spaces/underscores/hyphens before lookup.

**Q57. Why does `alertRelay.js` filter by `inc.status === 'active'`?** A.
Resolved incidents can still appear in the payload — the relay must post only
new _active_ ones.

**Q58. How is the bot deployed without an HTTP surface?** A. Its Dockerfile
healthcheck runs `pgrep node`. Docker restarts the container if the Node process
dies.

**Q59. How does `apiClient.get()` behave when the backend returns 500?** A. It
throws `Error("Backend ${path} failed: 500 ${statusText}")`. The caller inside
`commands.js` propagates the throw; the outer `try/catch` in `index.js` catches
and replies `"Command failed: <message>"`.

**Q60. What data does `!usage` return?** A. Current W, energy today kWh + BDT
cost, projected monthly BDT, counts of active/inactive devices, W per room, W
per type.

## Frontend (Q61–Q75)

**Q61. Why no state-management library?** A. All shared state comes from one
hook (`useLiveData`) that spans one tree; prop drilling depth is small.
Redux/Zustand would be overkill.

**Q62. How does Framer Motion handle the fan spinning speed?** A. `FanIcon`
accepts a `wattage` prop; internally it derives an animation duration inversely
proportional to wattage (higher wattage → faster spin) and applies it as a
Framer Motion `transition.duration`.

**Q63. How does the office floor plan compose room + device positions?** A.
`roomSlots` array defines global room x/y/width/height. `lightSlots` and
`fanSlots` define local coordinates inside a room. The renderer combines:
`slot.x + local.x`, `slot.y + local.y`.

**Q64. What is the purpose of the `mask` elements in the SVG?** A. Cuts door
gaps into the room walls (`door-mask-${slot.id}`) and the main entry gap in the
outer building outline (`main-entry-mask`).

**Q65. What accessibility support does the dashboard provide?** A. Semantic
buttons, focus rings, aria labels on the floor plan; icon buttons carry text; no
colour-only status indicators. Missing: `prefers-reduced-motion` fallback,
aria-live region for alerts.

**Q66. How is the dashboard hosted in production?** A. Vite `npm run build`
emits static files into `dist/`; the multi-stage Docker image copies them into
an `nginx-unprivileged:alpine` container listening on port 8080, mapped to host
port 5173.

**Q67. Why is `nginx-unprivileged` used?** A. It runs as a non-root user inside
the container, reducing blast radius if the container is compromised.

**Q68. How does the dashboard know backend Socket.IO URL at build time?** A.
`VITE_SOCKET_URL` is a build-time env var baked into the bundle by Vite.
Changing it requires a rebuild.

**Q69. What is the "Digital Twin" mode?** A. Frontend-only: deep-clone current
devices, let the user toggle them on the floor plan, POST the alternate state to
`/api/simulate`, and render projected savings + alerts. Live state is untouched.

**Q70. Why is `React.memo` not used anywhere?** A. Component trees are shallow
and inputs change frequently on every tick — memoisation would waste CPU on
stale-cache comparisons.

**Q71. How would you add a chart of "power over the last hour"?** A. Backend
already emits `usage.samples` (up to 2880 samples). Add a chart component (e.g.,
Recharts or a hand-rolled SVG polyline) that consumes `usage.samples`.

**Q72. What is a `useId()` used for in `OfficeLayout`?** A. Generates stable,
unique SVG element IDs (`floor-grid-${uid}`, `light-bloom-${uid}`, etc.) so
multiple instances in the same document won't collide.

**Q73. What defensive coding prevents the sparkline from crashing on empty
samples?** A. `if (!samples || samples.length < 2) return null;` early return.

**Q74. What triggers a re-render of `RoomCard`?** A. Any change to the `room`
object it receives as a prop — which happens on every `rooms:update` event
because a new snapshot object is built server-side.

**Q75. How is the dashboard tested?** A. It isn't (no unit or e2e tests in the
repo). Manual QA only.

## AI / ML (Q76–Q83)

**Q76. Why cache LLM insights per signature?** A. LLM calls are slow (seconds)
and quota-limited. The same active condition doesn't need a new insight until it
resolves and reopens.

**Q77. What limits the caches size and what happens on overflow?** A. Capped at
50; oldest key is deleted (FIFO, not true LRU) when a new insight is added.

**Q78. How is the LLM prompt protected from user input?** A. The prompt is built
entirely from server-controlled variables (room name, current W, baseline,
tariff). No user string is interpolated.

**Q79. What model does the prediction engine use?** A. A hand-tuned logistic
regression with 4 features and a sigmoid activation. Not trained from data;
weights are heuristics.

**Q80. Why does the prediction engine include `officeHours` as a feature?** A.
It gives a strong prior — even a fully-off room is very likely occupied during
office hours; adding this feature stabilises daytime predictions.

**Q81. How would you evaluate the prediction engine?** A. Instrument a labelled
ground-truth stream (motion sensor or manual tags), then compute confusion
matrix / precision / recall / F1. Sweep threshold from 0 to 1 to find operating
point.

**Q82. How does the eco engine avoid repeated shutdowns of the same room?** A.
`_shutdownThisWindow` set records rooms already shut down in the current
unoccupied window. Reset happens only when the room re-enters "occupied or
empty".

**Q83. How would you replace the hand-tuned weights with learned ones?** A.
Collect a dataset of `(features, occupied?)` pairs, fit a scikit-learn
`LogisticRegression`, export coefficients, and drop them into `this._weights`.
No structural change to the code.

## Security (Q84–Q90)

**Q84. Which endpoints mutate state without auth?** A.
`POST /api/devices/:id/toggle`, `POST /api/demo/:scenario`, `POST /api/simulate`
(returns simulation, but accepts arbitrary array).

**Q85. What is the risk of `POST /api/demo/everything-off` being public?** A.
Anyone on the network can seed 12.4 kWh into `energyStore` and turn all devices
off, distorting readings and firing spurious `alerts:update`.

**Q86. How would you add API key auth?** A. Introduce middleware:
`(req,res,next)=>req.headers['x-api-key']===process.env.API_KEY?next():res.status(401)`.
Mount on every mutating route.

**Q87. Are the JWT tokens used anywhere?** A. No — no authentication of any
kind.

**Q88. Are secrets ever logged?** A.
`logger.info('Backend listening', {host, port})` is the only startup log;
secrets are not logged. HuggingFace errors include response body truncated to
200 chars — theoretically could echo back a token if the server did so.

**Q89. What DoS surfaces exist?** A. Flood `POST /api/devices/:id/toggle` (fires
WebSocket broadcasts to all clients). Open thousands of Socket.IO connections.
Trigger the LLM insight generator by seeding rapid anomalies (each with its own
signature would evict cache and hit the API repeatedly).

**Q90. What's the mitigation plan for the DoS surfaces?** A. Add
`express-rate-limit` per IP; cap Socket.IO connections in `SocketIOServer`
options; add an in-memory rolling cap on LLM calls per minute; centralise a
queue in front of `HuggingFaceService`.

## Performance & Ops (Q91–Q100)

**Q91. What's the CPU cost per second at steady state?** A. Simulator tick every
5 s over 15 devices ≈ 15 RNG rolls + one `applyBatch` (Map iteration).
Broadcaster heartbeat every 5 s ≈ one serialisation of ~2 kB payload.
Effectively nothing.

**Q92. How large is the broadcast payload per client per event?** A.
`devices:update` ≈ 1–2 kB, `usage:update` ≈ 1 kB, `rooms:update` ≈ 2 kB. At 5 s
cadence, each client uses < 1 kB/s downstream.

**Q93. What limits horizontal scaling?** A. In-process state. Two backends would
each simulate independently and serve inconsistent snapshots. A Socket.IO Redis
adapter + shared store would be needed.

**Q94. What is the healthcheck strategy in Docker?** A. Backend:
`wget --spider http://localhost:7860/api/usage`. Frontend:
`wget --spider http://localhost:8080/`. Bot: `pgrep node`.

**Q95. Which container runs as root?** A. None. Backend and bot use `USER node`;
frontend uses `nginx-unprivileged`.

**Q96. What signal-handling exists?** A. Backend + bot use `dumb-init` in the
Dockerfile so SIGTERM propagates to the Node child, which handles SIGINT/SIGTERM
in-process to shut down subsystems cleanly.

**Q97. How is logging structured?** A. Custom `logger.js` writes lines of the
form `[ISO] [LEVEL] msg {"meta":"..."}` to stdout. Docker captures stdout;
`docker logs office_monitor_backend -f` streams them.

**Q98. What happens if `HF_API_TOKEN` is missing?** A. `HuggingFaceService`
short-circuits — `generateInsight()` returns `null` immediately, no HTTP call is
made. The dashboard renders alerts without the insight card.

**Q99. How is dependency vulnerability tracking handled?** A. No `npm audit` is
committed and no Dependabot config is present. A lockfile is present, so
vulnerabilities can be checked manually.

**Q100. What's the minimum change required to persist alerts across restarts?**
A. Introduce a `PersistedAlertStore` decorator that mirrors every `upsert` /
`resolveMissing` into SQLite (via `better-sqlite3` for sync writes), and load
active alerts back into memory in the constructor. No consumer needs to change
because the store's public API is unchanged.

---

## Appendix A — File → line-count map (approx.)

| File                                          | Approx. lines | Function                    |
| --------------------------------------------- | ------------- | --------------------------- |
| `backend/src/server.js`                       | 130           | Composition root            |
| `backend/src/app.js`                          | 25            | Express factory             |
| `backend/src/config/index.js`                 | 45            | Runtime config              |
| `backend/src/config/devices.js`               | 55            | Static catalog              |
| `backend/src/store/deviceStore.js`            | 300           | Device state                |
| `backend/src/store/energyStore.js`            | 100           | Energy integrator           |
| `backend/src/store/roomSampleBuffer.js`       | 90            | Per-room baseline           |
| `backend/src/simulator/simulator.js`          | 100           | Tick loop                   |
| `backend/src/simulator/officeHours.js`        | 55            | Probability model           |
| `backend/src/alerts/alertEngine.js`           | 250           | Rule evaluator              |
| `backend/src/alerts/alertStore.js`            | 200           | Signature-keyed alert store |
| `backend/src/incidents/incidentAggregator.js` | 200           | Group by room               |
| `backend/src/services/*`                      | 800 total     | Service layer               |
| `backend/src/routes/*`                        | 250 total     | REST routers                |
| `backend/src/sockets/socketBroadcaster.js`    | 150           | Realtime fan-out            |
| `backend/src/utils/*`                         | 60 total      | Response + logger           |
| `frontend/src/App.jsx`                        | 130           | Composition + sim mode      |
| `frontend/src/hooks/useLiveData.js`           | 65            | Socket.IO subscription      |
| `frontend/src/components/OfficeLayout.jsx`    | 700+          | SVG floor plan              |
| `frontend/src/components/RoomCard.jsx`        | 350           | Room card + chip            |
| `frontend/src/components/*`                   | 1000+ total   | Other UI                    |
| `bot/src/index.js`                            | 90            | Bot bootstrap               |
| `bot/src/commands.js`                         | 130           | Command registry            |
| `bot/src/llm.js`                              | 200           | Polish + tool loop          |
| `bot/src/alertRelay.js`                       | 100           | Socket → Discord            |
| `bot/src/apiClient.js`                        | 55            | HTTP client                 |
| `bot/src/formatters.js`                       | 100           | Templates                   |

## Appendix B — Environment variable matrix

See §14.3 for a full table.

## Appendix C — Reserved for future analysis

Space for revision notes when the codebase changes materially.

---

_End of PROJECT_ANALYSIS.md._
