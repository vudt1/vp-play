# AGENTS.md — VP Play

Instructions for AI coding agents working in this repository. Read this file before changing code.

## Project

**VP Play** is a small internal LAN entertainment portal: Express portal + Socket.IO realtime + one mini-game **Tiến Lên Miền Nam** (Phaser). Scale: **3 fixed rooms**, **max 4 players per room**, **2–4 humans** (no bots).

Product research lives in `spec/` (`codebase_init.md`, `logic_game.md`). Runtime code is not there.

Domain vocabulary: `CONTEXT.md`. Architectural decisions: `docs/adr/`.

## Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | Node.js | Single process |
| HTTP | Express | REST + static + EJS |
| Views | EJS | Portal SSR |
| Client portal | Alpine.js | Login, lobby, ranking |
| Auth | Keycloak-js (browser) + JWT verify (server) | Id: `KEYCLOAK_ID_CLAIM` (default `pccuid`); display: `KEYCLOAK_DISPLAY_NAME_CLAIM` (default `preferred_username`) |
| Realtime | Socket.IO | Room/hand events; auth on handshake |
| Game client | Phaser 3 | `public/modules/tienlen/`, loaded in **iframe** |
| DB | SQLite via `better-sqlite3` | WAL; file under `database/` |
| Config | `dotenv` | `.env.development` / `.env.production` via `VP_ENV`; see `.env.*.example` |

**Do not add** without an explicit human decision: ORM, Redis, formal FSM library, GraphQL, monorepo tooling, second mini-game framework, Tailwind/PostCSS bundler (portal CSS stays hand-written; Tailwind deferred).

## Repository map

- `server.js` — process entry: HTTP server, view engine, static, Socket.IO attach
- `src/domain/` — **pure** card/combo/rules/deal/scoring (no I/O, no Socket, no Express)
- `src/rooms/roomTable.js` — in-memory rooms/seats/hand phase (deep module; test without Socket)
- `src/sockets/` — thin adapters: auth middleware, event names, broadcast
- `src/auth/`, `src/services/`, `src/controllers/` — Keycloak verify, user sync, ranks
- `src/views/` — EJS portal templates
- `public/` — CSS + mini-game static assets
- `assets/card/svg/` — source card SVGs (copy or link into game assets)
- `tests/` — prefer domain + roomTable unit tests
- `spec/` — design notes only

## Commands

- `npm run dev` — development (`VP_ENV=development` → `.env.development`)
- `npm start` — production (`VP_ENV=production` → `.env.production`)
- `npm test` — unit tests (`node --test`)

## Deploy / APP_PREFIX

- Nginx may serve the app under a public prefix (e.g. `https://host/play/`) with **strip** `proxy_pass http://localhost:3000/;` so Express still mounts at `/`.
- Set `APP_PREFIX=/play` so SSR and clients emit public URLs and Socket.IO client `path` `/play/socket.io`. Server Socket.IO stays at `/socket.io`.
- Inject `window.VP_BASE`; do not rely on `<base href>` alone for root-absolute paths.
- Secrets: never commit `.env*` with real tokens (examples only).

## Architecture rules (non-negotiable)

1. **Deep modules**: small interface, hide complexity. Prefer pure functions in `src/domain/` tested through their public interface.
2. **Seams**: Socket.IO and Express are **adapters**. Game rules and room transitions live outside them. Do not put combo validation only inside socket handlers.
3. **One adapter ≠ port**: only introduce a port/interface when two adapters exist (e.g. real JWT verifier + test stub).
4. **No formal FSM library.** Use `phase` enums (`idle | waiting | playing | settling`) and explicit handler guards.
5. **MVP rules only (Classic core):** singles/pairs/triples/quads, straights (≥3, no 2s), 3/4 consecutive pairs (no 2s), same-shape beat, specials (tứ quý / 3 đôi thông vs single 2; 4 đôi thông vs single|pair 2 or tứ quý), **in-turn only**. Every hand opens with **3♠** holder. Full finish ranking + simple points.
6. **Explicit non-goals:** tới trắng, đền bài, thối 3 bích, cóng multipliers, AI autoplay, out-of-turn chặt, ELO, spectators, mid-hand DB persistence.
7. **Auth path:** Portal owns Keycloak. Game iframe receives `{ type: 'vp-auth', token, profile }` via **postMessage** (same origin). Socket uses token; server verifies JWKS. **Do not** init Keycloak inside the iframe.
8. **Rooms:** exactly 3 fixed slots; Host = first joiner, migrates on leave; host starts at 2–4 players; after hand → waiting + host restarts.
9. **Disconnect:** hold seat ~`RECONNECT_MS` (default 60s); turn timeout → auto-pass (not AI card choice).
10. **Card ids:** `id = rank * 4 + suit`, rank 0=3 … 12=2, suit 0=♠ 1=♣ 2=♦ 3=♥; **3♠ = 0** (see `spec/logic_game.md`).
11. **Secrets:** never commit `.env`, `.env.development`, `.env.production`, tokens, or Keycloak secrets. Use `*.example` only for names.
12. **Comments:** no drive-by comments; no narrating code. Update `AGENTS.md` / `CONTEXT.md` / ADR when decisions change.
13. **Commits:** only when the human asks.

## Coding conventions

- JavaScript (Node), **CommonJS** (`require` / `module.exports`).
- Prefer clear names aligned with `CONTEXT.md` (Player, Room, Host, Hand, Combo, Beat, totalPoints).
- Socket event names: `room:*` and `hand:*`; keep payloads small.
- Errors to client: structured `{ code, message }` on `hand:error` / join rejects; do not leak stack traces.
- SQLite access only via config/services — no ad-hoc DB in socket files.
- UI: keep portal and game separated (EJS/Alpine vs Phaser); shared knowledge is card id encoding and socket contract only.

## Testing expectations

- Domain rules (`combination`, `playRules`, `scoring`) and `roomTable` transitions must have unit tests.
- Do not require full browser E2E for MVP; document manual LAN checks instead.
- When deepening a module, test through its interface; delete obsolete shallow tests if replaced.

## Before you code checklist

1. Read this file + `CONTEXT.md` (if present) + relevant `docs/adr/*`.
2. Confirm the change is not an MVP non-goal.
3. Put rules in `src/domain/` or `src/rooms/`; put transport in `src/sockets/` / controllers.
4. Run tests for touched pure modules.
5. If you change stack, layout, or a locked decision, update this `AGENTS.md` and add/adjust an ADR when the decision is hard to reverse.
