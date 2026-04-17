<script>
  import { onMount, onDestroy } from 'svelte';
  import { TEXT_PRESETS, PIN_PRESETS, PATH_PRESETS, DEFAULT_MARKER_MIN_ZOOM, KIND_DEFAULTS, sizeSpec, sizeClass as getSizeClass } from './tools.js';
  import './map-viewer.scss';

  let { width, height, imageUrl, tiles, initialZoom, fit = 'bounds', minZoom = 0, maxZoom = 5, pins = [], editable = false, tool = null, ctx = null, selectedId: selectedIdProp = null, onviewchange, onwheel: onwheelcb } = $props();

  // View-mode selection is internal (no external owner); edit-mode
  // selection is driven by the editor via the `selectedId` prop.
  let viewSelectedId = $state(null);
  const selectedId = $derived(editable ? selectedIdProp : viewSelectedId);

  // `tool` is the active tool module from tools.js. `ctx` is supplied by the
  // editor and exposes methods the tool can call to effect change (create,
  // edit, showRect, etc.). The MapViewer itself is a thin dispatcher.
  const selectable = $derived(tool?.selectable ?? false);

  let mapEl;
  let map = $state();
  const markerMap = new Map();

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  const FONTS = {
    body: "'Lora', serif",
    heading: "'Crimson Pro', serif",
    title: "'Uncial Antiqua', serif",
  };
  const REF_ZOOM = 2;
  const MOBILE_MIN_PX = 16;
  // Fallback size for features without a style (e.g. numbered pin labels).
  const PIN_LABEL_SIZE = { base: 14, min: 11, max: 22 };
  // Visibility thresholds expressed as zoom levels. All comparisons
  // go through the CRS scale function (CSS-px per image-px) so the
  // same threshold behaves consistently regardless of image size,
  // tile pyramid, or device pixel ratio.
  const MARKER_HIDE_ZOOM = 0.25;   // markers vanish entirely below this
  const PIN_SHRINK_ZOOM  = 1.5;    // numbered pins → empty 12px dots
  // Convert a zoom level to CSS-px-per-image-px using the active CRS.
  function scaleAt(z) {
    if (map?.options?.crs?.scale) return map.options.crs.scale(z);
    return Math.pow(2, z);
  }
  // Current render scale (CSS-px per image-px).
  function currentScale(z) {
    return scaleAt(z ?? map?.getZoom() ?? REF_ZOOM);
  }
  // Maximum distance (in CSS pixels) the viewport may pan past the edge
  // of the map image. Kept in sync with --map-padding in tokens.scss
  // (which the floating sidebar uses to size itself).
  const HANDLE_POSITIONS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  function isMobile() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  }


  /** Read a CSS custom property (e.g. `--border`) from the map container. */
  function getCss(name) {
    if (!mapEl) return '';
    return getComputedStyle(mapEl).getPropertyValue(name).trim();
  }

  /**
   * Resolve a feature's styling from its `class`. The preset defines
   * font/case/letterSpacing/italic/bold/base/min/max — those fields live on
   * the preset, not the pin. Text features use TEXT_PRESETS, numbered pins
   * use PIN_PRESETS.
   */
  function resolvePreset(pin) {
    let list;
    if (pin.kind === 'path') list = PATH_PRESETS;
    else if (pin.number) list = PIN_PRESETS;
    else list = TEXT_PRESETS;
    // Sensible fallbacks per kind.
    const fallback = pin.kind === 'path' ? 'river' : (pin.number ? 'shop' : null);
    const id = pin.class || fallback;
    if (!id) return null;
    return list[id];
  }

  function computeFontSize(pin, zoom) {
    const z = zoom ?? REF_ZOOM;
    const isMobileView = isMobile();

    // Text features pick sizes from their class (preset). Fallback for
    // pin labels uses PIN_LABEL_SIZE. Size scales linearly with zoom
    // (2^(z - REF_ZOOM)), clamped to [min, max]. On mobile the floor
    // is always MOBILE_MIN_PX (16px).
    const preset = resolvePreset(pin);
    const spec = preset ? sizeSpec(preset.size) : PIN_LABEL_SIZE;

    // Shrink mode: pin the size to `base` at the feature's min-zoom and
    // scale up from there (doubling per zoom level), clamped to max.
    // Default mode: scale from `base` at REF_ZOOM, clamped to [min, max].
    const pivot = pin.shrink ? (pin.minZoom ?? REF_ZOOM) : REF_ZOOM;
    const scale = Math.pow(2, z - pivot);
    const raw = spec.base * scale;
    const min = isMobileView ? Math.max(MOBILE_MIN_PX, spec.min ?? 0) : (spec.min ?? 0);
    const max = spec.max ?? Infinity;
    return Math.max(min, Math.min(max, raw));
  }


  function extraStyles(s) {
    const parts = [];
    if (s.case && s.case !== 'none') {
      const tx = s.case === 'upper' ? 'uppercase' : s.case === 'lower' ? 'lowercase' : 'capitalize';
      parts.push(`text-transform: ${tx}`);
    }
    if (s.letterSpacing) parts.push(`letter-spacing: ${s.letterSpacing}px`);
    return parts.join('; ');
  }

  /** Path feature: text flowing along an invisible curve from A to B.
   * `mode: 'bezier'` adds a cubic curve via two tangent control points. */
  function makePathIcon(pin, currentZoom) {
    const z = currentZoom ?? map?.getZoom() ?? REF_ZOOM;
    const zoomScale = map?.options?.crs?.scale ? map.options.crs.scale(z) : Math.pow(2, z);

    const s = resolvePreset(pin) || {};
    const font = FONTS[s.font] || FONTS.body;
    const fontSize = computeFontSize(pin, currentZoom);
    const weightClass = `font-${s.weight || 'normal'}`;
    const style = s.italic ? 'italic' : 'normal';
    const extra = extraStyles(s);
    const sizeClass = getSizeClass(s.size);
    const colorClass = s.colorClass || 'text-black';

    const a = pin.a || [pin.x, pin.y];
    const b = pin.b || [pin.x, pin.y];
    const useBezier = pin.mode === 'bezier';
    const cpA = pin.cpA || a;
    const cpB = pin.cpB || b;

    // Image-pixel bbox covering endpoints + (when bezier) tangent points.
    // Pad by ~1.5 × font cap-height in image px so descenders/ascenders
    // don't clip when text sits above/below the curve.
    const pts = useBezier ? [a, b, cpA, cpB] : [a, b];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    const padImg = (fontSize * 1.5) / zoomScale;
    minX -= padImg; maxX += padImg;
    minY -= padImg; maxY += padImg;

    const cssW = (maxX - minX) * zoomScale;
    const cssH = (maxY - minY) * zoomScale;
    const px = (p) => [(p[0] - minX) * zoomScale, (p[1] - minY) * zoomScale];
    const [Ax, Ay] = px(a);
    const [Bx, By] = px(b);
    // Build the path d. When `flip` is true we reverse the curve's
    // direction so the text renders on the opposite side (SVG 2's
    // `textPath side="right"` would be simpler but has patchy browser
    // support — reversing the path works everywhere).
    const flip = !!pin.flip;
    const fmt = (n) => n.toFixed(1);
    const d = useBezier
      ? (() => {
          const [cax, cay] = px(cpA);
          const [cbx, cby] = px(cpB);
          return flip
            ? `M ${fmt(Bx)} ${fmt(By)} C ${fmt(cbx)} ${fmt(cby)} ${fmt(cax)} ${fmt(cay)} ${fmt(Ax)} ${fmt(Ay)}`
            : `M ${fmt(Ax)} ${fmt(Ay)} C ${fmt(cax)} ${fmt(cay)} ${fmt(cbx)} ${fmt(cby)} ${fmt(Bx)} ${fmt(By)}`;
        })()
      : flip
        ? `M ${fmt(Bx)} ${fmt(By)} L ${fmt(Ax)} ${fmt(Ay)}`
        : `M ${fmt(Ax)} ${fmt(Ay)} L ${fmt(Bx)} ${fmt(By)}`;

    // Text alignment stays visually consistent across flip by swapping
    // left/right when the path direction is reversed.
    const rawAlign = pin.textAlign || 'center';
    const align = flip && rawAlign === 'left' ? 'right' : flip && rawAlign === 'right' ? 'left' : rawAlign;
    const startOffset = align === 'left' ? '0%' : align === 'right' ? '100%' : '50%';
    const textAnchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
    // Vertical placement of text relative to the path:
    //   'top'      — path sits above the text (text hangs below)
    //   'middle'   — path runs through the middle of the glyphs
    //   'baseline' — default, glyphs sit on the path
    const baselineMode = pin.textBaseline || 'baseline';
    const dominantBaseline =
      baselineMode === 'middle' ? 'central' :
      baselineMode === 'top'    ? 'hanging' :
      'alphabetic';
    const pathId = `path-${pin.id}`;

    const isSelected = pin.id === selectedId;
    // Selected paths always render (so the user can see what they're
    // editing); non-selected ones hide below their minZoom threshold.
    const labelHidden = !isSelected && currentScale(z) < scaleAt(pin.minZoom ?? KIND_DEFAULTS.path?.minZoom ?? 0);
    const textStyle = `font-family: ${font}; font-size: ${fontSize.toFixed(1)}px; font-style: ${style}; ${extra}`;

    let handles = '';
    const isEditing = editable && isSelected;
    if (isEditing) {
      handles += `<div class="path-handle path-endpoint" data-path-handle="a" data-pin-id="${pin.id}" style="left:${Ax.toFixed(1)}px;top:${Ay.toFixed(1)}px"></div>`;
      handles += `<div class="path-handle path-endpoint" data-path-handle="b" data-pin-id="${pin.id}" style="left:${Bx.toFixed(1)}px;top:${By.toFixed(1)}px"></div>`;
      if (useBezier) {
        const [cax, cay] = px(cpA);
        const [cbx, cby] = px(cpB);
        handles += `<svg class="path-guides" width="${cssW}" height="${cssH}" viewBox="0 0 ${cssW} ${cssH}"><line x1="${Ax.toFixed(1)}" y1="${Ay.toFixed(1)}" x2="${cax.toFixed(1)}" y2="${cay.toFixed(1)}"/><line x1="${Bx.toFixed(1)}" y1="${By.toFixed(1)}" x2="${cbx.toFixed(1)}" y2="${cby.toFixed(1)}"/></svg>`;
        handles += `<div class="path-handle path-control" data-path-handle="cpA" data-pin-id="${pin.id}" style="left:${cax.toFixed(1)}px;top:${cay.toFixed(1)}px"></div>`;
        handles += `<div class="path-handle path-control" data-path-handle="cpB" data-pin-id="${pin.id}" style="left:${cbx.toFixed(1)}px;top:${cby.toFixed(1)}px"></div>`;
      }
    }

    const selClass = isSelected ? ' selected' : '';
    const hiddenClass = labelHidden ? ' label-hidden' : '';
    const visibleStroke = isEditing
      ? `<path class="path-stroke" d="${d}" fill="none"/>`
      : '';
    const html = `<div class="map-path${selClass}${hiddenClass}" data-pin-id="${pin.id}"><svg class="path-text" width="${cssW}" height="${cssH}" viewBox="0 0 ${cssW} ${cssH}"><defs><path id="${pathId}" d="${d}" fill="none"/></defs>${visibleStroke}<text class="${sizeClass} ${colorClass} ${weightClass}" text-anchor="${textAnchor}" dominant-baseline="${dominantBaseline}" style="${textStyle}"><textPath href="#${pathId}" startOffset="${startOffset}">${esc(pin.name)}</textPath></text></svg>${handles}</div>`;

    // Marker sits at A; iconAnchor positions A within the CSS-pixel bbox.
    const anchorX = (a[0] - minX) * zoomScale;
    const anchorY = (a[1] - minY) * zoomScale;
    return L.divIcon({
      className: '',
      html,
      iconSize: [cssW, cssH],
      iconAnchor: [anchorX, anchorY],
    });
  }

  function makeIcon(pin, currentZoom) {
    if (pin.kind === 'path') return makePathIcon(pin, currentZoom);
    const isLabel = !pin.number;

    if (isLabel) {
      // Hide text feature when map zoom is below its min-zoom threshold.
      const curZ = currentZoom ?? map?.getZoom() ?? REF_ZOOM;
      const minZ = pin.minZoom ?? 1;
      if (currentScale(curZ) < scaleAt(minZ)) {
        return L.divIcon({ className: '', html: '', iconSize: [0, 0], iconAnchor: [0, 0] });
      }
      // Style comes from the preset for text features.
      const s = resolvePreset(pin) || {};
      const font = FONTS[s.font] || FONTS.body;
      const size = computeFontSize(pin, currentZoom);
      const weightClass = `font-${s.weight || 'normal'}`;
      const style = s.italic ? 'italic' : 'normal';
      const transforms = [];
      if (pin.rotate) transforms.push(`rotate(${pin.rotate}deg)`);
      const transformStyle = transforms.length ? `transform: ${transforms.join(' ')};` : '';
      const extra = extraStyles(s);
      const textStyle = `font-family: ${font}; font-size: ${size.toFixed(1)}px; font-style: ${style}; ${extra}`;
      const sizeClass = getSizeClass(s.size);
      const colorClass = s.colorClass || 'text-black';

      // If the text has a bounding box, render inside a sized flex container
      if (pin.width > 0 && pin.height > 0) {
        // Convert image-pixel dimensions to CSS pixels. When the font
        // hits its min/max clamp the box should stop scaling too, so
        // we derive the effective scale from the clamped/unclamped
        // font-size ratio rather than raw CRS zoom.
        const z = currentZoom ?? map?.getZoom() ?? REF_ZOOM;
        const rawZoomScale = map?.options?.crs?.scale ? map.options.crs.scale(z) : Math.pow(2, z);
        const pivot = pin.shrink ? (pin.minZoom ?? REF_ZOOM) : REF_ZOOM;
        const rp = resolvePreset(pin);
        const unclamped = (rp ? sizeSpec(rp.size) : PIN_LABEL_SIZE).base * Math.pow(2, z - pivot);
        const clampRatio = unclamped > 0 ? size / unclamped : 1;
        const zoomScale = rawZoomScale * clampRatio;
        const cssW = pin.width * zoomScale;
        const cssH = pin.height * zoomScale;
        const align = pin.align || 'center';
        const valign = pin.valign || 'middle';
        const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
        const alignItems = valign === 'top' ? 'flex-start' : valign === 'bottom' ? 'flex-end' : 'center';
        const boxStyle = `width: ${cssW.toFixed(1)}px; height: ${cssH.toFixed(1)}px; display: flex; justify-content: ${justify}; align-items: ${alignItems}; text-align: ${align}; ${transformStyle}`;
        const isSelected = pin.id === selectedId;
        const isEditing = editable && isSelected;
        const selClass = isEditing ? ' selected' : '';
        const handles = isEditing ? HANDLE_POSITIONS.map(h =>
          `<div class="resize-handle handle-${h}" data-handle="${h}" data-pin-id="${pin.id}"></div>`).join('') : '';
        const html = `<div class="map-text-box${selClass}" style="${boxStyle}" data-pin-id="${pin.id}"><div class="map-label map-label-boxed ${sizeClass} ${colorClass} ${weightClass}" style="${textStyle}"><span class="map-label-text">${esc(pin.name)}</span></div>${handles}</div>`;
        return L.divIcon({
          className: '',
          html,
          iconSize: [cssW, cssH],
          iconAnchor: [cssW / 2, cssH / 2], // center-anchored
        });
      }

      const html = `<div class="map-label ${sizeClass} ${colorClass} ${weightClass}" style="${textStyle} ${transformStyle}">${esc(pin.name)}</div>`;
      return L.divIcon({
        className: '',
        html,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
    }

    // Marker body is hidden only at extreme zoom-out. Per-marker minZoom
    // gates the *label*, not the marker itself.
    const curZ = currentZoom ?? map?.getZoom() ?? REF_ZOOM;
    if (currentScale(curZ) <= scaleAt(MARKER_HIDE_ZOOM)) {
      return L.divIcon({ className: '', html: '', iconSize: [0, 0], iconAnchor: [0, 0] });
    }
    const labelHidden = currentScale(curZ) < scaleAt(pin.minZoom ?? DEFAULT_MARKER_MIN_ZOOM);
    const label = esc(pin.name);
    // Pin label styling comes from the preset (class).
    const s = resolvePreset(pin) || {};
    const font = FONTS[s.font] || FONTS.body;
    const size = computeFontSize(pin, currentZoom);
    const pinWeightClass = `font-${s.weight || 'normal'}`;
    const style = s.italic ? 'italic' : 'normal';
    const extra = extraStyles(s);
    const labelStyle = `font-family: ${font}; font-size: ${size.toFixed(1)}px; font-style: ${style}; ${extra}`;
    const pinSizeClass = getSizeClass(s.size);
    const pinColorClass = s.colorClass || 'text-black';
    // Overworld pins render a glyph (✪, ◉, …) instead of a numbered circle.
    const preset = pin.class ? PIN_PRESETS[pin.class] : null;
    const isOverworld = preset?.category === 'overworld';
    const markClass = isOverworld ? 'map-pin-glyph' : 'map-pin-number';
    const markContent = isOverworld ? esc(preset.icon) : pin.number;
    const markStyle = isOverworld ? `font-size: ${Math.max(20, size).toFixed(1)}px;` : '';
    return L.divIcon({
      className: '',
      html: `<div class="map-pin label-pos-${pin.labelPos || 'n'}${pin.id === selectedId ? ' selected' : ''}${isOverworld ? ' overworld' : ''}${labelHidden ? ' label-hidden' : ''}"><span class="map-pin-label ${pinSizeClass} ${pinColorClass} ${pinWeightClass}" style="${labelStyle}">${label}</span><span class="${markClass}" style="${markStyle}">${markContent}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  function addMarker(pin) {
    if (!map) return;
    // Paths are manipulated via their endpoint handles, not by dragging
    // the whole marker — otherwise the two gestures would conflict.
    const isPath = pin.kind === 'path';
    // Paths anchor at endpoint A. The editor mirrors a→x,y on load for
    // its own bookkeeping, but the Astro site passes raw JSON, so
    // derive the latlng here so both callers work.
    const [lng, lat] = isPath && Array.isArray(pin.a) ? pin.a : [pin.x, pin.y];
    const marker = L.marker([lat, lng], {
      icon: makeIcon(pin, map?.getZoom()),
      draggable: editable && selectable && !isPath,
      interactive: true,
    }).addTo(map);

    if (editable) {
      marker.on('click', (e) => {
        // Prevent the map click handler from also firing
        L.DomEvent.stopPropagation(e);
        dispatch('onPinClick', pin);
      });
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        dispatch('onPinDrag', pin, Math.round(pos.lng), Math.round(pos.lat));
      });
    } else {
      // View mode: tap-to-select so mobile (no hover) can reveal the
      // label of a pin whose label is hidden at the current zoom.
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        viewSelectedId = viewSelectedId === pin.id ? null : pin.id;
      });
    }

    markerMap.set(pin.id, marker);
  }

  function removeMarker(id) {
    const m = markerMap.get(id);
    if (m) { m.remove(); markerMap.delete(id); }
  }

  export function updateMarker(pin) {
    const marker = markerMap.get(pin.id);
    if (!marker) return;
    marker.setIcon(makeIcon(pin, map?.getZoom()));
    const [lng, lat] = pin.kind === 'path' && Array.isArray(pin.a) ? pin.a : [pin.x, pin.y];
    marker.setLatLng([lat, lng]);
  }

  export function panTo(pin) {
    if (!map) return;
    // Fall back to KIND_DEFAULTS when a pin hasn't stored its own
    // minZoom (the editor omits defaults from saved JSON, so most pins
    // arrive without a literal minZoom field).
    const minZ = pin.minZoom ?? KIND_DEFAULTS[pin.kind]?.minZoom ?? 0;
    const cur = map.getZoom();
    const [lng, lat] = pin.kind === 'path' && Array.isArray(pin.a) ? pin.a : [pin.x, pin.y];
    map.setView([lat, lng], Math.max(cur, minZ));
  }

  function updateLabelClasses() {
    if (!map) return;
    const z = map.getZoom();
    const c = map.getContainer().classList;
    const isLow = currentScale(z) < scaleAt(PIN_SHRINK_ZOOM);
    c.toggle('zoom-low', isLow);
    c.toggle('zoom-high', z >= 3);
  }

  function updateZoomClass() {
    updateLabelClasses();
  }

  // --- Rect preview (for Text tool drag) ---
  let rectPreview = null;
  let linePreview = null;

  // Re-render the previously-selected and newly-selected pin icons so
  // the resize handles appear/disappear correctly. Also bump the selected
  // marker's z-index so its click/drag area takes precedence over any
  // other markers that overlap with it (e.g. pins inside a text box).
  let prevSelectedId = null;
  $effect(() => {
    const id = selectedId;
    void pins;
    if (prevSelectedId && prevSelectedId !== id) {
      const prev = pins.find(p => p.id === prevSelectedId);
      if (prev) updateMarker(prev);
      markerMap.get(prevSelectedId)?.setZIndexOffset(0);
    }
    if (id) {
      const cur = pins.find(p => p.id === id);
      if (cur) updateMarker(cur);
      markerMap.get(id)?.setZIndexOffset(1000);
    }
    prevSelectedId = id;
  });

  function showRectPreview(a, b) {
    if (!map) return;
    const bounds = L.latLngBounds(a, b);
    if (rectPreview) rectPreview.setBounds(bounds);
    else {
      rectPreview = L.rectangle(bounds, {
        color: '#c9a96e',
        weight: 2,
        fillOpacity: 0.15,
        interactive: false,
      }).addTo(map);
    }
  }

  function hideRectPreview() {
    if (rectPreview) { rectPreview.remove(); rectPreview = null; }
  }

  /** Path-tool line preview: a thin polyline shown while the user is
   * dragging from start to end. Replaced by the real path feature on
   * mouseup via `ctx.create`. */
  function showLinePreview(a, b) {
    if (!map) return;
    const latlngs = [a, b];
    if (linePreview) linePreview.setLatLngs(latlngs);
    else {
      linePreview = L.polyline(latlngs, {
        color: '#c9a96e',
        weight: 2,
        dashArray: '4 4',
        interactive: false,
      }).addTo(map);
    }
  }

  function hideLinePreview() {
    if (linePreview) { linePreview.remove(); linePreview = null; }
  }

  /** Merge editor-supplied ctx with MapViewer's map helpers. */
  function toolCtx() {
    return {
      ...(ctx || {}),
      showRect: showRectPreview,
      hideRect: hideRectPreview,
      showLine: showLinePreview,
      hideLine: hideLinePreview,
      alert: (msg) => window.alert(msg),
    };
  }

  /** Call a handler on the active tool, if defined. */
  function dispatch(method, ...args) {
    const fn = tool && tool[method];
    if (typeof fn === 'function') fn.call(tool, ...args, toolCtx());
  }

  /**
   * Attach tool-event dispatchers. Each tool opts in to the events it needs
   * by defining handler methods. When a tool implements onMapDown, we treat
   * the gesture as a drag and suppress Leaflet's synthesized click to avoid
   * duplicate onMapClick calls.
   */
  let draggingFromMap = false;
  let resizing = null; // { pinId, handle, startX, startY, origX, origY, origW, origH }
  let pathDragging = null; // { pinId, which, startX, startY, origX, origY }
  let rightPan = null; // { startX, startY }

  function applyResize(e) {
    if (!resizing || !map) return;
    const pin = pins.find(p => p.id === resizing.pinId);
    if (!pin) return;
    const scale = map.options.crs.scale(map.getZoom());
    const dx = (e.clientX - resizing.startX) / scale;
    const dy = (e.clientY - resizing.startY) / scale;
    // x/y are the CENTER of the box. Each handle grows/shrinks the box from
    // the opposite edge, so the center shifts by half the size delta.
    let x = resizing.origX, y = resizing.origY;
    let w = resizing.origW, h = resizing.origH;
    const handle = resizing.handle;
    if (handle.includes('n')) { y += dy / 2; h -= dy; }
    if (handle.includes('s')) { y += dy / 2; h += dy; }
    if (handle.includes('w')) { x += dx / 2; w -= dx; }
    if (handle.includes('e')) { x += dx / 2; w += dx; }
    // Clamp to minimum size (keep center stable at min)
    const MIN = 20;
    if (w < MIN) w = MIN;
    if (h < MIN) h = MIN;
    ctx?.resize?.(pin, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** Translate mouse delta into image pixels and push the new position
   * of a path endpoint or bezier control point to the editor. */
  function applyPathDrag(e) {
    if (!pathDragging || !map) return;
    const pin = pins.find(p => p.id === pathDragging.pinId);
    if (!pin) return;
    const scale = map.options.crs.scale(map.getZoom());
    const dx = (e.clientX - pathDragging.startX) / scale;
    const dy = (e.clientY - pathDragging.startY) / scale;
    const x = Math.round(pathDragging.origX + dx);
    const y = Math.round(pathDragging.origY + dy);
    ctx?.updatePathPoint?.(pin, pathDragging.which, x, y);
  }

  /** Right-click pan — works in both edit and view modes. */
  function setupRightPan() {
    if (!map) return;
    const container = map.getContainer();
    // Suppress the browser context menu so right-drag works cleanly
    container.addEventListener('contextmenu', (e) => e.preventDefault());
    container.addEventListener('mousedown', (e) => {
      if (e.button !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      rightPan = { startX: e.clientX, startY: e.clientY };
      container.classList.add('right-panning');
    }, true);
    container.addEventListener('mousemove', (e) => {
      if (!rightPan) return;
      e.preventDefault();
      const dx = e.clientX - rightPan.startX;
      const dy = e.clientY - rightPan.startY;
      rightPan.startX = e.clientX;
      rightPan.startY = e.clientY;
      map.panBy([-dx, -dy], { animate: false });
    }, true);
    container.addEventListener('mouseup', (e) => {
      if (!rightPan) return;
      e.preventDefault();
      rightPan = null;
      container.classList.remove('right-panning');
    }, true);
  }

  function setupToolEvents() {
    if (!map) return;
    const container = map.getContainer();

    container.addEventListener('mousedown', (e) => {
      // Resize handle on the selected pin takes precedence over everything
      const handle = e.target.closest('.resize-handle');
      if (handle && e.button === 0) {
        const pinId = handle.dataset.pinId;
        const pin = pins.find(p => p.id === pinId);
        if (pin) {
          e.preventDefault();
          e.stopPropagation();
          resizing = {
            pinId,
            handle: handle.dataset.handle,
            startX: e.clientX,
            startY: e.clientY,
            origX: pin.x,
            origY: pin.y,
            origW: pin.width || 0,
            origH: pin.height || 0,
          };
          return;
        }
      }
      // Path endpoint / bezier control-point drag
      const pathHandle = e.target.closest('.path-handle');
      if (pathHandle && e.button === 0) {
        const pinId = pathHandle.dataset.pinId;
        const pin = pins.find(p => p.id === pinId);
        const which = pathHandle.dataset.pathHandle;
        if (pin && which) {
          const orig = pin[which] || [pin.x, pin.y];
          e.preventDefault();
          e.stopPropagation();
          pathDragging = {
            pinId,
            which,
            startX: e.clientX,
            startY: e.clientY,
            origX: orig[0],
            origY: orig[1],
          };
          // Hide the cursor while the drag is in flight — the handle is
          // pinned to the mouse so the cursor glyph just adds clutter.
          container.classList.add('path-dragging');
          return;
        }
      }
      if (!tool?.onMapDown) return;
      if (e.button !== 0) return;
      // Don't intercept clicks on markers (they have their own handlers)
      if (e.target.closest('.leaflet-marker-icon')) return;
      e.preventDefault();
      e.stopPropagation();
      draggingFromMap = true;
      dispatch('onMapDown', e, map.mouseEventToLatLng(e));
    }, true);

    container.addEventListener('mousemove', (e) => {
      if (resizing) {
        e.preventDefault();
        e.stopPropagation();
        applyResize(e);
        return;
      }
      if (pathDragging) {
        e.preventDefault();
        e.stopPropagation();
        applyPathDrag(e);
        return;
      }
      if (!draggingFromMap || !tool?.onMapMove) return;
      dispatch('onMapMove', e, map.mouseEventToLatLng(e));
    }, true);

    container.addEventListener('mouseup', (e) => {
      if (resizing) {
        e.preventDefault();
        e.stopPropagation();
        ctx?.commit?.();
        resizing = null;
        suppressNextClick = true;
        setTimeout(() => { suppressNextClick = false; }, 300);
        return;
      }
      if (pathDragging) {
        e.preventDefault();
        e.stopPropagation();
        ctx?.commit?.();
        pathDragging = null;
        container.classList.remove('path-dragging');
        suppressNextClick = true;
        setTimeout(() => { suppressNextClick = false; }, 300);
        return;
      }
      if (!draggingFromMap) return;
      e.preventDefault();
      e.stopPropagation();
      map.dragging.enable();
      dispatch('onMapUp', e, map.mouseEventToLatLng(e));
      // Re-enable click suppression so Leaflet's synthesized click doesn't fire
      suppressNextClick = true;
      setTimeout(() => { suppressNextClick = false; }, 300);
      draggingFromMap = false;
    }, true);

    // Leaflet's click event (fired on mousedown+mouseup without major move)
    map.on('click', (e) => {
      if (suppressNextClick) return;
      dispatch('onMapClick', e.latlng);
    });
  }

  let suppressNextClick = false;

  // Call onActivate/onDeactivate lifecycle when the active tool changes.
  // Also update the map-container cursor to match the tool's cursor hint.
  let prevTool = null;
  $effect(() => {
    if (!map) return;
    if (prevTool === tool) return;
    if (prevTool?.onDeactivate) prevTool.onDeactivate.call(prevTool, map, toolCtx());
    if (tool?.onActivate) tool.onActivate.call(tool, map, toolCtx());
    const container = map.getContainer();
    // Tag the container with the active tool id so CSS can respond
    for (const cls of Array.from(container.classList)) {
      if (cls.startsWith('tool-')) container.classList.remove(cls);
    }
    if (tool?.id) container.classList.add(`tool-${tool.id}`);
    prevTool = tool;
  });

  // Toggle marker drag/interact when `selectable` changes
  $effect(() => {
    const canSelect = selectable && editable;
    for (const marker of markerMap.values()) {
      if (canSelect) marker.dragging?.enable();
      else marker.dragging?.disable();
      // Toggle Leaflet's pointer-events via class (added in L.DivIcon)
      const el = marker.getElement();
      if (el) el.style.pointerEvents = canSelect ? '' : 'none';
    }
  });

  // Sync pins array to markers
  $effect(() => {
    const currentPins = pins;
    for (const id of markerMap.keys()) {
      if (!currentPins.find(p => p.id === id)) removeMarker(id);
    }
    for (const pin of currentPins) {
      if (!markerMap.has(pin.id)) addMarker(pin);
    }
  });

  onMount(() => {
    const bounds = [[0, 0], [height, width]];

    if (tiles) {
      const ts = tiles.tileSize;
      const maxZoom = tiles.maxZoom;
      const maxDim = Math.max(width, height);

      // CRS where latlng = image pixels and zoom levels match our tile pyramid.
      // Our tiles: at zoom z, image scaled so maxDim = 2^z * tileSize pixels.
      // Leaflet CRS pixel = latlng × scale(z). For tile alignment we need:
      //   scale(z) = 2^z × tileSize / maxDim
      // CRS.Simple uses scale(z) = 2^z, so we override scale/zoom.
      const crs = L.Util.extend({}, L.CRS.Simple, {
        // Map tile zoom levels to our pyramid: at z, scale = 2^z * ts / maxDim
        scale(z) { return Math.pow(2, z) * ts / maxDim; },
        zoom(scale) { return Math.log(scale * maxDim / ts) / Math.LN2; },
        // Don't flip y — our tiles and coordinates both use y-down
        transformation: new L.Transformation(1, 0, 1, 0),
      });

      map = L.map(mapEl, {
        crs: crs,
        minZoom: minZoom,
        maxZoom: maxZoom,
        zoomSnap: 0,
        scrollWheelZoom: false,
        wheelPxPerZoomLevel: 60,
        attributionControl: false,
        dragging: !editable, // edit mode handles left-drag via tools; view mode uses Leaflet's default pan
      });

      const CustomTileLayer = L.TileLayer.extend({
        getTileUrl(coords) {
          const z = coords.z;
          const scale = Math.pow(2, z) * ts / maxDim;
          const cols = Math.ceil(width * scale / ts);
          const rows = Math.ceil(height * scale / ts);
          const x = coords.x;
          const y = coords.y;
          // Empty `src` produces a broken-image placeholder in some
          // browsers (visible as little dark marks against a dark
          // backdrop). Return a 1×1 transparent PNG instead.
          if (x < 0 || x >= cols || y < 0 || y >= rows) {
            return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
          }
          return `${tiles.basePath}/${z}/${x}/${y}.webp`;
        },
      });

      new CustomTileLayer('', {
        maxNativeZoom: tiles.maxZoom,
        maxZoom: maxZoom,
        tileSize: ts,
        noWrap: true,
      }).addTo(map);

    } else {
      map = L.map(mapEl, {
        crs: L.CRS.Simple,
        minZoom: minZoom,
        maxZoom: maxZoom,
        zoomSnap: 0,
        scrollWheelZoom: false,
        wheelPxPerZoomLevel: 60,
        attributionControl: false,
        dragging: !editable, // edit mode handles left-drag via tools; view mode uses Leaflet's default pan
      });

      L.imageOverlay(imageUrl, bounds).addTo(map);
    }


    // Gold border traced around the image's bounds so the frame hugs
    // the tiles rather than the map container (which may be larger
    // when zoomed out).
    L.rectangle(bounds, {
      color: getCss('--border') || '#c9a96e',
      weight: parseFloat(getCss('--border-width')) || 2,
      fill: false,
      interactive: false,
      className: 'map-image-border',
    }).addTo(map);

    setupRightPan();
    if (editable) {
      setupToolEvents();
    } else {
      // Tap on empty map clears the view-mode selection so the user
      // can dismiss a revealed label.
      map.on('click', () => { viewSelectedId = null; });
    }

    // Make +/- zoom buttons snap to whole zoom levels
    map.zoomIn = function() {
      this.setZoom(Math.floor(this.getZoom() + 1e-9) + 1);
    };
    map.zoomOut = function() {
      this.setZoom(Math.ceil(this.getZoom() - 1e-9) - 1);
    };

    // Leaflet's zoom controls are <a href="#"> elements, which flash
    // "#" in the browser status bar on hover. Drop the href so the
    // anchors still behave as buttons but the URL tooltip goes away.
    for (const a of mapEl.querySelectorAll('.leaflet-control-zoom a')) {
      a.removeAttribute('href');
      a.setAttribute('role', 'button');
    }

    function emitView() {
      const c = map.getCenter();
      onviewchange?.({ zoom: map.getZoom(), x: Math.round(c.lng), y: Math.round(c.lat) });
    }
    map.on('zoomend moveend', emitView);

    // Update zoom class during and after zoom
    map.on('zoom zoomend', updateZoomClass);

    // Re-render all pin icons on zoom change (sizes bump with zoom)
    map.on('zoomend', () => {
      const z = map.getZoom();
      for (const [id, marker] of markerMap) {
        const pin = pins.find(p => p.id === id);
        if (pin) marker.setIcon(makeIcon(pin, z));
      }
    });
    updateZoomClass();

    mapEl.addEventListener('wheel', (e) => {
      onwheelcb?.({ deltaX: e.deltaX, deltaY: e.deltaY, ctrlKey: e.ctrlKey, trackpad: isTrackpad(e) });
    }, { passive: true });

    // Auto-detect trackpad vs mouse:
    // Trackpad: pinch (ctrlKey) = zoom, scroll = pan
    // Mouse: scroll wheel = zoom, right-click drag = pan (Leaflet default)
    //
    // Heuristic: trackpad produces deltaMode=0 with small/fractional deltas.
    // Mouse wheel produces deltaMode=0 but with larger, rounder deltas
    // (typically multiples of ~4+ on macOS, ~100+ on Windows/Linux).
    // Trackpad: deltaMode=0, and either has horizontal movement or small deltas.
    // Mouse wheel: deltaMode=0 but Y-only with larger steps (typically abs >= 4).
    // We track recent events — rapid small events = trackpad.
    let lastWheelTime = 0;
    let lastInputIsTrackpad = false;

    function isTrackpad(e) {
      if (e.deltaMode !== 0) return false;
      const now = performance.now();
      const dt = now - lastWheelTime;
      lastWheelTime = now;

      // Any horizontal delta = definitely trackpad
      if (e.deltaX !== 0) { lastInputIsTrackpad = true; return true; }
      // Rapid-fire small deltas = trackpad; mouse wheel has gaps > 50ms
      if (dt < 50 && Math.abs(e.deltaY) <= 10) { lastInputIsTrackpad = true; return true; }
      // Large infrequent delta = mouse
      if (Math.abs(e.deltaY) >= 4 && dt > 50) { lastInputIsTrackpad = false; return false; }
      // Fall back to last known
      return lastInputIsTrackpad;
    }

    mapEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        // Pinch gesture — zoom around the cursor. Browsers sometimes deliver
        // a large initial deltaY at the start of a pinch; cap the per-event
        // delta so the first event can't produce a huge zoom jump.
        const raw = -e.deltaY * 0.05;
        const delta = Math.max(-0.25, Math.min(0.25, raw));
        const zoom = map.getZoom() + delta;
        const clamped = Math.max(minZoom, Math.min(maxZoom, zoom));
        map.setZoomAround(map.mouseEventToContainerPoint(e), clamped, { animate: false });
      } else if (isTrackpad(e)) {
        map.panBy([e.deltaX, e.deltaY], { animate: false });
      } else {
        // Mouse wheel — zoom around the cursor
        const zoom = map.getZoom() - e.deltaY * 0.01;
        const clamped = Math.max(minZoom, Math.min(maxZoom, zoom));
        map.setZoomAround(map.mouseEventToContainerPoint(e), clamped, { animate: false });
      }
    }, { passive: false });

    if (initialZoom != null) {
      map.setView([height / 2, width / 2], initialZoom);
    } else if (fit === 'height') {
      // Fit the map's full height to the viewport; horizontal overflow
      // is fine (user pans to see the sides). Used on mobile so the
      // map reads as a tall portrait strip rather than squeezed to fit.
      const size = map.getSize();
      const ts = tiles ? tiles.tileSize : 1;
      const maxDim = Math.max(width, height);
      const z = tiles
        ? Math.log2((size.y * maxDim) / (height * ts))
        : Math.log2(size.y / height);
      const clamped = Math.max(minZoom, Math.min(maxZoom, z));
      map.setView([height / 2, width / 2], clamped);
    } else {
      map.fitBounds(bounds);
    }
    for (const pin of pins) addMarker(pin);
  });

  onDestroy(() => {
    if (map) { map.remove(); map = null; }
  });
</script>

<div class="map-container" bind:this={mapEl}></div>

<style lang="scss">
  /* Only the container's own layout lives here. All rules that touch
     Leaflet-injected DOM (tiles, markers, controls) live in
     ./map-viewer-globals.scss so Svelte's CSS tree-shaker doesn't
     strip them. */
  .map-container {
    position: absolute;
    inset: 0;
    background: var(--header-bg, #1a1a1a);
  }
</style>
