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
  title:    { base: 48, min: 12, max: 96 }, // map title only
  large:    { base: 24, min: 12, max: 56 },
  regular:  { base: 16, min: 10, max: 28 },
  small:    { base: 14, min: 10, max: 26 },
  xsmall:   { base: 12, min: 10, max: 24 },

  mobile:   { base: 16, min: 14, max: 20 },
};

/**
 * Typography presets for Pin labels. font/case/letterSpacing/italic/
 * weight come from the preset, not the pin. Order matches the editor's
 * picker: Overworld tab (glyph markers) first, then Town tab (numbered
 * circles) with POI first.
 */
export const PIN_PRESETS = {
  // Overworld — the marker body comes from the SVG sprite keyed by
  // preset id (see src/components/map/markers.generated.{svg,js}).
  capital: {
    category: 'overworld', label: 'Capital', size: 'regular', font: 'title', weight: 'bold', colorClass: 'text-title',
  },
  city: {
    category: 'overworld', label: 'City', size: 'regular', font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 1,
  },
  town: {
    category: 'overworld', label: 'Town', size: 'regular', font: 'heading',
  },
  village: {
    category: 'overworld', label: 'Village', size: 'regular', font: 'body',
  },
  bridge: {
    category: 'overworld', label: 'Bridge', size: 'regular', font: 'body',
  },
  ruin: {
    category: 'overworld', label: 'Ruin', size: 'regular', font: 'heading',
  },

  fortress: {
    category: 'overworld', label: 'Fortress', size: 'regular', font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 1,
  },
  tower: {
    category: 'overworld', label: 'Tower', size: 'regular', font: 'heading',
  },
  temple: {
    category: 'overworld', label: 'Temple', size: 'regular', font: 'heading',
  },


  mountain: {
    category: 'overworld', label: 'Mountain', size: 'regular', font: 'body',
  },
  mine: {
    category: 'overworld', label: 'Mine', size: 'regular', font: 'heading',
  },
  cave: {
    category: 'overworld', label: 'Cave', size: 'regular', font: 'heading',
  },
  camp: {
    category: 'overworld', label: 'Camp', size: 'regular', font: 'body',
  },
  // Town — picked from a grid (no icon glyph; uses numbered circle).
  poi: {
    category: 'town', label: 'Point of Interest', size: 'regular', font: 'title', weight: 'bold', colorClass: 'text-title',
  },
  landmark: {
    category: 'town', label: 'Landmark', size: 'regular', font: 'heading', weight: 'bold', case: 'upper', colorClass: 'text-heading',
  },
  gate: {
    category: 'town', label: 'Gate', size: 'regular', font: 'heading', weight: 'bold', case: 'upper',
  },
  shop: {
    category: 'town', label: 'Shop / Inn', size: 'regular', font: 'body', weight: 'semibold',
  },
  residence: {
    category: 'town', label: 'Minor Structure', size: 'regular', font: 'body',
  },
};

// Order matches TextProperties' STYLE_ORDER so source + picker read the
// same top-to-bottom.
export const TEXT_PRESETS = {
  'map-title': {
    label: 'Map Title', size: 'title', font: 'title', colorClass: 'text-title',
  },
  continent: {
    label: 'Country', size: 'large', font: 'title', case: 'upper', letterSpacing: 4, colorClass: 'text-heading',
  },
  region: {
    label: 'Region', size: 'large', font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 3,
  },
  district: {
    label: 'District', size: 'large', font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 2,
  },
  'civic-space': {
    label: 'Civic Space', size: 'regular', font: 'heading', case: 'upper', letterSpacing: 3,
  },
  forest: {
    label: 'Forest', size: 'large', font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 4,
  },
  range: {
    label: 'Mountain Range', size: 'regular', font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 3,
  },
  hills: {
    label: 'Hills, Valley', size: 'regular', font: 'heading', case: 'title', letterSpacing: 1,
  },
  desert: {
    label: 'Desert, Plain', size: 'regular', font: 'body', case: 'upper', letterSpacing: 4,
  },
  ocean: {
    label: 'Ocean, Sea', size: 'large', font: 'heading', italic: true, case: 'upper', letterSpacing: 6,
  },
  island: {
    label: 'Island, Archipelago', size: 'small', font: 'body', case: 'upper', letterSpacing: 2,
  },
  lake: {
    label: 'Lake, Bay', size: 'large', font: 'heading', italic: true, case: 'upper', letterSpacing: 4,
  },
  'pond-marsh': {
    label: 'Pond, Swamp, Marsh', size: 'small', font: 'body', italic: true, case: 'title',
  },
};

// Path features render as text flowing along an invisible curve. The
// preset controls typography only — there is no stroke style since the
// line isn't drawn. Order drives the picker: grouped by kind (Borders,
// Roads, Water) with strongest first in each group.
export const PATH_PRESETS = {
  'major-border': {
    label: 'National Border', size: 'regular', font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 3,
  },
  'minor-border': {
    label: 'Regional Border', size: 'small', font: 'body', case: 'upper', letterSpacing: 3,
  },
  highway: {
    label: 'Highway', size: 'regular', font: 'heading', weight: 'bold', case: 'upper', letterSpacing: 3,
  },
  road: {
    label: 'Road', size: 'small', font: 'heading', case: 'title', letterSpacing: 1,
  },
  trail: {
    label: 'Trail, Pass', size: 'xsmall', font: 'body', case: 'title', letterSpacing: 1,
  },
  wall: {
    label: 'Wall', size: 'small', font: 'heading', case: 'upper', letterSpacing: 3,
  },
  river: {
    label: 'River', size: 'small', font: 'heading', italic: true, case: 'title', letterSpacing: 2,
  },
  stream: {
    label: 'Stream', size: 'xsmall', font: 'body', italic: true, case: 'title', letterSpacing: 2,
  },
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
  // Allow nudging the just-placed (selected) marker without leaving
  // the tool. MapViewer's drag effect keeps the selected marker
  // draggable; we just need to persist the new position.
  onPinDrag(pin, x, y, ctx) {
    ctx.updatePos(pin, x, y);
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
  // Allow nudging the just-placed (selected) text without leaving the
  // tool. Without this, dragging the box visually moves it but the data
  // never updates, so any subsequent render snaps it back.
  onPinDrag(pin, x, y, ctx) {
    ctx.updatePos(pin, x, y);
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
  onPinDrag(pin, x, y, ctx) {
    ctx.updatePos(pin, x, y);
  },
  onDeactivate(map, ctx) {
    this.state = null;
    ctx.hideLine();
  },
};

/** Grid tool — drag the map to translate the grid origin. The tool
 * doesn't create or select features; its only job is to capture the
 * map drag and pipe it into ctx.shiftGridOrigin so the grid layer can
 * follow the cursor. Activation also surfaces the GridProperties
 * panel in the editor sidebar. */
const gridTool = {
  id: 'grid',
  label: 'Grid',
  cursor: 'move',
  state: null,
  onMapDown(e, latlng, ctx) {
    const grid = ctx.getGrid?.();
    if (!grid?.shape) return;
    this.state = {
      startX: latlng.lng,
      startY: latlng.lat,
      originX: Number(grid.originX) || 0,
      originY: Number(grid.originY) || 0,
    };
  },
  onMapMove(e, latlng, ctx) {
    if (!this.state) return;
    const dx = latlng.lng - this.state.startX;
    const dy = latlng.lat - this.state.startY;
    ctx.setGridOrigin?.(
      Math.round(this.state.originX + dx),
      Math.round(this.state.originY + dy),
    );
  },
  onMapUp() {
    this.state = null;
  },
  onDeactivate() {
    this.state = null;
  },
};

export const TOOLS = {
  select: selectTool,
  pin: pinTool,
  text: textTool,
  path: pathTool,
  grid: gridTool,
};

export const TOOL_LIST = [selectTool, pinTool, textTool, pathTool, gridTool];

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
