<script>
  import MapViewer from '../../src/components/map/MapViewer.svelte';
  import { TOOL_LIST, TOOLS, KIND_DEFAULTS, findPreset } from '../../src/components/map/tools.js';

  /** Bucket a feature for list + save sort:
   *   0 = map title(s) — pinned to the very top so the header lands first
   *   1 = numbered town marker (sort by number, then name)
   *   2 = overworld glyph marker (sort by name)
   *   3 = text / path / anything else (sort by name)
   * Class first so an overworld marker with a stray number still bucks
   * into the overworld group. */
  function markerBucket(pin) {
    if (pin.class === 'map-title') return 0;
    const preset = findPreset(pin.class);
    if (preset?.category === 'overworld') return 2;
    if (pin.number) return 1;
    return 3;
  }

  /** Sort key for name-based comparisons. Ignores leading "The " /
   * "A " so "The Old Gate" files next to "Old Gate". Case-insensitive. */
  function nameSortKey(name) {
    return String(name || '').replace(/^\s*(the|a)\s+/i, '').toLowerCase();
  }

  /** Total order over features used by both the sidebar list and the
   * saved JSON. Same rules everywhere so source control stays clean. */
  function compareFeatures(a, b) {
    const ba = markerBucket(a);
    const bb = markerBucket(b);
    if (ba !== bb) return ba - bb;
    // Numbered-town bucket sorts by number first, then name.
    if (ba === 1) {
      const byNumber = natCollator.compare(String(a.number || ''), String(b.number || ''));
      if (byNumber !== 0) return byNumber;
    }
    return natCollator.compare(nameSortKey(a.name), nameSortKey(b.name));
  }

  const listMarkers = $derived([...pins].sort(compareFeatures));

  /** Derive Tailwind-style utility classes from a marker's preset so the
   * sidebar row visually matches how the label renders on the map.
   * (Typography only — layout/spacing stays the sidebar's own.) */
  function markerClasses(pin) {
    const d = findPreset(pin.class) || {};
    const out = [];
    if (d.font === 'body') out.push('font-body');
    else if (d.font === 'heading') out.push('font-heading');
    else if (d.font === 'title') out.push('font-title');
    out.push(`font-${d.weight || 'normal'}`);
    if (d.italic) out.push('italic');
    if (d.case === 'upper') out.push('uppercase');
    else if (d.case === 'title') out.push('capitalize');
    out.push(d.colorClass || 'text-black');
    return out.join(' ');
  }
  import PinProperties from './properties/PinProperties.svelte';
  import TextProperties from './properties/TextProperties.svelte';
  import PathProperties from './properties/PathProperties.svelte';
  import MapProperties from './properties/MapProperties.svelte';

  let maps = $state([]);
  let currentMap = $state(null);
  let pins = $state([]);
  /** Per-map document metadata (title, description, etc.). Persisted at
   * `src/data/maps/<slug>.json` alongside pins under the `meta` key. */
  let mapMeta = $state({});
  // Edit mode = full editor (toolbox, sidebar, click-to-edit). View mode
  // = read-only preview that mirrors what the site viewer will show.
  let mode = $state(localStorage.getItem('map-editor:mode') || 'edit');
  function setMode(m) {
    mode = m;
    localStorage.setItem('map-editor:mode', m);
    // Leaving edit mode: close any open editor and clear selection.
    if (m !== 'edit' && editingId) closeEditor();
  }
  let viewer = $state();
  let viewInfo = $state({ zoom: 0, x: 0, y: 0 });
  let wheelInfo = $state({ deltaX: 0, deltaY: 0, ctrlKey: false, trackpad: false });

  // Editor state. `editingId` is the source of truth for which feature
  // is currently selected/being edited (drives the map's selection).
  // `activeTab` controls which sidebar pane is visible — they're
  // independent, so the user can flip back to the Markers list and
  // then return to the Editor tab without losing their selection.
  let activeTab = $state('markers');
  let editingId = $state(null);
  let dialogTitle = $state('New Marker');
  let pinNumber = $state('1');
  let pinName = $state('');
  let pinDesc = $state('');
  let pinLink = $state('');
  let pinKind = $state('pin');      // 'pin' | 'text' | 'path'
  let pinClass = $state('civic-space'); // typography preset (TEXT_PRESETS or PIN_PRESETS)
  let pinAlign = $state('center');  // 'left' | 'center' | 'right'
  let pinValign = $state('middle'); // 'top' | 'middle' | 'bottom'
  let pinWidth = $state(0);
  let pinHeight = $state(0);
  let pinMinZoom = $state(1);
  let pinLabelPos = $state('n'); // marker label position: n/ne/e/se/s/sw/w/nw
  let pinAnchor = $state('center'); // which point of the pin box sits on (x,y)
  let pinShrink = $state(false);
  // Path feature — the geometry (a, b, cpA, cpB) lives on the pin itself
  // and is mutated via dragging handles. Only the non-geometry fields
  // live in editor state.
  let pathMode = $state('straight');      // 'straight' | 'bezier'
  let pathTextAlign = $state('center');   // 'left' | 'center' | 'right'
  let pathTextBaseline = $state('baseline'); // 'top' | 'middle' | 'baseline'
  let pathFlip = $state(false);

  // Active toolbox mode — determines what clicking the map does
  let toolMode = $state(localStorage.getItem('map-editor:tool') || 'select');

  function setToolMode(mode) {
    toolMode = mode;
    localStorage.setItem('map-editor:tool', mode);
  }

  // Photoshop-style tool shortcuts. Ignored while the user is typing in an
  // input / textarea / contenteditable.
  const TOOL_KEYS = { v: 'select', m: 'pin', t: 'text', p: 'path' };
  function onKeydown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
    const mode = TOOL_KEYS[e.key.toLowerCase()];
    if (mode) {
      e.preventDefault();
      setToolMode(mode);
    }
  }
  $effect(() => {
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  });

  /** Seed / clear bezier control points when the user flips between
   * straight and bezier modes. On first entry to bezier, cpA and cpB
   * are placed one-third of the way along A→B so the curve starts
   * visually coincident with the straight line. */
  function onPathModeChange(_prev, next) {
    if (!editingId) return;
    const pin = pins.find(p => p.id === editingId);
    if (!pin || pin.kind !== 'path') return;
    if (next === 'bezier' && (!pin.cpA || !pin.cpB)) {
      const [ax, ay] = pin.a;
      const [bx, by] = pin.b;
      const dx = bx - ax, dy = by - ay;
      pin.cpA = [Math.round(ax + dx / 3), Math.round(ay + dy / 3)];
      pin.cpB = [Math.round(ax + 2 * dx / 3), Math.round(ay + 2 * dy / 3)];
    }
    // The $effect below will sync `pin.mode` from pathMode; we just
    // nudge pins so the viewer re-renders now.
    pins = pins;
  }

  function applyPreset(presetId) {
    // For text features, the class fully drives font/size/case/letterSpacing
    // via TEXT_PRESETS. No need to copy fields onto the pin.
    pinClass = presetId;
  }

  // --- API ---
  async function fetchMapDoc(slug) {
    const resp = await fetch(`/api/map/${slug}`);
    if (!resp.ok) return { meta: {}, pins: [] };
    const doc = await resp.json();
    const meta = doc.meta || {};
    const rawPins = Array.isArray(doc.pins) ? doc.pins : [];
    // Assign runtime IDs (stripped on save for clean JSON). Paths
    // serialize with a/b only; mirror endpoint A back onto x/y so the
    // shared marker infra (addMarker/updateMarker) can place them.
    const pinsOut = rawPins.map(p => {
      const out = {
        ...p,
        id: p.id || crypto.randomUUID(),
        number: p.number ? String(p.number) : '',
      };
      if (out.kind === 'path' && Array.isArray(out.a)) {
        out.x = out.a[0];
        out.y = out.a[1];
      }
      return out;
    });
    return { meta, pins: pinsOut };
  }

  const natCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  // Per-kind key order for saved JSON. Edit here to change serialization
  // order — any key not listed falls through as alphabetical after
  // the listed ones. Identifying fields come first (kind, class,
  // number/name), then geometry, then style toggles, then metadata.
  const FEATURE_KEY_ORDER = {
    pin:  ['kind', 'class', 'number', 'name', 'x', 'y', 'anchor', 'labelPos', 'minZoom', 'shrink', 'description', 'link'],
    text: ['kind', 'class', 'name', 'x', 'y', 'width', 'height', 'align', 'valign', 'minZoom', 'shrink', 'description', 'link'],
    path: ['kind', 'class', 'name', 'a', 'b', 'mode', 'cpA', 'cpB', 'textAlign', 'textBaseline', 'flip', 'minZoom', 'shrink', 'description', 'link'],
  };

  /** Reorder an object's keys per FEATURE_KEY_ORDER; unlisted keys
   * follow in alphabetical order so future fields still serialize
   * deterministically. */
  function orderFeatureKeys(kind, obj) {
    const order = FEATURE_KEY_ORDER[kind] || [];
    const out = {};
    for (const k of order) if (k in obj) out[k] = obj[k];
    const extras = Object.keys(obj).filter(k => !order.includes(k)).sort();
    for (const k of extras) out[k] = obj[k];
    return out;
  }

  function pinsForSave() {
    return [...pins]
      .sort(compareFeatures)
      .map(({ id, ...rest }) => {
        const kind = rest.kind || (rest.number ? 'pin' : 'text');
        const kd = KIND_DEFAULTS[kind] || {};
        const out = { kind, name: rest.name };
        if (rest.class) out.class = rest.class;
        if (kind === 'pin') {
          if (rest.number) out.number = rest.number;
          out.x = rest.x;
          out.y = rest.y;
          if (rest.anchor && rest.anchor !== kd.anchor) out.anchor = rest.anchor;
          if (rest.labelPos && rest.labelPos !== kd.labelPos) out.labelPos = rest.labelPos;
          if (rest.minZoom != null && rest.minZoom !== kd.minZoom) out.minZoom = rest.minZoom;
        } else if (kind === 'text') {
          out.x = rest.x;
          out.y = rest.y;
          if (rest.width) out.width = rest.width;
          if (rest.height) out.height = rest.height;
          if (rest.align && rest.align !== kd.align) out.align = rest.align;
          if (rest.valign && rest.valign !== kd.valign) out.valign = rest.valign;
          if (rest.minZoom != null && rest.minZoom !== kd.minZoom) out.minZoom = rest.minZoom;
        } else if (kind === 'path') {
          // Paths use `a`/`b` (and `cpA`/`cpB` in bezier mode) for geometry;
          // the top-level x/y mirror `a` and would be redundant.
          out.a = rest.a;
          out.b = rest.b;
          if (rest.mode && rest.mode !== kd.mode) out.mode = rest.mode;
          if (rest.mode === 'bezier') {
            if (rest.cpA) out.cpA = rest.cpA;
            if (rest.cpB) out.cpB = rest.cpB;
          }
          if (rest.textAlign && rest.textAlign !== kd.textAlign) out.textAlign = rest.textAlign;
          if (rest.textBaseline && rest.textBaseline !== kd.textBaseline) out.textBaseline = rest.textBaseline;
          if (rest.flip && rest.flip !== kd.flip) out.flip = true;
          if (rest.minZoom != null && rest.minZoom !== kd.minZoom) out.minZoom = rest.minZoom;
        }
        if (rest.shrink) out.shrink = true;
        if (rest.description) out.description = rest.description;
        if (rest.link) out.link = rest.link;
        return orderFeatureKeys(kind, out);
      });
  }

  function mapDocForSave() {
    // Drop empty-string / undefined meta fields so JSON stays tidy.
    const meta = {};
    for (const [k, v] of Object.entries(mapMeta)) {
      if (v == null) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      meta[k] = v;
    }
    return { meta, pins: pinsForSave() };
  }

  async function saveMapDoc() {
    if (!currentMap) return;
    await fetch(`/api/map/${currentMap.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapDocForSave(), null, 2),
    });
  }

  // Kept as an alias so existing call sites continue to read clearly even
  // though the persisted unit is now the whole doc, not just pins.
  const savePins = saveMapDoc;

  // Gate to suppress the auto-save effect during initial map load.
  let metaLoaded = $state(false);

  async function selectMap(mapInfo) {
    metaLoaded = false;
    currentMap = mapInfo;
    localStorage.setItem('map-editor:last-map', mapInfo.slug);
    const doc = await fetchMapDoc(mapInfo.slug);
    mapMeta = doc.meta;
    pins = doc.pins;
    // Let the reactive graph settle on the loaded values before enabling
    // auto-save, so the load itself doesn't trigger a PUT.
    queueMicrotask(() => { metaLoaded = true; });
  }

  // Persist meta edits with the same debounce as pin edits.
  $effect(() => {
    // Touch all tracked meta fields so Svelte subscribes.
    JSON.stringify(mapMeta);
    if (!metaLoaded) return;
    scheduleSave();
  });

  function onMapSelect(e) {
    const m = maps.find(m => m.slug === e.target.value);
    if (m) selectMap(m);
  }

  // --- Pin actions (called by tools via ctx) ---
  /** Generic "create a feature" — tool passes the kind and shape fields */
  function createFeature(data) {
    const id = crypto.randomUUID();
    const kind = data.kind || 'pin';
    editingId = id;
    pinKind = kind;
    pinName = '';
    pinDesc = '';
    pinLink = '';
    // KIND_DEFAULTS is the single source of truth for per-kind defaults.
    const kd = KIND_DEFAULTS[kind] || {};
    pinAlign = kd.align || 'center';
    pinValign = kd.valign || 'middle';
    pinWidth = data.width || 0;
    pinHeight = data.height || 0;
    pinShrink = false;
    pinLabelPos = kd.labelPos || 'n';
    pinAnchor = kd.anchor || 'center';
    pathMode = kd.mode || 'straight';
    pathTextAlign = kd.textAlign || 'center';
    pathTextBaseline = kd.textBaseline || 'baseline';
    pathFlip = kd.flip ?? false;
    pinClass = kd.class || '';
    pinMinZoom = kd.minZoom ?? 0;

    if (kind === 'pin') {
      const usedNums = new Set(pins.filter(p => (p.kind || 'pin') === 'pin').map(p => p.number).filter(Boolean));
      let next = 1;
      while (usedNums.has(String(next))) next++;
      pinNumber = String(next);
      dialogTitle = 'New Marker';
    } else if (kind === 'text') {
      pinNumber = '';
      dialogTitle = 'New Text';
    } else if (kind === 'path') {
      pinNumber = '';
      dialogTitle = 'New Path';
    } else {
      pinNumber = '';
      dialogTitle = 'New';
    }

    // Paths are anchored at endpoint A; mirror onto x/y so the shared
    // marker infra (addMarker/updateMarker) can place the SVG correctly.
    const isPath = kind === 'path';
    const a = isPath ? data.a : null;
    const b = isPath ? data.b : null;
    const x = isPath ? a[0] : data.x;
    const y = isPath ? a[1] : data.y;

    pins = [...pins, {
      id,
      kind,
      number: pinNumber,
      name: '(new)',
      class: pinClass,
      align: pinAlign,
      valign: pinValign,
      width: pinWidth,
      height: pinHeight,
      minZoom: pinMinZoom,
      shrink: pinShrink,
      labelPos: kind === 'pin' ? pinLabelPos : undefined,
      anchor: kind === 'pin' ? pinAnchor : undefined,
      x,
      y,
      ...(isPath ? { a, b, mode: pathMode, textAlign: pathTextAlign, textBaseline: pathTextBaseline, flip: pathFlip } : {}),
    }];
    activeTab = 'editor';
  }

  const MIN_BOX_SIZE = 20; // minimum width/height for a text box (image px)

  /** Clamp a text box's center+size so its bounds stay within the map. */
  function clampBox(x, y, w, h) {
    if (!currentMap) return { x, y, w, h };
    const mw = currentMap.width, mh = currentMap.height;
    // Cap box dims to map size and enforce minimum
    w = Math.max(MIN_BOX_SIZE, Math.min(mw, w || 0));
    h = Math.max(MIN_BOX_SIZE, Math.min(mh, h || 0));
    // Clamp center so box edges stay within [0, mw]/[0, mh]
    x = Math.max(w / 2, Math.min(mw - w / 2, x));
    y = Math.max(h / 2, Math.min(mh - h / 2, y));
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }

  /** Clamp a point pin so it stays within the map. */
  function clampPoint(x, y) {
    if (!currentMap) return { x, y };
    return {
      x: Math.max(0, Math.min(currentMap.width, x)),
      y: Math.max(0, Math.min(currentMap.height, y)),
    };
  }

  /** Tool → ctx helpers */
  const editorCtx = {
    create: createFeature,
    edit: (pin) => editFeature(pin),
    updatePos: (pin, x, y) => {
      if (pin.kind === 'path') {
        // Whole-path drag: translate endpoints + control points by the
        // delta between the old and new anchor (endpoint A). Clamped
        // so the drag can't push any point off-map.
        const dx = x - pin.a[0];
        const dy = y - pin.a[1];
        const shift = (p) => clampPoint(p[0] + dx, p[1] + dy);
        const na = shift(pin.a);
        const nb = shift(pin.b);
        pin.a = [na.x, na.y];
        pin.b = [nb.x, nb.y];
        if (pin.cpA) { const n = shift(pin.cpA); pin.cpA = [n.x, n.y]; }
        if (pin.cpB) { const n = shift(pin.cpB); pin.cpB = [n.x, n.y]; }
        pin.x = pin.a[0];
        pin.y = pin.a[1];
        pins = pins;
        viewer?.updateMarker(pin);
        savePins();
        return;
      }
      if (pin.width && pin.height) {
        ({ x, y } = clampBox(x, y, pin.width, pin.height));
      } else {
        ({ x, y } = clampPoint(x, y));
      }
      pin.x = x;
      pin.y = y;
      pins = pins;
      viewer?.updateMarker(pin);
      savePins();
    },
    resize: (pin, x, y, w, h) => {
      ({ x, y, w, h } = clampBox(x, y, w, h));
      pin.x = x;
      pin.y = y;
      pin.width = w;
      pin.height = h;
      // Sync editor form if this is the active pin
      if (editingId === pin.id) {
        pinWidth = w;
        pinHeight = h;
      }
      pins = pins;
      viewer?.updateMarker(pin);
    },
    commit: () => savePins(),
    /** Move a path endpoint (a/b) or bezier control point (cpA/cpB) to
     * a new image-pixel position. Called from MapViewer while the user
     * drags a path handle. Endpoint moves also drag the matching
     * control point along with them so the local curve keeps its shape. */
    updatePathPoint: (pin, which, x, y) => {
      if (pin.kind !== 'path') return;
      const { x: cx, y: cy } = clampPoint(x, y);
      if (which === 'a' || which === 'b') {
        const prev = pin[which] || [pin.x, pin.y];
        const dx = cx - prev[0];
        const dy = cy - prev[1];
        pin[which] = [cx, cy];
        if (pin.mode === 'bezier') {
          const cpKey = which === 'a' ? 'cpA' : 'cpB';
          const cp = pin[cpKey] || prev;
          pin[cpKey] = [cp[0] + dx, cp[1] + dy];
        }
        if (which === 'a') { pin.x = cx; pin.y = cy; }
      } else if (which === 'cpA' || which === 'cpB') {
        pin[which] = [cx, cy];
      }
      pins = pins;
      viewer?.updateMarker(pin);
      scheduleSave();
    },
    deselect: () => {
      if (!editingId) return;
      // Flush any pending debounced edits before closing — otherwise a
      // quick deselect after a preset change can lose the last change.
      editingId = null;
      activeTab = 'markers';
      savePins();
    },
  };

  function editFeature(pin) {
    editingId = pin.id;
    // Determine kind from stored field or infer from number presence
    pinKind = pin.kind || (pin.number ? 'pin' : 'text');
    dialogTitle = pinKind === 'pin' ? 'Edit Marker' : pinKind === 'path' ? 'Edit Path' : 'Edit Text';
    pinNumber = pin.number != null ? String(pin.number) : '';
    pinName = pin.name;
    pinDesc = pin.description || '';
    pinLink = pin.link || '';
    const kd = KIND_DEFAULTS[pinKind] || {};
    pinClass = pin.class || kd.class || '';
    pinAlign = pin.align || kd.align || 'center';
    pinValign = pin.valign || kd.valign || 'middle';
    pinWidth = pin.width || 0;
    pinHeight = pin.height || 0;
    pinMinZoom = pin.minZoom ?? kd.minZoom ?? 0;
    pinShrink = !!pin.shrink;
    pinLabelPos = pin.labelPos || kd.labelPos || 'n';
    pinAnchor = pin.anchor || kd.anchor || 'center';
    pathMode = pin.mode || kd.mode || 'straight';
    pathTextAlign = pin.textAlign || kd.textAlign || 'center';
    pathTextBaseline = pin.textBaseline || kd.textBaseline || 'baseline';
    pathFlip = pin.flip ?? kd.flip ?? false;
    // Apply default size for text features that were created as point-labels
    if (pinKind === 'text' && (!pinWidth || !pinHeight)) {
      pinWidth = 300;
      pinHeight = 80;
    }
    activeTab = 'editor';
  }


  // Update the preview/editing pin live as form fields change
  $effect(() => {
    if (!editingId) return;
    const pin = pins.find(p => p.id === editingId);
    if (!pin) return;
    const name = pinName.trim() || '(new)';
    const num = pinNumber;
    const kind = pinKind;
    const cls = pinClass;
    const align = pinAlign;
    const valign = pinValign;
    // Clamp the box to valid bounds (respect map edges + minimum size).
    // Also sync clamped values back into the editor state so the inputs
    // can't display invalid values.
    let w = pinWidth, h = pinHeight;
    let x = pin.x, y = pin.y;
    if (kind === 'text' && w && h) {
      const c = clampBox(pin.x, pin.y, w, h);
      x = c.x; y = c.y; w = c.w; h = c.h;
      if (pinWidth !== w) pinWidth = w;
      if (pinHeight !== h) pinHeight = h;
    }
    const mz = pinMinZoom;
    const sh = pinShrink;
    const lp = kind === 'pin' ? pinLabelPos : undefined;
    const an = kind === 'pin' ? pinAnchor : undefined;
    const pmode = kind === 'path' ? pathMode : undefined;
    const pta = kind === 'path' ? pathTextAlign : undefined;
    const ptb = kind === 'path' ? pathTextBaseline : undefined;
    const pflip = kind === 'path' ? pathFlip : undefined;
    const desc = pinDesc.trim() || undefined;
    const link = pinLink.trim() || undefined;
    if (pin.name !== name || pin.number !== num || pin.kind !== kind || pin.class !== cls || pin.align !== align || pin.valign !== valign || pin.width !== w || pin.height !== h || pin.x !== x || pin.y !== y || pin.minZoom !== mz || pin.shrink !== sh || pin.labelPos !== lp || pin.anchor !== an || pin.mode !== pmode || pin.textAlign !== pta || pin.textBaseline !== ptb || pin.flip !== pflip || pin.description !== desc || pin.link !== link) {
      pin.name = name;
      pin.number = num;
      pin.kind = kind;
      pin.class = cls;
      pin.align = align;
      pin.valign = valign;
      pin.width = w;
      pin.height = h;
      pin.x = x;
      pin.y = y;
      pin.minZoom = mz;
      pin.shrink = sh;
      pin.labelPos = lp;
      pin.anchor = an;
      pin.mode = pmode;
      pin.textAlign = pta;
      pin.textBaseline = ptb;
      pin.flip = pflip;
      pin.description = desc;
      pin.link = link;
      viewer?.updateMarker(pin);
      pins = pins;
      scheduleSave();
    }
  });

  function onDelete() {
    if (!editingId) return;
    pins = pins.filter(p => p.id !== editingId);
    editingId = null;
    activeTab = 'markers';
    savePins();
  }

  /** Close the editor without deleting the feature. Auto-saved changes stay. */
  function closeEditor() {
    editingId = null;
    activeTab = 'markers';
  }

  // Debounced auto-save — every edit in the $effect above triggers this.
  let saveTimer;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => savePins(), 300);
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(pinsForSave(), null, 2));
  }

  function clearAll() {
    if (!confirm('Clear all pins?')) return;
    pins = [];
    savePins();
  }

  function clickPin(pin) {
    viewer.panTo(pin);
  }

  // --- Init ---
  import { onMount } from 'svelte';

  onMount(async () => {
    const resp = await fetch('/api/maps');
    maps = await resp.json();

    const lastSlug = localStorage.getItem('map-editor:last-map');
    const initial = maps.find(m => m.slug === lastSlug) || maps[0];
    if (initial) selectMap(initial);
  });
</script>

<header>
  <h1>Toad Mapper</h1>
  <select title="Select map" onchange={onMapSelect} value={currentMap?.slug}>
    {#each maps as m}
      <option value={m.slug}>{m.name}</option>
    {/each}
  </select>
  <div class="mode-toggle" role="radiogroup" aria-label="Mode">
    <button type="button" role="radio" aria-checked={mode === 'edit'} class:active={mode === 'edit'} onclick={() => setMode('edit')}>Edit</button>
    <button type="button" role="radio" aria-checked={mode === 'view'} class:active={mode === 'view'} onclick={() => setMode('view')}>View</button>
  </div>
</header>

<!-- Force-load every font weight we reference from inline styles so the
     browser fetches them on page load instead of lazily per-marker. -->
<div class="font-primer" aria-hidden="true">
  <span style="font-family: 'Lora'; font-weight: 400">.</span>
  <span style="font-family: 'Lora'; font-weight: 500">.</span>
  <span style="font-family: 'Lora'; font-weight: 600">.</span>
  <span style="font-family: 'Lora'; font-weight: 700">.</span>
  <span style="font-family: 'Lora'; font-style: italic; font-weight: 400">.</span>
  <span style="font-family: 'Lora'; font-style: italic; font-weight: 600">.</span>
  <span style="font-family: 'Crimson Pro'; font-weight: 400">.</span>
  <span style="font-family: 'Crimson Pro'; font-weight: 600">.</span>
  <span style="font-family: 'Crimson Pro'; font-weight: 700">.</span>
  <span style="font-family: 'Crimson Pro'; font-style: italic; font-weight: 400">.</span>
  <span style="font-family: 'Uncial Antiqua'">.</span>
</div>

<div class="layout">
  <div class="map-wrapper">
    {#if mode === 'edit'}
    <div class="toolbox">
      {#each TOOL_LIST as t}
        <button
          type="button"
          title={`${t.label} (${ {select:'V',pin:'M',text:'T',path:'P'}[t.id] || '' })`}
          class:active={toolMode === t.id}
          onclick={() => setToolMode(t.id)}
          aria-label={t.label}
        >
          {#if t.id === 'select'}
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M4 2 L4 18 L8 14 L11 21 L14 20 L11 13 L18 13 Z"/></svg>
          {:else if t.id === 'text'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>
          {:else if t.id === 'pin'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          {:else if t.id === 'path'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 17A12 12 0 0 1 17 5"/></svg>
          {/if}
        </button>
      {/each}
    </div>
    {/if}
    {#if currentMap}
      {#key currentMap.slug}
        <MapViewer
          bind:this={viewer}
          width={currentMap.width}
          height={currentMap.height}
          imageUrl={`/maps/${currentMap.file}`}
          tiles={currentMap.tiles}
          initialZoom={currentMap.initialZoom}
          minZoom={currentMap.minZoom}
          maxZoom={currentMap.maxZoom}
          {pins}
          halo={mapMeta.halo}
          editable={mode === 'edit'}
          tool={mode === 'edit' ? TOOLS[toolMode] : null}
          ctx={editorCtx}
          selectedId={editingId}
          onviewchange={(v) => viewInfo = v}
          onwheel={(w) => wheelInfo = w}
        />
      {/key}
    {/if}
  </div>
  {#if mode === 'edit'}
  <div class="sidebar">
    <div class="tabs">
      <button class:active={activeTab === 'markers'} onclick={() => activeTab = 'markers'}>Markers</button>
      <button
        class:active={activeTab === 'editor'}
        onclick={() => activeTab = 'editor'}
      >{editingId ? dialogTitle : 'Map'}</button>
    </div>
    {#if activeTab === 'editor' && !editingId}
      <div class="pin-editor">
        <MapProperties
          bind:title={mapMeta.title}
          bind:description={mapMeta.description}
          bind:halo={mapMeta.halo}
        />
      </div>
    {:else if activeTab === 'editor' && editingId}
      <div class="pin-editor">
        <form onsubmit={(e) => { e.preventDefault(); closeEditor(); }}>
          {#if pinKind === 'pin'}
            <PinProperties
              bind:number={pinNumber}
              bind:cls={pinClass}
              bind:minZoom={pinMinZoom}
              bind:shrink={pinShrink}
              bind:labelPos={pinLabelPos}
              bind:anchor={pinAnchor}
            />
          {:else if pinKind === 'text'}
            <TextProperties
              bind:preset={pinClass}
              bind:align={pinAlign}
              bind:valign={pinValign}
              bind:width={pinWidth}
              bind:height={pinHeight}
              bind:minZoom={pinMinZoom}
              bind:shrink={pinShrink}
              onApplyPreset={applyPreset}
            />
          {:else if pinKind === 'path'}
            <PathProperties
              bind:cls={pinClass}
              bind:mode={pathMode}
              bind:textAlign={pathTextAlign}
              bind:textBaseline={pathTextBaseline}
              bind:flip={pathFlip}
              bind:minZoom={pinMinZoom}
              bind:shrink={pinShrink}
              onModeChange={onPathModeChange}
            />
          {/if}
          <label>Label <input type="text" bind:value={pinName} required autocomplete="off" /></label>
          <label>Description <textarea bind:value={pinDesc} rows="8"></textarea></label>
          <label>Link <input type="text" bind:value={pinLink} placeholder="/world/places/#anchor" autocomplete="off" /></label>
          <div class="dialog-buttons">
            <button type="button" class="danger" onclick={onDelete}>Delete</button>
          </div>
        </form>
      </div>
    {:else}
      <ul class="pin-list">
        {#each listMarkers as pin}
          {@const preset = findPreset(pin.class)}
          <li>
            <div class="pin-row">
              <button class="pin-list-btn" onclick={() => clickPin(pin)}>
                {#if preset?.category === 'overworld'}
                  <span class="pin-glyph">{preset.icon}</span>
                {:else if pin.class === 'map-title'}
                  <span class="pin-glyph">✵</span>
                {:else if pin.kind === 'path'}
                  <span class="pin-glyph pin-path-icon">
                    <svg viewBox="0 0 24 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                      <path d="M2 8 C 6 2 8 14 12 8 S 18 2 22 8"/>
                    </svg>
                  </span>
                {:else if pin.number}
                  <span class="pin-num">{pin.number}</span>
                {:else}
                  <span class="pin-label-icon">Aa</span>
                {/if}
                <strong class={markerClasses(pin)}>{pin.name}</strong>
              </button>
              <button class="pin-list-edit" onclick={() => editFeature(pin)} aria-label="Edit {pin.name}" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="actions">
      <button onclick={copyJson}>Copy JSON</button>
      <button class="danger" onclick={clearAll}>Clear All</button>
    </div>
  </div>
  {/if}
</div>

<footer class="status-bar">
  <span>z{viewInfo.zoom.toFixed(1)}</span>
  <span>({viewInfo.x}, {viewInfo.y})</span>
  <span>dX={wheelInfo.deltaX.toFixed(1)}</span>
  <span>dY={wheelInfo.deltaY.toFixed(1)}</span>
  <span>ctrl={wheelInfo.ctrlKey}</span>
  <span>{wheelInfo.trackpad ? 'trackpad' : 'mouse'}</span>
</footer>

<style>
  :global(*) { box-sizing: border-box; }
  :global(body) {
    font-family: var(--body-font);
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    margin: 0;
    overflow: hidden;
  }
  :global(#app) {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  header {
    padding: 0.5rem 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    border-bottom: var(--border-width) solid var(--border);
    background: var(--bg);
    color: var(--text);
  }
  header h1 { font-family: var(--title-font); font-size: 1rem; margin: 0; color: var(--title-color); }
  header select {
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--border);
    background: var(--accent-bg);
    color: inherit;
    border-radius: var(--border-radius);
    font: inherit;
    font-size: 0.85rem;
  }
  .status-bar {
    display: flex;
    gap: 1rem;
    padding: 0.25rem 0.75rem;
    border-top: var(--border-width) solid var(--border);
    font-size: 0.75rem;
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
    font-family: var(--mono-font);
  }
  .status-bar span { white-space: nowrap; }

  .mode-toggle {
    display: flex;
    gap: 0;
    margin-left: auto;
    border: 1px solid var(--border);
    border-radius: var(--border-radius);
    overflow: hidden;
  }
  .mode-toggle button {
    padding: 0.3rem 0.75rem;
    font: 700 0.8rem/1 var(--heading-font);
    border: none;
    background: var(--bg);
    color: var(--text);
    border-radius: 0;
    cursor: pointer;
  }
  .mode-toggle button + button { border-left: 1px solid var(--border); }
  .mode-toggle button:hover { background: var(--accent-bg); }
  .mode-toggle button.active { background: var(--accent); color: var(--accent-text); }
  .font-primer { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; pointer-events: none; visibility: hidden; }

  .layout { flex: 1; display: flex; overflow: hidden; min-height: 0; position: relative; }
  .map-wrapper { flex: 1; min-width: 0; min-height: 0; position: relative; }

  /* Sidebar uses the map's paper palette so typography previews render
     the way they will on an actual map tile. The vars below propagate
     into nested property-panel components. */
  /* Sidebar uses the shared site tokens directly — `--border`, `--accent`,
     etc. cascade into any nested property-panel components. The local
     `--panel-*` aliases are kept for backward compat with components that
     already read them. */
  .sidebar {
    /* Floats over the map: absolutely positioned inside the .layout with
       --space margins on every side. Width derives from --map-padding so
       the panel sits within the map's pan-out area. */
    position: absolute;
    top: var(--space);
    right: var(--space);
    bottom: var(--space);
    width: calc(var(--map-padding) - 2 * var(--space));
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    background: var(--bg);
    color: var(--text);
    border: var(--border-width) solid var(--border);
    border-radius: var(--border-radius);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    z-index: 500;
    --panel-bg: var(--bg);
    --panel-text: var(--text);
    --panel-border: var(--border);
    --panel-accent: var(--accent);
    --panel-hover: rgba(0, 0, 0, 0.06);
  }
  .tabs {
    display: flex;
    padding: var(--space-sm);
    border-bottom: 1px solid var(--panel-border);
  }
  /* Use `.sidebar .tabs button` so these override the later
     `.sidebar button` block. Adjacent corners (right side of the first
     tab, left side of the last) stay square so the pair reads as one
     segmented control. */
  .sidebar .tabs button {
    flex: 1;
    padding: 0.5rem 0.75rem;
    font-family: var(--heading-font);
    font-size: 0.9rem;
    font-weight: 700;
    background: none;
    color: inherit;
    cursor: pointer;
    border: 1px solid var(--panel-border);
  }
  .sidebar .tabs button:first-child {
    border-radius: var(--border-radius) 0 0 var(--border-radius);
    border-right-width: 0;
  }
  .sidebar .tabs button:last-child {
    border-radius: 0 var(--border-radius) var(--border-radius) 0;
  }
  .sidebar .tabs button:only-child {
    border-radius: var(--border-radius);
    border-right-width: 1px;
  }
  .sidebar .tabs button:hover:not(:disabled):not(.active) { background: var(--panel-hover); }
  .sidebar .tabs button.active { background: var(--panel-accent); color: var(--accent-text); border-color: var(--panel-accent); }
  .sidebar .tabs button:disabled { opacity: 0.3; cursor: not-allowed; }

  .pin-list { list-style: none; padding: 0; margin: 0; flex: 1; overflow-y: auto; }
  .pin-row {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }
  .pin-list li:last-child .pin-row { border-bottom: none; }
  .sidebar .pin-list-btn {
    flex: 1;
    min-width: 0;
    text-align: left;
    padding: 0.35rem 0.375rem;
    font-size: 0.85rem;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    border-radius: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .sidebar .pin-row:hover { background: var(--panel-hover); }
  .sidebar .pin-list-edit {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .sidebar .pin-row:hover .pin-list-edit,
  .sidebar .pin-list-edit:focus-visible { opacity: 0.7; }
  .sidebar .pin-list-edit:hover { opacity: 1; }
  .sidebar .pin-list-edit svg { width: 18px; height: 18px; }
  .pin-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: 2px solid #c9a96e;
    border-radius: 50%;
    background: #fff;
    color: #3b2e1e;
    font: 700 11px/1 'Crimson Pro', serif;
    flex-shrink: 0;
  }
  .pin-label-icon {
    font: italic 700 11px/1 'Crimson Pro', serif;
    opacity: 0.5;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }
  .pin-glyph {
    flex-shrink: 0;
    width: 20px;
    text-align: center;
    font-size: 16px;
    line-height: 1;
  }
  .pin-path-icon { display: inline-flex; align-items: center; justify-content: center; }
  .pin-path-icon svg { width: 22px; height: 10px; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.5rem 0.75rem; border-top: 1px solid var(--panel-border); }
  .actions button { flex: 1; min-width: calc(50% - 0.25rem); }

  /* Sidebar buttons override the dark default. */
  .sidebar button {
    padding: 0.35rem 0.7rem;
    cursor: pointer;
    border: 1px solid var(--panel-border);
    background: transparent;
    color: inherit;
    border-radius: 3px;
    font: inherit;
    font-size: 0.85rem;
  }
  .sidebar button:hover { background: var(--panel-hover); }
  .sidebar button.active { background: var(--panel-accent); color: #fff; border-color: var(--panel-accent); }
  .sidebar .danger:hover { background: #8b2020; border-color: #8b2020; color: #fff; }

  /* Preserve dark-theme defaults elsewhere (header/footer/toolbox). */
  button {
    padding: 0.35rem 0.7rem;
    cursor: pointer;
    border: 1px solid #5c4a32;
    background: #2a1f14;
    color: inherit;
    border-radius: 3px;
    font: inherit;
    font-size: 0.85rem;
  }
  button:hover { background: #8b6914; }
  button.active { background: #8b6914; }
  .danger:hover { background: #8b2020; border-color: #8b2020; }

  .pin-editor {
    padding: 0.75rem;
    flex: 1;
    overflow-y: auto;
  }
  .pin-editor label { display: block; margin-bottom: 0.6rem; font-size: 0.85rem; }
  .pin-editor input, .pin-editor textarea {
    display: block;
    width: 100%;
    margin-top: 0.2rem;
    padding: 0.4rem;
    border: 1px solid var(--panel-border);
    background: #fff;
    color: inherit;
    border-radius: 3px;
    font: inherit;
  }
  /* Floating toolbox below the Leaflet zoom control */
  .toolbox {
    position: absolute;
    top: 90px;
    left: 10px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0;
    background: var(--bg);
    border: var(--border-width) solid var(--border);
    border-radius: var(--border-radius);
    overflow: hidden;
    box-shadow: 0 1px 5px rgba(0, 0, 0, 0.3);
  }
  .toolbox button {
    width: 26px;
    height: 26px;
    padding: 0;
    background: var(--bg);
    color: var(--text);
    border: none;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    font-family: var(--body-font);
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .toolbox button:last-child { border-bottom: none; }
  .toolbox button:hover { background: var(--accent-bg); }
  .toolbox button.active { background: var(--accent); color: var(--accent-text); }
  .toolbox svg { width: 18px; height: 18px; }

  /* Leaflet zoom control — match site style (parchment bg, gold border,
     dark text, Lora). Leaflet ships its own defaults; override them. */
  :global(.leaflet-bar) {
    border: var(--border-width) solid var(--border) !important;
    border-radius: var(--border-radius) !important;
    box-shadow: 0 1px 5px rgba(0, 0, 0, 0.3) !important;
    background-clip: padding-box;
  }
  :global(.leaflet-bar a),
  :global(.leaflet-bar a:hover) {
    background: var(--bg);
    color: var(--text);
    border-bottom: 1px solid var(--border) !important;
    font-family: var(--body-font);
  }
  :global(.leaflet-bar a:last-child) { border-bottom: none !important; }
  :global(.leaflet-bar a:hover) { background: var(--accent-bg); }
  :global(.leaflet-bar a.leaflet-disabled) { opacity: 0.4; }

  .dialog-buttons { display: flex; gap: 0.5rem; margin-top: 1rem; }

</style>
