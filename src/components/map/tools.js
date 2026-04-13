/**
 * Map-editor tools. Each tool encapsulates the behavior the map should have
 * while it's active: which events it listens to and what happens when they
 * fire. MapViewer dispatches DOM / Leaflet events to the active tool's
 * handlers. Tools communicate results back to the editor via a `ctx` object
 * passed to each handler.
 *
 * Tool shape:
 *   {
 *     id, label, cursor,
 *     onActivate(map, ctx),      // called when the tool becomes active
 *     onDeactivate(map, ctx),    // called when another tool takes over
 *     onMapClick(latlng, ctx),   // click on empty map
 *     onMapDown(e, latlng, ctx), // mousedown on map (for drag gestures)
 *     onMapMove(e, latlng, ctx), // mousemove while a drag is in progress
 *     onMapUp(e, latlng, ctx),   // mouseup on map
 *     onPinClick(pin, ctx),      // click on an existing feature
 *     onPinDrag(pin, x, y, ctx), // existing feature dragged to new coords
 *   }
 *
 * ctx provides:
 *   - create(data)            — create a new feature from partial data
 *   - edit(pin)               — open editor for an existing feature
 *   - showRect(a, b)          — show a rectangle preview (in image coords)
 *   - hideRect()              — remove rectangle preview
 */

const selectTool = {
  id: 'select',
  label: 'Select',
  cursor: 'default',
  selectable: true,   // markers are draggable/clickable only when this is true
  onMapClick(_latlng, ctx) {
    // Clicking empty map clears the current selection
    ctx.deselect?.();
  },
  onPinClick(pin, ctx) {
    ctx.edit(pin);
  },
  onPinDrag(pin, x, y, ctx) {
    ctx.updatePos(pin, x, y);
  },
};

const pinTool = {
  id: 'pin',
  label: 'Marker',
  cursor: 'crosshair',
  onMapClick(latlng, ctx) {
    ctx.create({
      kind: 'pin',
      x: Math.round(latlng.lng),
      y: Math.round(latlng.lat),
    });
  },
};

const textTool = {
  id: 'text',
  label: 'Text',
  cursor: 'crosshair',
  state: null,
  onMapDown(e, latlng, ctx) {
    this.state = { start: latlng };
    ctx.showRect(latlng, latlng);
  },
  onMapMove(e, latlng, ctx) {
    if (!this.state) return;
    ctx.showRect(this.state.start, latlng);
  },
  onMapUp(e, latlng, ctx) {
    if (!this.state) return;
    const { start } = this.state;
    this.state = null;
    ctx.hideRect();
    const w = Math.round(Math.abs(latlng.lng - start.lng));
    const h = Math.round(Math.abs(latlng.lat - start.lat));
    // Require a meaningful drag — no click-to-create
    if (w < 10 || h < 10) return;
    // x, y are the CENTER of the bounding box
    const cx = Math.round((start.lng + latlng.lng) / 2);
    const cy = Math.round((start.lat + latlng.lat) / 2);
    ctx.create({ kind: 'text', x: cx, y: cy, width: w, height: h });
  },
  onDeactivate(map, ctx) {
    this.state = null;
    ctx.hideRect();
  },
};

const pathTool = {
  id: 'path',
  label: 'Path',
  cursor: 'crosshair',
  onMapClick(latlng, ctx) {
    ctx.alert('Path tool coming soon.');
  },
};

export const TOOLS = {
  select: selectTool,
  pin: pinTool,
  text: textTool,
  path: pathTool,
};

export const TOOL_LIST = [selectTool, pinTool, textTool, pathTool];

/**
 * Named font-size specs. Each returns { base, min, max } in CSS pixels,
 * where `base` is the size at zoom 2 (REF_ZOOM); the renderer scales linearly
 * with zoom (2^(z - 2)) and clamps to [min, max]. Presets reference these by
 * name via `size(name)` so sizes stay consistent across presets.
 */
const SIZES = {
  title:   { base: 48, min: 16, max: 96 }, // map title only
  large:   { base: 24, min: 14, max: 56 },
  regular: { base: 18, min: 12, max: 32 },
  small:   { base: 16, min: 10, max: 20 },
};

/** CSS class emitted per size, so text-shadow rules can target by size. */
const SIZE_CLASSES = {
  title:   'text-xl',
  large:   'text-lg',
  regular: 'text-base',
  small:   'text-sm',
};

export function size(name) {
  const spec = SIZES[name] || SIZES.regular;
  return { ...spec, sizeClass: SIZE_CLASSES[name] || 'text-base' };
}

/** Default min zoom at which a marker's label first appears. */
export const DEFAULT_MARKER_MIN_ZOOM = 3;

/**
 * Typography presets for numbered Pin labels. Each `defaults` spreads a named
 * size spec plus style fields. font/case/letterSpacing/italic/bold come from
 * the preset, not the pin.
 */
export const PIN_PRESETS = [
  // Overworld — each preset picks a glyph that doubles as the pin icon.
  { id: 'capital',   category: 'overworld', icon: '✪', label: 'Capital',           defaults: { ...size('large'),   font: 'title',   weight: 700 } },
  { id: 'city',      category: 'overworld', icon: '◉', label: 'City',              defaults: { ...size('large'),   font: 'heading', weight: 700, case: 'upper', letterSpacing: 1 } },
  { id: 'fortress',  category: 'overworld', icon: '⛫', label: 'Fortress',          defaults: { ...size('large'),   font: 'heading', weight: 700, case: 'upper', letterSpacing: 1 } },
  { id: 'town',      category: 'overworld', icon: '◼', label: 'Town',              defaults: { ...size('regular'), font: 'heading' } },
  { id: 'tower',     category: 'overworld', icon: '♖', label: 'Tower',             defaults: { ...size('regular'), font: 'heading' } },
  { id: 'temple',    category: 'overworld', icon: '⛪', label: 'Temple',            defaults: { ...size('regular'), font: 'heading' } },
  { id: 'mine',      category: 'overworld', icon: '⚒', label: 'Mine',              defaults: { ...size('regular'), font: 'heading' } },
  { id: 'cave',      category: 'overworld', icon: '⍢', label: 'Cave',              defaults: { ...size('regular'), font: 'heading' } },
  { id: 'ruin',      category: 'overworld', icon: '⛬', label: 'Ruin',              defaults: { ...size('regular'), font: 'title' } },
  { id: 'camp',      category: 'overworld', icon: '⛺', label: 'Camp',              defaults: { ...size('regular'), font: 'body' } },
  { id: 'village',   category: 'overworld', icon: '•', label: 'Village',           defaults: { ...size('small'),   font: 'body' } },
  { id: 'bridge',    category: 'overworld', icon: '≏', label: 'Bridge',            defaults: { ...size('small'),   font: 'body' } },
  { id: 'mountain',  category: 'overworld', icon: '⛰', label: 'Mountain',          defaults: { ...size('small'),   font: 'body' } },
  // Town — picked from a grid (no icon glyph; uses numbered circle).
  { id: 'landmark',  category: 'town',      label: 'Major Landmark',    defaults: { ...size('regular'), font: 'heading', weight: 700, case: 'upper', colorClass: 'text-heading' } },
  { id: 'gate',      category: 'town',      label: 'Gate',              defaults: { ...size('regular'), font: 'heading', weight: 700, case: 'upper' } },
  { id: 'poi',       category: 'town',      label: 'Point of Interest', defaults: { ...size('regular'), font: 'title',   weight: 700 } },
  { id: 'shop',      category: 'town',      label: 'Shop / Inn',        defaults: { ...size('small'), font: 'body', weight: 600 } },
  { id: 'residence', category: 'town',      label: 'Residence',         defaults: { ...size('small'),   font: 'body' } },
];

export const TEXT_PRESETS = [
  { id: 'map-title',   label: 'Map Title',   defaults: { ...size('title'),   font: 'title', colorClass: 'text-title' } },
  { id: 'civic-space', label: 'Civic Space', defaults: { ...size('regular'), font: 'heading', case: 'upper', letterSpacing: 3 } },
  { id: 'forest',      label: 'Forest',      defaults: { ...size('large'), font: 'heading', weight: 700, case: 'upper', letterSpacing: 4 } },
  { id: 'district',    label: 'District',    defaults: { ...size('large'),   font: 'heading', weight: 700, case: 'upper', letterSpacing: 2 } },
  { id: 'pond-marsh',  label: 'Pond/Marsh',  defaults: { ...size('regular'), font: 'body',    italic: true, case: 'title' } },
  { id: 'lake',        label: 'Lake',        defaults: { ...size('large'),   font: 'heading', italic: true, case: 'upper' } },
];

export function findPreset(id) {
  return TEXT_PRESETS.find(p => p.id === id) || PIN_PRESETS.find(p => p.id === id);
}

export function defaultsForPreset(id) {
  const p = findPreset(id);
  return p ? { ...p.defaults } : {};
}
