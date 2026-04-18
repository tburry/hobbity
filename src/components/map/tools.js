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

/** CSS class emitted per size, so text-shadow rules can target by size. */
const SIZE_CLASSES = {
  title:   'text-xl',
  large:   'text-lg',
  regular: 'text-base',
  small:   'text-sm',
};

/**
 * Named font-size specs. Each returns { base, min, max } in CSS pixels,
 * where `base` is the size at zoom 2 (REF_ZOOM); the renderer scales linearly
 * with zoom (2^(z - 2)) and clamps to [min, max]. Presets reference these by
 * name via `size(name)` so sizes stay consistent across presets.
 */
const SIZES = {
  title:    { base: 48, min: 16, max: 96 }, // map title only
  large:    { base: 24, min: 14, max: 56 },
  regular:  { base: 18, min: 12, max: 28 },
  small:    { base: 14, min: 10, max: 24 },
  xsmall:   { base: 12, min: 10, max: 24 },
};

/**
 * Typography presets for numbered Pin labels. Each `defaults` spreads a named
 * size spec plus style fields. font/case/letterSpacing/italic/bold come from
 * the preset, not the pin.
 */
export const PIN_PRESETS = {
  // Overworld — each preset picks a glyph that doubles as the pin icon.
  capital:   { category: 'overworld', icon: '✪', label: 'Capital',       size: 'large',   font: 'title',   weight: 'bold' },
  city:      { category: 'overworld', icon: '◉', label: 'City',          size: 'large',   font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 1 },
  fortress:  { category: 'overworld', icon: '⛫', label: 'Fortress',      size: 'large',   font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 1 },
  town:      { category: 'overworld', icon: '◼', label: 'Town',          size: 'regular', font: 'heading' },
  tower:     { category: 'overworld', icon: '♖', label: 'Tower',         size: 'regular', font: 'heading' },
  temple:    { category: 'overworld', icon: '\u26EA\uFE0E', label: 'Temple', size: 'regular', font: 'heading' },
  mine:      { category: 'overworld', icon: '⚒', label: 'Mine',          size: 'regular', font: 'heading' },
  cave:      { category: 'overworld', icon: '⍢', label: 'Cave',          size: 'regular', font: 'heading' },
  ruin:      { category: 'overworld', icon: '⛬', label: 'Ruin',          size: 'regular', font: 'heading' },
  camp:      { category: 'overworld', icon: '⛺\uFE0E', label: 'Camp',    size: 'regular', font: 'body' },
  village:   { category: 'overworld', icon: '•', label: 'Village',       size: 'small',   font: 'body' },
  bridge:    { category: 'overworld', icon: '≏', label: 'Bridge',        size: 'small',   font: 'body' },
  mountain:  { category: 'overworld', icon: '⛰', label: 'Mountain',      size: 'small',   font: 'body' },
  // Town — picked from a grid (no icon glyph; uses numbered circle).
  landmark:  { category: 'town', label: 'Landmark',          size: 'regular', font: 'heading', weight: 'bold', case: 'upper', colorClass: 'text-heading' },
  gate:      { category: 'town', label: 'Gate',              size: 'regular', font: 'heading', weight: 'bold', case: 'upper' },
  poi:       { category: 'town', label: 'Point of Interest', size: 'regular', font: 'title',   weight: 'bold', colorClass: 'text-title' },
  shop: {
    category: 'town', label: 'Shop / Inn', size: 'small', font: 'body', weight: 'semibold' },
  residence: {
    category: 'town', label: 'Minor Structure', size: 'small', font: 'body' },
};

export const TEXT_PRESETS = {
  'map-title':   { label: 'Map Title',            size: 'title',   font: 'title',   colorClass: 'text-title' },
  continent:     { label: 'Country',              size: 'large',   font: 'title',   case: 'upper', letterSpacing: 4, colorClass: 'text-heading' },
  ocean:         { label: 'Ocean, Sea',           size: 'large',   font: 'heading', italic: true, case: 'upper', letterSpacing: 6 },
  lake:          { label: 'Lake, Bay',            size: 'large',   font: 'heading', italic: true, case: 'upper', letterSpacing: 4 },
  range:         { label: 'Mountain Range',       size: 'regular', font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 3 },
  forest:        { label: 'Forest',               size: 'large',   font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 4 },
  region:        { label: 'Region',               size: 'large',   font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 3 },
  district:      { label: 'District',             size: 'large',   font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 2 },
  'civic-space': { label: 'Civic Space',          size: 'regular', font: 'heading', case: 'upper', letterSpacing: 3 },
  desert:        { label: 'Desert, Plain',        size: 'regular', font: 'body',    case: 'upper', letterSpacing: 4 },
  hills:         { label: 'Hills, Valley',        size: 'regular', font: 'heading', case: 'title', letterSpacing: 1 },
  island:        { label: 'Island, Archipelago',  size: 'small',   font: 'body',    case: 'upper', letterSpacing: 2 },
  'pond-marsh':  { label: 'Pond, Swamp, Marsh',   size: 'regular', font: 'body', italic: true, case: 'title' },
};

// Path features render as text flowing along an invisible curve. The
// preset controls typography only — there is no stroke style since the
// line isn't drawn.
// Grouped by kind (Borders, Roads, Water), then by prominence inside
// each group so the picker reads top-to-bottom as strongest → weakest.
export const PATH_PRESETS = {
  'major-border': {
    label: 'National Border', size: 'regular', font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 3 },
  'minor-border': {
    label: 'Regional Border', size: 'small',   font: 'body',    case: 'upper', letterSpacing: 3 },
  highway: {
    label: 'Highway',         size: 'regular', font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 3 },
  road: {
    label: 'Road', size: 'small', font: 'heading', case: 'title', letterSpacing: 1 },
  trail: {
    label: 'Trail, Pass', size: 'xsmall', font: 'body',    case: 'title', letterSpacing: 1 },
  wall: {
    label: 'Wall', size: 'small', font: 'heading', case: 'upper', letterSpacing: 3 },
  river: {
    label: 'River', size: 'small', font: 'heading', italic: true, case: 'title', letterSpacing: 2 },
  stream: {
    label: 'Stream', size: 'xsmall', font: 'body', italic: true, case: 'title', letterSpacing: 2 },
};


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
  state: null,
  onMapDown(e, latlng, ctx) {
    this.state = { start: latlng };
    ctx.showLine(latlng, latlng);
  },
  onMapMove(e, latlng, ctx) {
    if (!this.state) return;
    ctx.showLine(this.state.start, latlng);
  },
  onMapUp(e, latlng, ctx) {
    if (!this.state) return;
    const { start } = this.state;
    this.state = null;
    ctx.hideLine();
    const dx = latlng.lng - start.lng;
    const dy = latlng.lat - start.lat;
    // Require a meaningful drag — click-without-drag does nothing.
    if (Math.hypot(dx, dy) < 10) return;
    ctx.create({
      kind: 'path',
      a: [Math.round(start.lng), Math.round(start.lat)],
      b: [Math.round(latlng.lng), Math.round(latlng.lat)],
    });
  },
  onDeactivate(map, ctx) {
    this.state = null;
    ctx.hideLine();
  },
};

export const TOOLS = {
  select: selectTool,
  pin: pinTool,
  text: textTool,
  path: pathTool,
};

export const TOOL_LIST = [selectTool, pinTool, textTool, pathTool];

export function sizeSpec(name) {
  return SIZES[name] || SIZES.regular;
}

export function sizeClass(name) {
  return SIZE_CLASSES[name] || 'text-base';
}

/** Default min zoom at which a marker's label first appears. */
export const DEFAULT_MARKER_MIN_ZOOM = 3;

/**
 * Per-kind feature defaults — single source of truth shared by the
 * editor (create/load/save) and the MapViewer (render). Omitting a
 * field from saved JSON means "use the default"; adding a new field
 * here makes it automatically apply to existing data.
 */
export const KIND_DEFAULTS = {
  pin: {
    minZoom: DEFAULT_MARKER_MIN_ZOOM,
    class: 'shop',
    labelPos: 'n',
    anchor: 'center',
  },
  text: {
    minZoom: 1,
    class: 'civic-space',
    align: 'center',
    valign: 'middle',
  },
  path: {
    minZoom: 2,
    class: 'river',
    mode: 'straight',
    textAlign: 'center',
    textBaseline: 'baseline',
    flip: false,
  },
};

export function findPreset(id) {
  return TEXT_PRESETS[id] || PIN_PRESETS[id] || PATH_PRESETS[id];
}
