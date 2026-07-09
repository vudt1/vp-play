# Portal Module catalog and app surfaces

The portal home is a static server-side Module catalog (`src/modules/catalog.js`), not a Tiến Lên room lobby. Each shipped mini-app is a Module under `public/modules/<id>/` with an icon and an app surface at `/apps/:id`. Multiplayer Rooms and the game iframe live only on that Module’s app surface. Catalog entries are explicit (no filesystem auto-scan) so incomplete folders never appear.
