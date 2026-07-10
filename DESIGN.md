---
name: Midnight Tech
colors:
  surface: '#141A22'
  surface-dim: '#101419'
  surface-bright: '#36393f'
  surface-container-lowest: '#0a0e13'
  surface-container-low: '#181c21'
  surface-container: '#1c2025'
  surface-container-high: '#262a30'
  surface-container-highest: '#31353b'
  on-surface: '#e0e2ea'
  on-surface-variant: '#c1c6d6'
  inverse-surface: '#e0e2ea'
  inverse-on-surface: '#2d3136'
  outline: '#8b919f'
  outline-variant: '#414753'
  surface-tint: '#abc7ff'
  primary: '#abc7ff'
  on-primary: '#002f66'
  primary-container: '#458fff'
  on-primary-container: '#00285a'
  inverse-primary: '#005cbc'
  secondary: '#b7c8e2'
  on-secondary: '#213146'
  secondary-container: '#3a4a60'
  on-secondary-container: '#a9b9d3'
  tertiary: '#ffb782'
  on-tertiary: '#4f2500'
  tertiary-container: '#de7507'
  on-tertiary-container: '#452000'
  error: '#F07178'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#abc7ff'
  on-primary-fixed: '#001b3f'
  on-primary-fixed-variant: '#004590'
  secondary-fixed: '#d3e4ff'
  secondary-fixed-dim: '#b7c8e2'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#ffb782'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#703800'
  background: '#101419'
  on-background: '#e0e2ea'
  surface-variant: '#31353b'
  surface-elevated: '#1A2330'
  border-muted: '#2A3548'
  success: '#2DD4A8'
  text-on-dark: '#E7ECF3'
typography:
  display-lg:
    fontFamily: IBM Plex Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 25px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 21px
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  display-lg-mobile:
    fontFamily: IBM Plex Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  max-width: 1120px
  gutter: 20px
---

## Implementation

Portal CSS is produced with **Tailwind CSS v3.4** (official CLI). Tokens below map to `tailwind.config.js` `theme.extend` and source `src/css/portal.css`. Runtime loads only the built `public/css/portal.css`. Fonts (IBM Plex Sans, Material Symbols) are self-hosted under `public/fonts/` — no Google Fonts or Tailwind CDN at runtime. See `docs/adr/0007-tailwind-portal-css.md`.

## Brand & Style

This design system embodies a **Corporate / Modern** aesthetic with a specific focus on a "Product Store at Night" atmosphere. It is designed for an internal LAN environment where utility and focus are paramount. The brand personality is professional, technical, and restrained, avoiding the visual noise of consumer gaming platforms or neon-heavy arcade interfaces.

The visual narrative is built on a "quiet shell" philosophy: the container remains neutral and sophisticated, allowing vibrant icon tiles and content to command attention. The user experience should feel like a high-end, dark-mode professional suite—reliable, efficient, and calming.

**Key Principles:**
- **Restraint:** High-contrast interaction is reserved strictly for action points.
- **Technical Precision:** Clean lines and structured grids replace organic or "soft" decorative elements.
- **Atmospheric Depth:** Depth is created through subtle tonal shifts rather than aggressive lighting or gradients.

## Colors

The palette is strictly functional, adhering to a 60-30-10 distribution rule to maintain visual hierarchy and eye comfort in low-light environments.

- **Backgrounds:** A cool near-black (`#0B0F14`) serves as the foundation. Surfaces use slate tones (`#141A22`) to distinguish interactive areas from the canvas.
- **Interaction (Accent):** Electric Blue (`#3D8BFD`) is the exclusive driver for interaction. It is used for primary buttons, active navigation states, and focus indicators.
- **Typography & Borders:** Primary text uses a high-contrast off-white (`#E7ECF3`), while secondary metadata and borders use muted slate tones to reduce visual clutter.
- **Status:** Semantic colors (Success/Error) are desaturated to align with the professional palette while remaining legible.

## Typography

The typography system uses **IBM Plex Sans** to convey a technical, engineered feel. It prioritizes legibility and structure over decorative flair.

- **Headlines:** Use Semi-Bold weights with slight negative letter-spacing to create a compact, authoritative look for section titles.
- **Body:** Set at 14px and 16px with a generous 1.5x line height to ensure readability of Vietnamese diacritics and technical descriptions.
- **Labels:** Utilized for metadata and category tags; these use a medium weight and increased letter-spacing for clarity at small sizes.
- **Localization:** All type must support Vietnamese character sets natively, ensuring diacritics do not clash with line heights.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy for the main content area to ensure a consistent, manageable reading width on large monitors.

- **Grid System:** The module catalog uses a CSS Grid `auto-fill` pattern with a `minmax(220px, 1fr)` definition, allowing the number of columns to adapt based on screen real estate while maintaining a standard tile size.
- **Vertical Rhythm:** Sections are separated by `32px` (2xl) or `48px` (3xl) to create distinct visual groupings.
- **Breakpoints:**
  - **Desktop:** 1120px max-width, center-aligned, 24px side margins.
  - **Tablet:** Fluid width, 20px side margins, 3-column grid.
  - **Mobile:** Fluid width, 16px side margins, 1 or 2-column grid.
- **Navigation:** The top bar is pinned (sticky) with a height of `72px`, acting as a constant anchor for user orientation.

## Elevation & Depth

This design system uses **Tonal Layers** supplemented by **Low-contrast Outlines** to define hierarchy. 

- **Surface Tiers:** The background is the lowest level. Cards and tiles sit on the `surface` tier. Elements that require focus or are currently being interacted with sit on the `surface-elevated` tier.
- **Borders:** Instead of heavy shadows, 1px hairlines (`#2A3548`) are the primary method of defining element boundaries.
- **Interactive Depth:** On hover, tiles utilize a soft, deep ambient shadow (`0 8px 24px rgba(0,0,0,0.35)`) and a subtle 2px vertical lift to indicate interactivity.
- **Focus:** Active states are highlighted with the primary accent color rather than an increase in elevation.

## Shapes

The shape language is "Rounded" but controlled, avoiding the bubbly appearance of consumer apps to maintain a professional "Product Store" feel.

- **Primary Radius:** `8px` (0.5rem) is the standard for buttons and small cards.
- **Large Radius:** `16px` (1rem) is reserved for Module Tiles and main container masks.
- **Pills:** Only used for status badges (e.g., "Mới", "Trực tuyến") to distinguish them from functional buttons.
- **Consistency:** All interactive elements must share the same corner logic to appear as part of a unified suite.

## Components

### Buttons
- **Primary:** Solid `#3D8BFD` fill with white text. No gradients.
- **Ghost/Secondary:** Transparent background with a 1px `#2A3548` border. Text in `text-on-dark`.
- **Interaction:** On click/tap, buttons should scale to `0.97` to provide tactile feedback.

### Module Tiles
- **Structure:** A large rounded icon (16px radius), followed by a Semi-Bold title and a muted single-line description.
- **Hover State:** Lift + Shadow + Accent Border (1px).

### Input Fields
- **Styling:** Darker fill than the surface (`#0B0F14`), subtle border.
- **Focus:** The border transitions to the primary accent color.

### Room Slots
- **Usage:** Compact list items within a room lobby. 
- **Layout:** Horizontal arrangement showing player count, room status, and a "Vào phòng" (Join) CTA.

### Rank Tables
- **Styling:** Minimalist design with no vertical borders. 
- **Typography:** The top three ranks may use a slightly heavier weight or a subtle tonal shift to denote status.

### Iframe Chrome
- **Standard:** External content is wrapped in a clean 1px border. No browser-style decorative chrome is permitted; the UI shell should remain invisible once a module is active.