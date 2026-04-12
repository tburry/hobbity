<script>
  import { onMount, onDestroy } from 'svelte';

  let { width, height, imageUrl, tiles, initialZoom, minZoom = 0, maxZoom = 5, pins = [], labelsVisible = false, editable = false, onpinclick, onmapclick, onpindrag, onviewchange, onwheel: onwheelcb } = $props();

  let mapEl;
  let map;
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
  const SIZES = { sm: '11px', md: '16px', lg: '28px' };

  // Reference zoom for fixed-size labels
  const refZoom = $derived(initialZoom ?? 2);

  function makeIcon(pin, currentZoom) {
    const isLabel = !pin.number;

    if (isLabel) {
      const font = FONTS[pin.font] || FONTS.body;
      const basePx = parseFloat(SIZES[pin.size] || SIZES.md);
      const weight = pin.bold ? '700' : '400';
      const style = pin.italic ? 'italic' : 'normal';
      // Fixed labels scale with zoom; non-fixed stay constant screen size
      const scale = pin.fixed ? Math.pow(2, (currentZoom ?? refZoom) - refZoom) : 1;
      const size = basePx * scale;
      const transforms = [];
      if (pin.rotate) transforms.push(`rotate(${pin.rotate}deg)`);
      const transformStyle = transforms.length ? `transform: ${transforms.join(' ')};` : '';
      const html = `<div class="map-label" style="font-family: ${font}; font-size: ${size.toFixed(1)}px; font-weight: ${weight}; font-style: ${style}; ${transformStyle}">${esc(pin.name)}</div>`;
      return L.divIcon({
        className: '',
        html,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
    }

    return L.divIcon({
      className: '',
      html: `<div class="map-pin"><span class="map-pin-number">${pin.number}</span><span class="map-pin-label">${esc(pin.name)}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  function addMarker(pin) {
    if (!map) return;
    const marker = L.marker([pin.y, pin.x], {
      icon: makeIcon(pin),
      draggable: editable,
    }).addTo(map);

    marker.bindTooltip(esc(pin.name), {
      className: 'pin-tooltip',
      direction: 'top',
      offset: [0, -16],
      permanent: labelsVisible,
    });

    if (editable) {
      marker.on('click', () => onpinclick?.(pin));
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onpindrag?.(pin, Math.round(pos.lng), Math.round(pos.lat));
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
    marker.setIcon(makeIcon(pin));
    marker.setTooltipContent(esc(pin.name));
  }

  export function panTo(pin) {
    if (!map) return;
    map.setView([pin.y, pin.x], map.getZoom());
    const m = markerMap.get(pin.id);
    if (m) m.openTooltip();
  }

  // Rebuild tooltips when labelsVisible changes
  $effect(() => {
    const visible = labelsVisible;
    for (const [id, marker] of markerMap) {
      const pin = pins.find(p => p.id === id);
      if (!pin) continue;
      marker.unbindTooltip();
      marker.bindTooltip(esc(pin.name), {
        className: 'pin-tooltip',
        direction: 'top',
        offset: [0, -16],
        permanent: visible,
      });
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
      });

      L.imageOverlay(imageUrl, bounds).addTo(map);
    }

    if (editable) {
      map.on('click', (e) => onmapclick?.(e.latlng));
    }

    function emitView() {
      const c = map.getCenter();
      onviewchange?.({ zoom: map.getZoom(), x: Math.round(c.lng), y: Math.round(c.lat) });
    }
    map.on('zoomend moveend', emitView);

    // Update fixed labels on zoom change
    map.on('zoomend', () => {
      const z = map.getZoom();
      for (const [id, marker] of markerMap) {
        const pin = pins.find(p => p.id === id);
        if (pin && !pin.number && pin.fixed) {
          marker.setIcon(makeIcon(pin, z));
        }
      }
    });

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
    cursor: crosshair;
  }

  :global(.map-pin) {
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: auto !important;
  }
  :global(.map-pin-number) {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    color: #3b2e1e;
    border: 2px solid #c9a96e;
    border-radius: 50%;
    font: 700 12px/1 'Crimson Pro', 'Lora', serif;
    cursor: grab;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
  }
  :global(.map-pin-label) {
    font: 700 11px/1.2 'Lora', serif;
    color: #fff;
    background: rgba(30,22,16,0.85);
    padding: 1px 5px;
    border-radius: 3px;
    white-space: nowrap;
    margin-top: 2px;
    pointer-events: none;
    display: none;
  }
  :global(.labels-visible .map-pin-label) { display: block; }
  :global(.map-pin:hover .map-pin-label) { display: block; }

  :global(.map-label) {
    color: #3b2e1e;
    white-space: nowrap;
    cursor: grab;
    text-shadow: 0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff;
    transform-origin: left center;
  }

  :global(.pin-tooltip) {
    background: rgba(30,22,16,0.85);
    color: #d4c4a8;
    border: none;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.5);
  }
  :global(.pin-tooltip::before) { display: none; }

  /* Prevent sub-pixel gaps between tiles */
  :global(.leaflet-tile-container) { will-change: transform; }
  :global(.leaflet-tile) { outline: 1px solid transparent; }
</style>
