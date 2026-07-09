# Keycloak JWT on socket and postMessage into game iframe

Portal owns Keycloak-js. With `AUTH_DEV_BYPASS=0`, portal pages init Keycloak with `onLoad: 'login-required'` (hard gate on `/` and `/ranking`). After auth, client calls `POST /api/auth/sync` before treating the session as logged in; access token is cached in `localStorage` (`vp_access_token`) and cleared on logout. Display name lives in header `#auth-slot`.

The Tiến Lên client runs in a same-origin iframe and receives `{ type: 'vp-auth', token, profile }` via `postMessage`. Socket.IO authenticates with that access token; the server verifies JWT via JWKS (or `AUTH_DEV_BYPASS` for local LAN without Keycloak).

Rejected: second Keycloak init inside the iframe; session cookies as the only game auth path for MVP.
