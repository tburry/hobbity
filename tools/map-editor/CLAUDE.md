# CLAUDE.md — Map Editor

Standalone Svelte app for placing markers and labels on campaign maps. Runs via `pnpm map-editor` on port 8321.

## Architecture

- **`tools/map-editor/`** — Svelte app (`App.svelte`, `main.js`, `index.html`)
- **`src/components/map/`** — Shared components (`MapViewer.svelte`, `symbols.js`). The Astro site can import these for a read-only map viewer.
- **`tools/map-server.mjs`** — Node server running Vite in middleware mode for the Svelte app. Handles `/api/maps`, `/api/pins/:slug`, and serves `/maps/*` (raw images) and `/tiles/*` (tile pyramids).
- **`scripts/generate-map-tiles.mjs`** — Generates Leaflet tile pyramids. Use `--all` to process every image in `src/assets/images/maps/` into `public/tiles/<slug>/`. Tiles are WebP with alpha padding for clean viewport edges.

## Data

- **Map images** live in `src/assets/images/maps/<slug>.webp`. The server auto-discovers them.
- **Map doc** saved to `src/data/maps/<slug>.json` as `{ meta, pins }`. `meta` holds map-level info (title, description, …). `pins` is sorted naturally by marker `number` (using `Intl.Collator` with `numeric: true`), with unnumbered entries at the end sorted by position. Pretty-printed, defaults omitted, no runtime `id` field — clean for source control. Consumed by both the editor and the Astro site's map viewer.
- **Tiles** in `public/tiles/<slug>/` (gitignored). Regenerate with `pnpm tiles --all` when maps change.

## Toolbox

Four tools live in a floating control below the Leaflet zoom buttons:

- **Select** (V) — click existing features to edit them; drag to move markers. No-op on empty map.
- **Marker** (M) — click to drop a marker. Town markers render as a numbered circle; overworld markers render as a glyph from `PIN_PRESETS`.
- **Text** (T) — click-and-drag to draw a bounding rectangle. Text renders inside the box with configurable horizontal/vertical alignment.
- **Path** (P) — (planned) two-point bezier curve for rivers and roads.

The active tool is stored in `localStorage['map-editor:tool']`.

## Text Presets

Text features accept a typography preset that auto-fills font/size/case/letter-spacing/italic/bold/fixed. Presets are defined in `src/components/map/tools.js` (`TEXT_PRESETS`) and correspond to fantasy-map typographic conventions:

| Preset | Use for | Font style |
| --- | --- | --- |
| `custom` | Manual override | — |
| `title` | Map title | Uncial Antiqua, large, uppercase, fixed |
| `landmark` | Key landmarks (temple, keep) | Crimson Pro, large, bold, uppercase |
| `shop` | Shops & services | Crimson Pro, medium, title case |
| `minor` | Minor structures | Lora, small, title case |
| `road-main` | Main thoroughfares | Crimson Pro, bold, uppercase |
| `road-lane` | Local lanes | Lora, small, title case |
| `district` | Districts (Old Town, etc.) | Crimson Pro, bold, uppercase, wide track |
| `civic` | Civic spaces (Market, Commons) | Crimson Pro, uppercase, wide track |
| `agricultural` | Fields, orchards | Lora, uppercase, wide track |
| `river` | Major rivers | Crimson Pro, italic, title case |
| `lake` | Named lakes | Crimson Pro, large, italic, uppercase |

After picking a preset the user can still tweak individual style fields — the preset is just a shortcut. Presets serialize as `preset: "<id>"` in the saved JSON (omitted for `custom`), so future rule tweaks can re-apply defaults.

## Marker model

Every marker has `name`, `x`, `y`. Optional:

- `number` — string shown in a circle; empty/missing means "freeform label" (text-only, no circle)
- `longName` — shown on hover instead of `name`
- `font` — `body` (Lora), `heading` (Crimson Pro), or `title` (Uncial Antiqua)
- `size` — `sm`, `md`, or `lg` (picked by user); `xl` only reached via zoom-bump
- `bold`, `italic` — booleans
- `rotate` — degrees, only meaningful for freeform labels
- `fixed` — label scales with zoom instead of bumping through the size table
- `description`, `link` — metadata for future site viewer

## Rendering rules

- **Numbered markers**: white circle with text-colored border (`#3b2e1e` text on `#faf6f0` bg). Short label above the circle. Hover swaps to `longName` if set.
- **Freeform labels (`map-label`)**: text directly on the map with a subtle bg-colored text shadow.
- **Zoom < 2**: marker circles shrink to 12px dots (no number text), ALL labels hidden except on hover. This is enforced with `!important` because Leaflet CSS can otherwise override our `display: none`.
- **Zoom >= 2 with Show Labels on**: short labels always visible.
- **Zoom >= 2 without toggle**: labels hover-only.
- **Size bumping**: each whole zoom level above 2 bumps the size table index by 1, capped at `xl`. So `md` at z=3 renders as `lg`; at z=4 as `xl`.
- **Mobile (max-width 768px)**: labels enforce min 16px and ignore zoom scaling entirely.
- **Fixed labels**: base size pegged to zoom 2, scales by `2^(z-2)` via CSS `font-size`.
- **Hover hitbox**: always 28×28 even when the visual dot is 12×12, so hover is reliable at low zoom.

## Coordinate system

`MapViewer` uses a custom CRS extending `L.CRS.Simple` so that marker `x`/`y` are in image pixels regardless of whether tiles or image overlay is used. The CRS overrides `scale(z)` to match the tile generator's scale (`2^z * tileSize / maxDim`) and uses `L.Transformation(1, 0, 1, 0)` (no y-flip) to align with tile y=0 being at the top.

## Manifest

`GET /api/maps` returns per-map `initialZoom`, `minZoom`, `maxZoom`, optional `tiles` (with `basePath` + meta). These come from the tile pyramid's `meta.json` and viewport-fit calculations. Server auto-scans `src/assets/images/maps/` on startup; no static manifest file.

## Icons

UI icons (toolbox, form toggles) use [Lucide](https://lucide.dev) SVG markup inlined directly into the component templates. No icon library is installed — we copy the SVG path data from lucide.dev and paste it into `App.svelte`. Each SVG uses `fill="none" stroke="currentColor" stroke-width="2"` so it picks up the surrounding text color for active/hover states.

When adding a new tool or form action:

1. Find an icon at [lucide.dev/icons](https://lucide.dev/icons)
2. Click the icon and copy the SVG markup (the "Copy SVG" button)
3. Paste it inline in the template, with `viewBox="0 0 24 24"` and `currentColor` stroke
4. Size via CSS (`.toolbox svg { width: 18px; height: 18px }` etc.)

Current toolbox icons map to Lucide names: `select` = `mouse-pointer-2`, `text` = `type`, `marker` = `map-pin`, `path` = `spline`.

## Adding a map

1. Drop the image into `src/assets/images/maps/<slug>.webp`
2. `pnpm tiles --all` to generate tiles
3. Restart the server (`pnpm map-editor`) — it re-scans on startup

## Map Features

# Standard Fantasy Cartography System

| Tool | Feature | Pin | Font | Style | Class |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **Marker (Overworld)** | Capital City | ✪ | title | Large | `capital` |
|  | Major City | ◉ | heading | UPPERCASE, Bold, LS: 0.05em | `city` |
|  | Fortress | ⛫ | heading | UPPERCASE, Bold, LS: 0.05em | `fortress` |
|  | Town | ◼ | heading | - | `town` |
|  | Tower | ♖ | heading | - | `tower` |
|  | Temple | ⛪ | heading | - | `temple` |
|  | Mine | ⚒ | heading | - | `mine` |
|  | Cave | ⍢ | heading | - | `cave` |
|  | Ruin | ⛬ | title | - | `ruin` |
|  | Camp | ⛺ | body | - | `camp` |
|  | Village | • | body | Small | `village` |
|  | Bridge | ≏ | body | Small | `bridge` |
|  | Mountain | ⛰ | body | Small | `mountain` |
| **Marker (Town)** | Major Landmark |  | heading | UPPERCASE, Bold | `landmark` |
|  | Gate |  | heading | UPPERCASE, Bold | `gate` |
|  | Point of Interest |  | title | Bold | `poi` |
|  | Shop / Inn |  | heading | Bold | `shop` |
|  | Residence |  | body | Small | `residence` |
| **Text** | Map Title |  | title | Large | `title` |
|  | Continent |  | title | Large, LS: 0.2em | `continent` |
|  | Empire |  | title | Large, LS: 0.2em | `empire` |
|  | Ocean |  | heading | UPPERCASE, Italic, Large, LS: 0.3em | `ocean` |
|  | Sea |  | heading | UPPERCASE, Italic, Large, LS: 0.3em | `sea` |
|  | Lake |  | heading | UPPERCASE, Italic, LS: 0.2em | `lake` |
|  | Bay |  | heading | UPPERCASE, Italic, LS: 0.2em | `bay` |
|  | Mountain Range |  | heading | UPPERCASE, Bold, LS: 0.15em | `range` |
|  | Forest |  | heading | UPPERCASE, Bold, LS: 0.15em | `forest` |
|  | Region / Province |  | heading | UPPERCASE, LS: 0.15em | `region` |
|  | District / Civic Space |  | heading | UPPERCASE, Small, LS: 0.1em | `district` |
|  | Desert |  | body | UPPERCASE, LS: 0.2em | `desert` |
|  | Plain |  | body | UPPERCASE, LS: 0.2em | `plain` |
|  | Valley |  | body | UPPERCASE, LS: 0.2em | `valley` |
|  | Hills |  | body | UPPERCASE, LS: 0.2em | `hills` |
|  | Island |  | body | UPPERCASE, Small, LS: 0.1em | `island` |
|  | Archipelago |  | body | UPPERCASE, Small, LS: 0.1em | `archipelago` |
|  | Pond |  | body | Italic | `pond` |
|  | Swamp |  | body | Italic | `swamp` |
|  | Marsh |  | body | Italic | `marsh` |
|  | Legend |  | body | Small | `legend` |
|  | Scale |  | body | Small | `scale` |
| **Path** | National Border |  | heading | UPPERCASE, Bold, LS: 0.1em | `major-border` |
|  | Wall |  | heading | UPPERCASE, LS: 0.1em | `wall` |
|  | River |  | heading | Italic | `river` |
|  | Highway |  | heading | - | `highway` |
|  | Regional Border |  | body | UPPERCASE, Small, LS: 0.1em | `minor-border` |
|  | Stream |  | body | Italic, Small | `stream` |
|  | Sea Route |  | body | Italic, Small | `route` |
|  | Trail |  | body | Small | `trail` |
|  | Pass |  | body | Small | `pass` |
|  | Road |  | body | - | `road` |

## Pro-Tips for Fantasy Maps:

- The "Water Rule": Always use Italics for Rivers and Lakes. This is a universal map convention that helps the eye instantly find water.
- Tracking (Spacing): For "Areas" (Fields/Commons), increase the letter spacing (tracking) to 200–500. This makes the word "occupy" the space without needing a massive font size.
- Color Palette: Use Dark Brown or Black for Buildings and Roads, and a Deep Blue for Rivers and Lakes.
