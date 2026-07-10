# Tailwind v3.4 for portal CSS (offline build)

Portal shell styling uses **Tailwind CSS v3.4** as an npm devDependency with the official CLI: source `src/css/portal.css`, content scan of EJS/JS, output committed to `public/css/portal.css`. Runtime serves only the built file (no CDN, no browser Tailwind). IBM Plex Sans and a Material Symbols subset are self-hosted under `public/fonts/`.

This reverses the earlier “hand-written CSS only” preference because the approved App Store mock is Tailwind-shaped and utility parity is cheaper than a second hand CSS rewrite. Alternatives rejected: CDN Tailwind (breaks offline LAN), committing full `node_modules` (repo bloat), pure hand CSS reimplementation of the mock.
