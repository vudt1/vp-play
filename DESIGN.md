---
version: alpha
name: vp-play-portal
description: Dark product store for an internal LAN entertainment portal — quiet shell, icon tiles do the talking.
colors:
  primary: "#1A2330"
  secondary: "#8B9BB4"
  accent: "#3D8BFD"
  surface: "#141A22"
  surface-elevated: "#1A2330"
  background: "#0B0F14"
  on-background: "#E7ECF3"
  on-surface: "#E7ECF3"
  border: "#2A3548"
  muted: "#8B9BB4"
  error: "#F07178"
  success: "#2DD4A8"
typography:
  display:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: 32
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.02
  headline:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: 20
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01
  body-lg:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: 16
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: 14
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: 12
    fontWeight: 500
    letterSpacing: 0.02
rounded:
  xs: 6
  sm: 8
  md: 12
  lg: 16
  full: 9999
spacing:
  xs: 4
  sm: 8
  md: 12
  lg: 16
  xl: 24
  2xl: 32
  3xl: 48
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "#2F7AE5"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  module-tile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
---

## Overview

Internal LAN app store: cool near-black fields, elevated slate surfaces, one electric blue interaction color. Utility over marketing — employees open a Module and play. Atmosphere is a restrained product store at night, not neon arcade or cream craft boutique.

## Colors

- **Background (#0B0F14):** page field — cool near-black, full viewport.
- **Surface (#141A22) / Elevated (#1A2330):** cards, tiles, panels.
- **Accent (#3D8BFD):** sole interaction driver — CTAs, links, active nav, tile hover border.
- **Muted (#8B9BB4):** secondary text, phase labels, empty states.
- **Border (#2A3548):** hairlines; prefer border over heavy shadow.

60% background/surface, 30% text hierarchy, 10% accent. Hover darkens accent by lightness only.

## Typography

- **Display / Headline:** IBM Plex Sans 600 — section and page titles; technical, legible, not startup-display.
- **Body:** IBM Plex Sans 400 at 14–16px — UI copy and table cells.
- **Label:** same family 500, slightly tracked — metadata only when needed.

Scale ~1.25 (minor third). Desktop-first; fluid only where titles would overflow.

## Layout

Max content width ~1120px, horizontal padding 24px. Catalog: CSS grid `auto-fill, minmax(220px, 1fr)`, gap 16–20px. Topbar sticky ≤72px, single-line nav. App surface stacks header → rooms → iframe. Section vertical rhythm 24–32px.

## Elevation & Depth

Flat default. Raised = 1px border + optional soft shadow `0 8px 24px rgba(0,0,0,0.35)` on tile hover only. Overlay unused on portal shell. No stacked glass layers.

## Shapes

Tiles max 16px radius; cards/buttons 8–12px. Pills only for rare tags if needed. Radius signals product store, not bubbly consumer app.

## Components

- **Buttons:** primary fill accent; ghost transparent + border; active scale ~0.97.
- **Module tile:** large icon (rounded mask), title, one-line muted blurb; hover lift 2px + accent border.
- **Room slot:** compact card inside app surface; seat list + join CTA.
- **Rank table:** plain rows, bottom border; top rank weight slightly stronger.
- **Inputs:** dark fill, border focus ring accent.
- **Iframe chrome:** bordered frame, dark fill, no decorative chrome.

## Do's and Don'ts

**Do:**

- Keep accent exclusive to interaction.
- Use Module icon tiles as the signature moment; keep the rest quiet.
- Write short Vietnamese product copy (Ứng dụng, Vào phòng, Xếp hạng).
- Honor `prefers-reduced-motion` (disable lift/transition).

**Don't:**

- Don't use Inter, Roboto, Arial, Space Grotesk, Geist, or Instrument Serif as design choice.
- Don't use purple-to-blue gradients or neon glow shadows.
- Don't put Room lobby on the catalog home.
- Don't redesign Phaser UI inside the iframe in this system.
- Don't animate with `transition: all`.
- Don't nest cards more than two levels deep.
- Don't show coming-soon Module tiles.
- Module icons: prefer 512px PNG; SVG placeholder acceptable until art is ready.
