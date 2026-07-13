# Module-namespaced server packages

Multiplayer Module server code is namespaced by catalog id under `src/modules/<id>/` (domain, rooms, sockets adapter). Portal Socket.IO hub (`src/sockets/`) only attaches JWT auth and loads each Module adapter.

Client static assets stay at `public/modules/<id>/`. Shared portal concerns (auth, ranking, catalog) stay outside Module folders.

Next multiplayer Module adds `src/modules/<new-id>/` + attach call; do not reintroduce a global `src/domain/` for game rules.
