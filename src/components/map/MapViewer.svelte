<script>
  import { onMount, onDestroy } from 'svelte';
  import { TEXT_PRESETS, PIN_PRESETS, DEFAULT_MARKER_MIN_ZOOM } from './tools.js';

  let { width, height, imageUrl, tiles, initialZoom, minZoom = 0, maxZoom = 5, pins = [], editable = false, tool = null, ctx = null, selectedId = null, onviewchange, onwheel: onwheelcb } = $props();

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
  // Markers disappear entirely only at extreme zoom-out — otherwise they
  // stay visible and hoverable. Their *labels* follow the per-marker
  // `minZoom` (hidden when current zoom < minZoom).
  const MARKER_HIDE_ZOOM = 0.25;
  // Maximum distance (in CSS pixels) the viewport may pan past the edge
  // of the map image. Kept in sync with --map-padding in tokens.scss
  // (which the floating sidebar uses to size itself).
  const MAP_PADDING = 320;
  // View mode uses a uniform half-MAP_PADDING border.
  const VIEW_PAD = MAP_PADDING / 2;
  // Edit mode UI overlays — these widths drive the asymmetric padding so
  // the user can pan the map past the toolbox / sidebar.
  const SPACE_PX = 16;          // matches --space
  const TOOLBOX_WIDTH = 34;     // 30px button + 2px border × 2
  const SIDEBAR_WIDTH = MAP_PADDING - 2 * SPACE_PX;
  const HANDLE_POSITIONS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  function isMobile() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  }

  /** Recompute the map's max-bounds based on the current zoom and the
   * active mode. View mode = uniform half-MAP_PADDING. Edit mode =
   * asymmetric so the floating UI overlays don't block panning. */
  function updateMaxBounds() {
    if (!map) return;
    const s = map.options.crs.scale(map.getZoom()) || 1;
    let topPx, bottomPx, leftPx, rightPx;
    if (editable) {
      topPx = bottomPx = SPACE_PX;
      leftPx = TOOLBOX_WIDTH + 2 * SPACE_PX;
      rightPx = SIDEBAR_WIDTH + 2 * SPACE_PX;
    } else {
      topPx = bottomPx = leftPx = rightPx = VIEW_PAD;
    }
    map.setMaxBounds([
      [-topPx / s, -leftPx / s],
      [height + bottomPx / s, width + rightPx / s],
    ]);
  }

  // Re-clamp whenever the user toggles edit/view mode.
  $effect(() => {
    void editable;
    if (map) updateMaxBounds();
  });

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
    const list = pin.number ? PIN_PRESETS : TEXT_PRESETS;
    // Pins without a class fall back to 'shop'.
    const id = pin.class || (pin.number ? 'shop' : null);
    if (!id) return null;
    return list.find(p => p.id === id)?.defaults;
  }

  function computeFontSize(pin, zoom) {
    const z = zoom ?? REF_ZOOM;
    const isMobileView = isMobile();

    // Text features pick sizes from their class (preset). Fallback for
    // pin labels uses PIN_LABEL_SIZE. Size scales linearly with zoom
    // (2^(z - REF_ZOOM)), clamped to [min, max]. On mobile the floor
    // is always MOBILE_MIN_PX (16px).
    const spec = resolvePreset(pin) ?? PIN_LABEL_SIZE;

    // Shrink mode: pin the size to `min` at the feature's min-zoom and
    // scale up from there (doubling per zoom level), clamped to max.
    // Default mode: scale from `base` at REF_ZOOM, clamped to [min, max].
    const baseSize = pin.shrink ? (spec.min ?? spec.base) : spec.base;
    const pivot = pin.shrink ? (pin.minZoom ?? REF_ZOOM) : REF_ZOOM;
    const scale = Math.pow(2, z - pivot);
    const raw = baseSize * scale;
    const min = isMobileView ? Math.max(MOBILE_MIN_PX, spec.min ?? 0) : (spec.min ?? 0);
    const max = spec.max ?? Infinity;
    return Math.max(min, Math.min(max, raw));
  }


  function makeIcon(pin, currentZoom) {
    const isLabel = !pin.number;

    function extraStyles(s) {
      const parts = [];
      if (s.case && s.case !== 'none') {
        const tx = s.case === 'upper' ? 'uppercase' : s.case === 'lower' ? 'lowercase' : 'capitalize';
        parts.push(`text-transform: ${tx}`);
      }
      if (s.letterSpacing) parts.push(`letter-spacing: ${s.letterSpacing}px`);
      return parts.join('; ');
    }

    if (isLabel) {
      // Hide text feature when map zoom is below its min-zoom threshold.
      const curZ = currentZoom ?? map?.getZoom() ?? REF_ZOOM;
      const minZ = pin.minZoom ?? 1;
      if (curZ < minZ) {
        return L.divIcon({ className: '', html: '', iconSize: [0, 0], iconAnchor: [0, 0] });
      }
      // Style comes from the preset for text features.
      const s = resolvePreset(pin) || {};
      const font = FONTS[s.font] || FONTS.body;
      const size = computeFontSize(pin, currentZoom);
      const weight = String(s.weight ?? (s.bold ? 700 : 400));
      const style = s.italic ? 'italic' : 'normal';
      const transforms = [];
      if (pin.rotate) transforms.push(`rotate(${pin.rotate}deg)`);
      const transformStyle = transforms.length ? `transform: ${transforms.join(' ')};` : '';
      const extra = extraStyles(s);
      const textStyle = `font-family: ${font}; font-size: ${size.toFixed(1)}px; font-weight: ${weight}; font-style: ${style}; ${extra}`;
      const sizeClass = s.sizeClass || 'text-base';
      const colorClass = s.colorClass || 'text-black';

      // If the text has a bounding box, render inside a sized flex container
      if (pin.width > 0 && pin.height > 0) {
        // Convert image-pixel dimensions to CSS pixels using the CRS scale
        const z = currentZoom ?? map?.getZoom() ?? REF_ZOOM;
        const zoomScale = map?.options?.crs?.scale ? map.options.crs.scale(z) : Math.pow(2, z);
        const cssW = pin.width * zoomScale;
        const cssH = pin.height * zoomScale;
        const align = pin.align || 'center';
        const valign = pin.valign || 'middle';
        const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
        const alignItems = valign === 'top' ? 'flex-start' : valign === 'bottom' ? 'flex-end' : 'center';
        const boxStyle = `width: ${cssW.toFixed(1)}px; height: ${cssH.toFixed(1)}px; display: flex; justify-content: ${justify}; align-items: ${alignItems}; text-align: ${align}; ${transformStyle}`;
        const isSelected = pin.id === selectedId;
        const selClass = isSelected ? ' selected' : '';
        const handles = isSelected ? HANDLE_POSITIONS.map(h =>
          `<div class="resize-handle handle-${h}" data-handle="${h}" data-pin-id="${pin.id}"></div>`).join('') : '';
        const html = `<div class="map-text-box${selClass}" style="${boxStyle}" data-pin-id="${pin.id}"><div class="map-label map-label-boxed ${sizeClass} ${colorClass}" style="${textStyle}"><span class="map-label-text">${esc(pin.name)}</span></div>${handles}</div>`;
        return L.divIcon({
          className: '',
          html,
          iconSize: [cssW, cssH],
          iconAnchor: [cssW / 2, cssH / 2], // center-anchored
        });
      }

      const html = `<div class="map-label ${sizeClass} ${colorClass}" style="${textStyle} ${transformStyle}">${esc(pin.name)}</div>`;
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
    if (curZ <= MARKER_HIDE_ZOOM) {
      return L.divIcon({ className: '', html: '', iconSize: [0, 0], iconAnchor: [0, 0] });
    }
    const labelHidden = curZ < (pin.minZoom ?? DEFAULT_MARKER_MIN_ZOOM);
    const shortLabel = esc(pin.name);
    const longLabel = pin.longName ? esc(pin.longName) : shortLabel;
    // Pin label styling comes from the preset (class).
    const s = resolvePreset(pin) || {};
    const font = FONTS[s.font] || FONTS.body;
    const size = computeFontSize(pin, currentZoom);
    const weight = String(s.weight ?? (s.bold ? 700 : 400));
    const style = s.italic ? 'italic' : 'normal';
    const extra = extraStyles(s);
    const labelStyle = `font-family: ${font}; font-size: ${size.toFixed(1)}px; font-weight: ${weight}; font-style: ${style}; ${extra}`;
    const pinSizeClass = s.sizeClass || 'text-base';
    const pinColorClass = s.colorClass || 'text-black';
    // Overworld pins render a glyph (✪, ◉, …) instead of a numbered circle.
    const preset = pin.class ? PIN_PRESETS.find(p => p.id === pin.class) : null;
    const isOverworld = preset?.category === 'overworld';
    const markClass = isOverworld ? 'map-pin-glyph' : 'map-pin-number';
    const markContent = isOverworld ? esc(preset.icon) : pin.number;
    const markStyle = isOverworld ? `font-size: ${Math.max(20, size).toFixed(1)}px;` : '';
    return L.divIcon({
      className: '',
      html: `<div class="map-pin label-pos-${pin.labelPos || 'n'}${pin.id === selectedId ? ' selected' : ''}${isOverworld ? ' overworld' : ''}${labelHidden ? ' label-hidden' : ''}"><span class="map-pin-label map-pin-label-short ${pinSizeClass} ${pinColorClass}" style="${labelStyle}">${shortLabel}</span><span class="map-pin-label map-pin-label-long ${pinSizeClass} ${pinColorClass}" style="${labelStyle}">${longLabel}</span><span class="${markClass}" style="${markStyle}">${markContent}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  function addMarker(pin) {
    if (!map) return;
    const marker = L.marker([pin.y, pin.x], {
      icon: makeIcon(pin, map?.getZoom()),
      draggable: editable && selectable,
      interactive: editable,
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
    marker.setLatLng([pin.y, pin.x]);
  }

  export function panTo(pin) {
    if (!map) return;
    map.setView([pin.y, pin.x], map.getZoom());
  }

  function updateLabelClasses() {
    if (!map) return;
    const z = map.getZoom();
    const c = map.getContainer().classList;
    const isLow = z < 2;
    c.toggle('zoom-low', isLow);
    c.toggle('zoom-high', z >= 3);
  }

  function updateZoomClass() {
    updateLabelClasses();
  }

  // --- Rect preview (for Text tool drag) ---
  let rectPreview = null;

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

  /** Merge editor-supplied ctx with MapViewer's map helpers. */
  function toolCtx() {
    return {
      ...(ctx || {}),
      showRect: showRectPreview,
      hideRect: hideRectPreview,
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
          if (x < 0 || x >= cols || y < 0 || y >= rows) return '';
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

    // Constrain panning to the image plus MAP_PADDING (CSS px) on every
    // side. Since our CRS's lat/lng units are image pixels, convert the
    // CSS-px pad through the current scale, and keep it in sync as the
    // user zooms (where 1 image-px covers a different amount of screen).
    map.options.maxBoundsViscosity = 1.0;
    updateMaxBounds();
    map.on('zoomend', updateMaxBounds);

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
    }

    // Make +/- zoom buttons snap to whole zoom levels
    map.zoomIn = function() {
      this.setZoom(Math.floor(this.getZoom() + 1e-9) + 1);
    };
    map.zoomOut = function() {
      this.setZoom(Math.ceil(this.getZoom() - 1e-9) - 1);
    };

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
        // Pinch gesture — zoom around the cursor
        const zoom = map.getZoom() - e.deltaY * 0.5;
        const clamped = Math.max(minZoom, Math.min(maxZoom, zoom));
        map.setZoomAround(map.mouseEventToContainerPoint(e), clamped, { animate: false });
      } else if (isTrackpad(e)) {
        // Trackpad scroll — pan
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
  // All map-related rules cascade from `.map-container`. Leaflet populates
  // its own DOM inside this container, so we wrap everything in `:global`
  // to opt out of Svelte's scope hashing while keeping the container
  // selector scoped by `.map-container` itself.
  .map-container {
    position: absolute;
    inset: 0;
    background: var(--header-bg, #1a1a1a);

    // Tool-specific cursors. These have to live outside the :global { }
    // block because tool-* classes are on the .map-container element
    // itself (not a descendant), so we target them via `&:global(.X)`.
    // In view mode no tool class is applied, so Leaflet's own grab /
    // grabbing cursors carry through unchanged.
    &:global(.tool-pin),
    &:global(.tool-text),
    &:global(.tool-path) { cursor: crosshair !important; }
    &:global(.tool-select) { cursor: default !important; }
    &:global(.right-panning) { cursor: grabbing !important; }

    &:global(.tool-select) {
      :global(.map-pin),
      :global(.map-pin-number),
      :global(.map-pin-glyph),
      :global(.map-label),
      :global(.map-label-text) { cursor: pointer !important; }

      // Selected text box: the whole bounding area (including the
      // Leaflet marker wrapper that encases it) shows the move cursor.
      :global(.leaflet-marker-icon:has(.map-text-box.selected)),
      :global(.map-text-box.selected),
      :global(.map-text-box.selected .map-label),
      :global(.map-text-box.selected .map-label-text) { cursor: move !important; }
    }

    :global {

      // --- Marker body (numbered circle or overworld glyph) ------------
      .map-pin {
        width: 28px;
        height: 28px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: auto !important;
        position: relative;

        // Hover reveals the long label
        &:hover .map-pin-label-long { display: block; }
        &:hover .map-pin-label-short { display: none; }

        // Selected: always show long label, flip circle bg/text,
        // give the glyph a matching dark-circle backdrop
        &.selected {
          .map-pin-label-long { display: block !important; }
          .map-pin-label-short { display: none !important; }
          .map-pin-number {
            background: #3b2e1e;
            color: #fff;
            border-color: #3b2e1e;
          }
          .map-pin-glyph {
            background: #3b2e1e;
            color: #fff;
            border-radius: 50%;
            padding: 6px;
            aspect-ratio: 1;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
            text-shadow: none;
          }
        }

        // Per-marker label gate: below the marker's minZoom the label is
        // hidden by default; hovering / selecting still reveals the long.
        &.label-hidden .map-pin-label { display: none !important; }
        &.label-hidden:hover .map-pin-label-long,
        &.label-hidden.selected .map-pin-label-long { display: block !important; }
      }

      .map-pin-number {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #fff;
        color: #000;
        border: 2px solid var(--border, #c9a96e);
        border-radius: 50%;
        font: 700 12px/1 var(--heading-font, 'Crimson Pro'), var(--body-font, 'Lora'), serif;
        cursor: grab;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      }

      // Overworld pins: bare glyph, no circle
      .map-pin-glyph {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #000;
        line-height: 1;
        cursor: grab;
        text-shadow: 0 0 3px rgba(250, 246, 240, 0.7), 0 0 6px rgba(250, 246, 240, 0.4);
      }

      // --- Labels (pin short/long + freeform map labels) ---------------
      // Default label position is N (above the pin). .label-pos-*
      // classes on the enclosing .map-pin flip the anchor point.
      .map-pin-label {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-bottom: -2px;
        line-height: 1.2;
        white-space: nowrap;
        pointer-events: none;
        display: none;
      }
      // Position overrides: the label is pinned to the corresponding
      // side of the 28×28 pin container. Gap of ~2px on cardinals.
      .map-pin.label-pos-n  > .map-pin-label { bottom: 100%; top: auto; left: 50%;  right: auto; transform: translateX(-50%);     margin: 0 0 -2px 0; }
      .map-pin.label-pos-s  > .map-pin-label { top: 100%;    bottom: auto; left: 50%;  right: auto; transform: translateX(-50%);  margin: -2px 0 0 0; }
      .map-pin.label-pos-e  > .map-pin-label { top: 50%;     bottom: auto; left: 100%; right: auto; transform: translateY(-50%);  margin: 0 0 0 2px; }
      .map-pin.label-pos-w  > .map-pin-label { top: 50%;     bottom: auto; right: 100%; left: auto; transform: translateY(-50%);  margin: 0 2px 0 0; }
      .map-pin.label-pos-ne > .map-pin-label { bottom: 100%; top: auto; left: 100%; right: auto; transform: none; margin: 0 0 0 2px; }
      .map-pin.label-pos-nw > .map-pin-label { bottom: 100%; top: auto; right: 100%; left: auto; transform: none; margin: 0 2px 0 0; }
      .map-pin.label-pos-se > .map-pin-label { top: 100%;    bottom: auto; left: 100%; right: auto; transform: none; margin: 2px 0 0 0; }
      .map-pin.label-pos-sw > .map-pin-label { top: 100%;    bottom: auto; right: 100%; left: auto; transform: none; margin: 2px 0 0 0; }
      // Short is the default-visible variant; the `.label-hidden` gate
      // on `.map-pin` overrides this when zoom < minZoom.
      .map-pin-label-short { display: block; }

      .map-label {
        white-space: nowrap;
        cursor: grab;
        transform-origin: left center;
      }
      // Boxed text wraps and clips to its container
      .map-label-boxed {
        white-space: normal;
        word-break: break-word;
        max-width: 100%;
        max-height: 100%;
        overflow: hidden;
      }

      // Raise the hovered marker's Leaflet wrapper so its revealed
      // long label doesn't get clipped by neighbouring markers.
      .leaflet-marker-icon:has(.map-pin:hover) { z-index: 1000 !important; }

      // --- Low-zoom adjustments ---------------------------------------
      .zoom-low {
        .map-pin-number {
          width: 12px;
          height: 12px;
          border-width: 1.5px;
          font-size: 0;
        }
        // Shrunken circle sits ~6px smaller on every side; tighten the
        // label-to-pin gap in whichever direction the label is anchored.
        .map-pin.label-pos-n  > .map-pin-label,
        .map-pin.label-pos-ne > .map-pin-label,
        .map-pin.label-pos-nw > .map-pin-label { margin-bottom: -8px; }
        .map-pin.label-pos-s  > .map-pin-label,
        .map-pin.label-pos-se > .map-pin-label,
        .map-pin.label-pos-sw > .map-pin-label { margin-top: -8px; }
        .map-pin.label-pos-e  > .map-pin-label { margin-left: -8px; }
        .map-pin.label-pos-w  > .map-pin-label { margin-right: -8px; }
      }

      // --- Text-feature bounding box + resize handles -----------------
      // The wrapper itself is transparent to events; only the text span
      // and resize handles catch clicks, so empty box space passes
      // through to the map (for deselect).
      .map-text-box {
        position: relative;
        pointer-events: none;

        > .map-label { pointer-events: none; }
        .map-label-text { pointer-events: auto; }
        > .resize-handle { pointer-events: auto; }

        &.selected {
          pointer-events: auto; // whole box is draggable once selected
          outline: 1.5px dashed var(--accent, #6b3a2a);
          outline-offset: 0;
        }
      }
      // Leaflet's marker wrapper is `pointer-events: auto` by default.
      // Turn it off for text-box markers, then re-enable it for the
      // wrapper of a selected box so drag works anywhere inside.
      .leaflet-marker-icon:has(.map-text-box) { pointer-events: none !important; }
      .leaflet-marker-icon:has(.map-text-box.selected) { pointer-events: auto !important; }

      .resize-handle {
        position: absolute;
        width: 10px;
        height: 10px;
        background: #fff;
        border: 2px solid var(--accent, #6b3a2a);
        border-radius: 2px;
        box-sizing: border-box;
        z-index: 10;
      }
      .handle-nw { top: -5px;    left: -5px;    cursor: nwse-resize; }
      .handle-n  { top: -5px;    left: 50%;     transform: translateX(-50%); cursor: ns-resize; }
      .handle-ne { top: -5px;    right: -5px;   cursor: nesw-resize; }
      .handle-e  { top: 50%;     right: -5px;   transform: translateY(-50%); cursor: ew-resize; }
      .handle-se { bottom: -5px; right: -5px;   cursor: nwse-resize; }
      .handle-s  { bottom: -5px; left: 50%;     transform: translateX(-50%); cursor: ns-resize; }
      .handle-sw { bottom: -5px; left: -5px;    cursor: nesw-resize; }
      .handle-w  { top: 50%;     left: -5px;    transform: translateY(-50%); cursor: ew-resize; }

      // --- Tile rendering --------------------------------------------
      .leaflet-tile-container { will-change: transform; }
      .leaflet-tile { outline: 1px solid transparent; }
    }
  }
</style>
