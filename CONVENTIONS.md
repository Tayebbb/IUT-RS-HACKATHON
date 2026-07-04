# Coding Conventions

Shared coding standards for all workspaces in the Office Power Monitor monorepo.

---

## Language

- **JavaScript only** — no TypeScript. All types are documented with JSDoc.
- **CommonJS** (`require` / `module.exports`) in `backend/` and `bot/`.
- **ES Modules** (`import` / `export`) in `frontend/`.
- Target runtime: **Node.js ≥ 20** for backend/bot, modern evergreen browsers
  for frontend.

---

## Formatting

Managed by **Prettier**. Run `npm run format` from the repo root.

| Rule            | Value              |
| --------------- | ------------------ |
| Quotes          | Single (`'`)       |
| Semicolons      | Yes                |
| Print width     | 100 characters     |
| Tab width       | 2 spaces (no tabs) |
| Trailing commas | None               |
| Line endings    | LF                 |

> **Never hand-format code.** Let Prettier do it.

---

## Linting

Managed by **ESLint 9** (flat config). Run `npm run lint` from the repo root.

Key rules:

| Rule                          | Level | Rationale                   |
| ----------------------------- | ----- | --------------------------- |
| `prefer-const`                | error | Prevent accidental mutation |
| `no-var`                      | error | Always use `const` / `let`  |
| `eqeqeq`                      | error | No `==` coercion bugs       |
| `no-unused-vars`              | error | Dead code indicator         |
| `object-shorthand`            | error | Cleaner object literals     |
| `react-hooks/rules-of-hooks`  | error | React correctness           |
| `react-hooks/exhaustive-deps` | warn  | Hook dependency tracking    |

---

## Naming

| Context                          | Convention               | Example                             |
| -------------------------------- | ------------------------ | ----------------------------------- |
| Variables / functions            | camelCase                | `deviceStore`, `getByRoom`          |
| Classes                          | PascalCase               | `DeviceStore`, `AlertEngine`        |
| Constants (primitive, top-level) | SCREAMING_SNAKE          | `WATTAGE`, `ROOMS`                  |
| React components                 | PascalCase               | `RoomCard`, `SummaryCards`          |
| React hooks                      | `use` prefix + camelCase | `useLiveData`                       |
| Files — backend/bot              | camelCase                | `deviceStore.js`, `alertEngine.js`  |
| Files — frontend components      | PascalCase               | `RoomCard.jsx`, `Header.jsx`        |
| Files — frontend hooks/utils     | camelCase                | `useLiveData.js`, `format.js`       |
| Env variables                    | SCREAMING_SNAKE          | `SIMULATOR_TICK_MS`                 |
| Socket.IO event names            | `noun:verb`              | `devices:update`, `alerts:update`   |
| REST routes                      | kebab-case               | `/api/devices`, `/api/room-summary` |

---

## File & Folder Structure

### Backend

```
backend/src/
  config/        Environment config + static device catalog
  store/         In-memory state (DeviceStore, EnergyStore)
  simulator/     Tick-based device state generator
  services/      Pure read-only business logic (power, rooms, usage, energy)
  alerts/        AlertEngine + AlertStore
  incidents/     IncidentAggregator + IncidentStore
  routes/        Express routers — thin controllers only
  sockets/       Socket.IO broadcaster
  utils/         Shared utilities (logger, etc.)
```

**Rules:**

- Every subfolder has a barrel `index.js` that re-exports its public API.
- Routers contain **no business logic** — they call services and return JSON.
- Stores hold state; services compute views over that state.

### Frontend

```
frontend/src/
  components/    Presentational React components (no data fetching)
  hooks/         Custom React hooks (data fetching, subscriptions)
  pages/         Page-level components assembled from smaller pieces
  lib/           Pure utility functions (no React)
  assets/        Static images, fonts, icons
```

**Rules:**

- Components receive all data via props.
- Data fetching / socket subscriptions live in hooks only.
- No inline styles — use Tailwind utility classes.
- Framer Motion variants defined at component scope, not globally.

### Bot

```
bot/src/
  commands.js    Command handler dispatch
  apiClient.js   HTTP client for backend REST API
  alertRelay.js  Socket.IO listener → Discord channel relay
  formatters.js  Message formatting helpers
  llm.js         Optional OpenAI polishing (with deterministic fallback)
  config.js      Env-based config
  index.js       Bot entry point + graceful shutdown
```

---

## Comments & Documentation

- **JSDoc** on every exported class, method, and function.
- Include `@param`, `@returns`, and `@typedef` where helpful.
- Inline comments explain **why**, not **what** (the code shows what).
- No commented-out code in commits.

```js
/**
 * Compute the total instantaneous power draw across all ON devices.
 * @param {Device[]} devices
 * @returns {number} Power in watts.
 */
function computeTotalPower(devices) {
  return devices.reduce((sum, d) => sum + d.power, 0);
}
```

---

## Error Handling

- **Backend routes**: wrap async handlers; return structured JSON errors:
  ```json
  { "error": "Device not found", "code": "DEVICE_NOT_FOUND" }
  ```
- **Bot**: every command handler has a try/catch; on failure, send a user-facing
  error message.
- **Frontend**: handle socket disconnect gracefully (show "Reconnecting…"
  state).
- Never swallow errors silently — always log at minimum.

---

## Git Conventions

### Branch naming

```
feat/<short-description>
fix/<short-description>
chore/<short-description>
docs/<short-description>
```

### Commit messages (Conventional Commits)

```
feat(backend): add usage history endpoint
fix(frontend): correct energy Wh display precision
chore(root): add Prettier config
docs(api): document /api/incidents endpoint
```

### PR checklist

- [ ] `npm run lint` passes with 0 warnings
- [ ] `npm run format:check` passes
- [ ] No `.env` files committed
- [ ] JSDoc on all new public APIs
- [ ] README updated if the public interface changed

---

## Environment Variables

- **Never hard-code** secrets, ports, or URLs in source code.
- All config goes through the workspace's `config.js` / `config/index.js`.
- Keep `*.env.example` files up to date whenever a new variable is added.

---

## Dependency Policy

- Prefer the **smallest dependency** that solves the problem.
- No transpilers (Babel, TypeScript compiler) — native JS only.
- Frontend: allowed (`react`, `react-dom`, `framer-motion`, `socket.io-client`,
  Tailwind, Vite plugin).
- Backend: allowed (`express`, `socket.io`, `cors`, `dotenv`).
- Bot: allowed (`discord.js`, `dotenv`, `socket.io-client`, `openai` optional).
- All other deps require team discussion before adding.
