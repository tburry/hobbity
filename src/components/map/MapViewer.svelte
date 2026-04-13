<script>
  import { onMount, onDestroy } from 'svelte';
  import { TEXT_PRESETS, PIN_PRESETS } from './tools.js';

  let { width, height, imageUrl, tiles, initialZoom, minZoom = 0, maxZoom = 5, pins = [], labelsVisible = false, editable = false, tool = null, ctx = null, selectedId = null, onviewchange, onwheel: onwheelcb } = $props();

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
  const HANDLE_POSITIONS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  function isMobile() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  }

  /**
   * Resolve a feature's styling from its `class`. The preset defines
   * font/case/letterSpacing/italic/bold/base/min/max — those fields live on
   * the preset, not the pin. Text features use TEXT_PRESETS, numbered pins
   * use PIN_PRESETS.
   */
  function resolvePreset(pin) {
    if (!pin.class) return null;
    const list = pin.number ? PIN_PRESETS : TEXT_PRESETS;
    return list.find(p => p.id === pin.class)?.defaults;
  }

  function computeFontSize(pin, zoom) {
    const z = zoom ?? REF_ZOOM;
    const isMobileView = isMobile();

    // Text features pick sizes from their class (preset). Fallback for
    // pin labels uses PIN_LABEL_SIZE. Size scales linearly with zoom
    // (2^(z - REF_ZOOM)), clamped to [min, max]. On mobile the floor
    // is always MOBILE_MIN_PX (16px).
    const spec = resolvePreset(pin) ?? PIN_LABEL_SIZE;

    const scale = Math.pow(2, z - REF_ZOOM);
    const raw = spec.base * scale;
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
      const weight = s.bold ? '700' : '400';
      const style = s.italic ? 'italic' : 'normal';
      const transforms = [];
      if (pin.rotate) transforms.push(`rotate(${pin.rotate}deg)`);
      const transformStyle = transforms.length ? `transform: ${transforms.join(' ')};` : '';
      const extra = extraStyles(s);
      const textStyle = `font-family: ${font}; font-size: ${size.toFixed(1)}px; font-weight: ${weight}; font-style: ${style}; ${extra}`;

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
        const html = `<div class="map-text-box${selClass}" style="${boxStyle}" data-pin-id="${pin.id}"><div class="map-label map-label-boxed" style="${textStyle}">${esc(pin.name)}</div>${handles}</div>`;
        return L.divIcon({
          className: '',
          html,
          iconSize: [cssW, cssH],
          iconAnchor: [cssW / 2, cssH / 2], // center-anchored
        });
      }

      const html = `<div class="map-label" style="${textStyle} ${transformStyle}">${esc(pin.name)}</div>`;
      return L.divIcon({
        className: '',
        html,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
    }

    // Hide pin when map zoom is below its min-zoom threshold.
    const curZ = currentZoom ?? map?.getZoom() ?? REF_ZOOM;
    const pinMinZ = pin.minZoom ?? 0;
    if (curZ < pinMinZ) {
      return L.divIcon({ className: '', html: '', iconSize: [0, 0], iconAnchor: [0, 0] });
    }
    const shortLabel = esc(pin.name);
    const longLabel = pin.longName ? esc(pin.longName) : shortLabel;
    // Pin label styling comes from the preset (class).
    const s = resolvePreset(pin) || {};
    const font = FONTS[s.font] || FONTS.body;
    const size = computeFontSize(pin, currentZoom);
    const weight = s.bold ? '700' : '400';
    const style = s.italic ? 'italic' : 'normal';
    const extra = extraStyles(s);
    const labelStyle = `font-family: ${font}; font-size: ${size.toFixed(1)}px; font-weight: ${weight}; font-style: ${style}; ${extra}`;
    return L.divIcon({
      className: '',
      html: `<div class="map-pin"><span class="map-pin-label map-pin-label-short" style="${labelStyle}">${shortLabel}</span><span class="map-pin-label map-pin-label-long" style="${labelStyle}">${longLabel}</span><span class="map-pin-number">${pin.number}</span></div>`,
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
    c.toggle('labels-visible', labelsVisible && !isLow);
  }

  // Re-apply classes when labelsVisible changes
  $effect(() => {
    void labelsVisible;
    updateLabelClasses();
  });

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

  function setupToolEvents() {
    if (!map) return;
    const container = map.getContainer();

    // Suppress the browser context menu so right-drag works cleanly
    container.addEventListener('contextmenu', (e) => e.preventDefault());

    container.addEventListener('mousedown', (e) => {
      // Right-click: start panning (mouse users)
      if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
        rightPan = { startX: e.clientX, startY: e.clientY };
        container.classList.add('right-panning');
        return;
      }
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
      if (rightPan) {
        e.preventDefault();
        const dx = e.clientX - rightPan.startX;
        const dy = e.clientY - rightPan.startY;
        rightPan.startX = e.clientX;
        rightPan.startY = e.clientY;
        map.panBy([-dx, -dy], { animate: false });
        return;
      }
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
      if (rightPan) {
        e.preventDefault();
        rightPan = null;
        container.classList.remove('right-panning');
        return;
      }
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
        dragging: false, // disable default left-drag panning
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
        dragging: false, // disable default left-drag panning
      });

      L.imageOverlay(imageUrl, bounds).addTo(map);
    }

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
        // Pinch gesture — always zoom
        const zoom = map.getZoom() - e.deltaY * 0.5;
        map.setZoom(Math.max(minZoom, Math.min(maxZoom, zoom)));
      } else if (isTrackpad(e)) {
        // Trackpad scroll — pan
        map.panBy([e.deltaX, e.deltaY], { animate: false });
      } else {
        // Mouse wheel — zoom
        const zoom = map.getZoom() - e.deltaY * 0.01;
        map.setZoom(Math.max(minZoom, Math.min(maxZoom, zoom)));
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

<style>
  .map-container {
    position: absolute;
    inset: 0;
    background: #1a1a1a;
  }
  /* Tool-specific cursors (override Leaflet's default grab cursor) */
  :global(.leaflet-container) { cursor: default !important; }
  :global(.leaflet-container.tool-pin),
  :global(.leaflet-container.tool-text),
  :global(.leaflet-container.tool-path) { cursor: crosshair !important; }
  :global(.leaflet-container.right-panning) { cursor: grabbing !important; }
  /* In select mode, pins and label text show pointer on hover */
  :global(.tool-select .map-pin),
  :global(.tool-select .map-pin-number),
  :global(.tool-select .map-label) { cursor: pointer !important; }
  /* Hovering the text inside a selected box shows the move cursor.
     Individual .handle-* rules keep their own resize cursors. */
  :global(.tool-select .map-text-box.selected .map-label) { cursor: move !important; }

  :global(.map-pin) {
    width: 28px;
    height: 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: auto !important;
    position: relative;
  }
  :global(.map-pin-number) {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    color: #000000;
    border: 2px solid #c9a96e;
    border-radius: 50%;
    font: 700 12px/1 'Crimson Pro', 'Lora', serif;
    cursor: grab;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
  }
  :global(.map-pin-label) {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 2px;
    line-height: 1.2;
    color: #000000;
    white-space: nowrap;
    pointer-events: none;
    text-shadow: 1px 1px 0 rgba(255, 255, 255, .8), -1px -1px 0 rgba(255, 255, 255, .8), 0 0 6px rgba(255, 255, 255, .8), 0 0 8px rgba(255, 255, 255, .5);
    display: none;
  }
  /* Short label: shown when labels-visible is applied AND not at low zoom */
  :global(.labels-visible:not(.zoom-low) .map-pin-label-short) { display: block; }
  /* Long label: shown on hover (all zooms) */
  :global(.map-pin:hover .map-pin-label-long) { display: block; }
  :global(.map-pin:hover .map-pin-label-short) { display: none; }
  /* At low zoom, force all pin labels hidden unless hovering */
  :global(.zoom-low .map-pin-label) { display: none !important; }
  :global(.zoom-low .map-pin:hover .map-pin-label-long) { display: block !important; }

  /* Low zoom: shrink pin circles, hide numbers */
  :global(.zoom-low .map-pin-number) {
    width: 12px;
    height: 12px;
    border-width: 1.5px;
    font-size: 0;
  }

  :global(.map-label) {
    color: #000000;
    white-space: nowrap;
    cursor: grab;
    text-shadow: 0 0 2px #faf6f0, 0 0 2px #faf6f0, 0 0 4px #faf6f0;
    transform-origin: left center;
  }
  /* Boxed text wraps within the container and doesn't overflow */
  :global(.map-label-boxed) {
    white-space: normal;
    word-break: break-word;
    max-width: 100%;
    max-height: 100%;
    overflow: hidden;
  }

  /* Selection box + resize handles. The box itself is NOT clickable —
     only the inner label text (and resize handles when selected) register
     pointer events. Clicks on empty space inside the box fall through to
     the map so they can deselect. */
  :global(.map-text-box) {
    position: relative;
    pointer-events: none;
  }
  :global(.map-text-box > .map-label) { pointer-events: auto; }
  :global(.map-text-box > .resize-handle) { pointer-events: auto; }
  /* Show the bounding box outline for the currently selected text feature */
  :global(.map-text-box.selected) {
    outline: 1.5px dashed #6b3a2a;
    outline-offset: 0;
  }
  :global(.resize-handle) {
    position: absolute;
    width: 10px;
    height: 10px;
    background: #fff;
    border: 2px solid #6b3a2a;
    border-radius: 2px;
    box-sizing: border-box;
    z-index: 10;
  }
  :global(.handle-nw) { top: -5px;    left: -5px;    cursor: nwse-resize; }
  :global(.handle-n)  { top: -5px;    left: 50%;     transform: translateX(-50%); cursor: ns-resize; }
  :global(.handle-ne) { top: -5px;    right: -5px;   cursor: nesw-resize; }
  :global(.handle-e)  { top: 50%;     right: -5px;   transform: translateY(-50%); cursor: ew-resize; }
  :global(.handle-se) { bottom: -5px; right: -5px;   cursor: nwse-resize; }
  :global(.handle-s)  { bottom: -5px; left: 50%;     transform: translateX(-50%); cursor: ns-resize; }
  :global(.handle-sw) { bottom: -5px; left: -5px;    cursor: nesw-resize; }
  :global(.handle-w)  { top: 50%;     left: -5px;    transform: translateY(-50%); cursor: ew-resize; }
  /* Freeform label visibility is controlled per-feature via the minZoom
     prop and the makeIcon render, not by a blanket zoom-level rule. */

  /* Prevent sub-pixel gaps between tiles */
  :global(.leaflet-tile-container) { will-change: transform; }
  :global(.leaflet-tile) { outline: 1px solid transparent; }
</style>
