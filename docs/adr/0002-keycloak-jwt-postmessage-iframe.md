# Keycloak JWT on socket and postMessage into game iframe

Portal owns Keycloak-js. The Tiến Lên client runs in a same-origin iframe and receives `{ type: 'vp-auth', token, profile }` via `postMessage`. Socket.IO authenticates with that access token; the server verifies JWT via JWKS (or `AUTH_DEV_BYPASS` for local LAN without Keycloak).

Rejected: second Keycloak init inside the iframe; session cookies as the only game auth path for MVP.
