<script>
  import { onMount, onDestroy } from 'svelte';
  import { TEXT_PRESETS, PIN_PRESETS, PATH_PRESETS, DEFAULT_MARKER_MIN_ZOOM, KIND_DEFAULTS, MIN_FONT_PX, MAX_FONT_PX, sizeSpec, sizeClass as getSizeClass } from './tools.js';
  import { MARKER_SPRITE, MARKER_SIZES } from './markers.generated.js';
  import './map-viewer.scss';

  let { width, height, imageUrl, tiles, initialZoom, fit = 'bounds', minZoom = 0, maxZoom = 5, pins = [], halo = null, grid = null, gridVisible = true, labelScale = 1, markerLabelScale = 1, editable = false, tool = null, ctx = null, selectedId: selectedIdProp = null, onviewchange, onwheel: onwheelcb, ongridtoggle = null } = $props();

  // Override --halo (and re-derive --halo-light) on the container when
  // the map's meta supplies a custom halo color. `var(--halo)` in the
  // --halo-light declaration resolves on this element, so both share
  // the override.
  const haloStyle = $derived(halo
    ? `--halo: ${halo}; --halo-light: hsl(from var(--halo) h s calc(l + 0.3));`
    : '');

  // View-mode selection is internal (no external owner); edit-mode
  // selection is driven by the editor via the `selectedId` prop.
  let viewSelectedId = $state(null);
  const selectedId = $derived(editable ? selectedIdProp : viewSelectedId);

  // Per-path node selection — used to drive Delete-key removal and the
  // selected-node highlight. Cleared whenever the active path changes.
  let selectedNodeIndex = $state(null);
  $effect(() => {
    void selectedId;
    selectedNodeIndex = null;
  });

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

  /**
   * Build the SVG content for a grid overlay. Returns an SVGSVGElement
   * sized to the image's natural pixel dimensions. The single root <path>
   * keeps the DOM trivial regardless of how many lines/cells we render.
   *
   * Square: aligned line lattice; `originX/Y` is the top-left corner of
   * the (0,0) cell.
   * Hex (pointy/flat): `size` is the cell circumradius (centre-to-vertex);
   * `originX/Y` is the centre of the (0,0) cell. Cells whose bbox falls
   * outside [0,w]×[0,h] are skipped.
   */
  function buildGridSVG(g, w, h) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', g.color || 'rgba(60, 40, 20, 0.35)');
    // Stroke width tracks the current zoom (min 1) so lines stay
    // legible as the user zooms in. Updated live via gridLayer.zoom.
    const z = map?.getZoom() ?? 1;
    path.setAttribute('stroke-width', String(Math.max(1, z)));
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    path.setAttribute('d', buildGridPath(g, w, h));
    svg.appendChild(path);
    return svg;
  }

  function buildGridPath(g, w, h) {
    const size = Math.max(1, Number(g.size) || 100);
    const ox = Number(g.originX) || 0;
    const oy = Number(g.originY) || 0;
    const fmt = (n) => Number(n).toFixed(2);

    if (g.shape === 'square') {
      const parts = [];
      // First vertical line at originX, stepping by size in both directions
      // until we leave [0, w]. The modulo math keeps it stable across origins.
      const startX = ox - Math.floor(ox / size) * size;
      for (let x = startX; x <= w; x += size) {
        parts.push(`M${fmt(x)} 0L${fmt(x)} ${fmt(h)}`);
      }
      const startY = oy - Math.floor(oy / size) * size;
      for (let y = startY; y <= h; y += size) {
        parts.push(`M0 ${fmt(y)}L${fmt(w)} ${fmt(y)}`);
      }
      return parts.join('');
    }

    if (g.shape === 'hex-pointy' || g.shape === 'hex-flat') {
      const r = size; // circumradius
      const sqrt3 = Math.sqrt(3);
      const parts = [];
      // Pointy-top: width = sqrt(3) * r, height = 2r; horizontal step = sqrt(3)*r,
      // vertical step = 1.5r, even/odd rows offset horizontally by sqrt(3)*r/2.
      // Flat-top is the 90° rotation: vertical step = sqrt(3)*r, horizontal step = 1.5r.
      const pointy = g.shape === 'hex-pointy';
      const colStep = pointy ? sqrt3 * r : 1.5 * r;
      const rowStep = pointy ? 1.5 * r : sqrt3 * r;
      const colOffset = pointy ? sqrt3 * r / 2 : 0;
      const rowOffset = pointy ? 0 : sqrt3 * r / 2;
      // Vertex offsets relative to a cell centre, going clockwise.
      const verts = pointy
        ? [
            [0, -r],
            [sqrt3 * r / 2, -r / 2],
            [sqrt3 * r / 2,  r / 2],
            [0,  r],
            [-sqrt3 * r / 2,  r / 2],
            [-sqrt3 * r / 2, -r / 2],
          ]
        : [
            [-r, 0],
            [-r / 2, -sqrt3 * r / 2],
            [ r / 2, -sqrt3 * r / 2],
            [ r, 0],
            [ r / 2,  sqrt3 * r / 2],
            [-r / 2,  sqrt3 * r / 2],
          ];
      // Range of cells whose bbox could touch [0,w]×[0,h]. Centre offsets
      // from (ox, oy); pad one extra cell on every side so partials draw.
      const cellW = pointy ? sqrt3 * r : 2 * r;
      const cellH = pointy ? 2 * r : sqrt3 * r;
      const minCol = Math.floor((-cellW / 2 - ox) / colStep) - 1;
      const maxCol = Math.ceil((w + cellW / 2 - ox) / colStep) + 1;
      const minRow = Math.floor((-cellH / 2 - oy) / rowStep) - 1;
      const maxRow = Math.ceil((h + cellH / 2 - oy) / rowStep) + 1;
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const cx = ox + col * colStep + (row % 2 !== 0 ? colOffset : 0);
          const cy = oy + row * rowStep + (col % 2 !== 0 ? rowOffset : 0);
          // Cheap bbox cull: skip cells fully outside the image.
          if (cx + cellW / 2 < 0 || cx - cellW / 2 > w) continue;
          if (cy + cellH / 2 < 0 || cy - cellH / 2 > h) continue;
          let d = '';
          for (let i = 0; i < 6; i++) {
            const [vx, vy] = verts[i];
            d += `${i === 0 ? 'M' : 'L'}${fmt(cx + vx)} ${fmt(cy + vy)}`;
          }
          d += 'Z';
          parts.push(d);
        }
      }
      return parts.join('');
    }

    return '';
  }

  const FONTS = {
    body: "'Lora', serif",
    heading: "'Crimson Pro', serif",
    title: "'Uncial Antiqua', serif",
  };
  const REF_ZOOM = 2;
  // Markers (numbered pins + overworld glyph pins) scale from their
  // preset's `min` size at this zoom — one level tighter than text
  // so they stay readable when the map is zoomed out a bit.
  const MARKER_REF_ZOOM = 3;
  const MOBILE_MIN_PX = 16;
  // Fallback size for features without a style (e.g. numbered pin labels).
  // Fallback spec for pin labels with no preset. Bounds come from the
  // global MIN_FONT_PX / MAX_FONT_PX so it stays in sync with every
  // other label.
  const PIN_LABEL_SIZE = { base: 14 };
  // Visibility thresholds expressed as zoom levels. All comparisons
  // go through the CRS scale function (CSS-px per image-px) so the
  // same threshold behaves consistently regardless of image size,
  // tile pyramid, or device pixel ratio.
  const MARKER_HIDE_ZOOM = 0.25;   // markers vanish entirely below this
  const PIN_SHRINK_ZOOM  = 1.5;    // numbered pins → empty 12px dots
  // Pixels per viewBox unit for overworld marker SVGs. Authored sizes
  // (8–15 units) come through proportionally — capital reads bigger
  // than village by design — and never get pulled around by font/label
  // size or per-map labelScale.
  const MARKER_PX_PER_UNIT = 2;
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

    // Shrink mode: pin the size to `MIN_FONT_PX` at the feature's
    // min-zoom and scale up from there (doubling per zoom level),
    // clamped to max. Default mode: scale from `base` at REF_ZOOM,
    // clamped to [MIN_FONT_PX, max] (mobile uses its own taller floor
    // for touch readability).
    const pivot = pin.shrink ? (pin.minZoom ?? REF_ZOOM) : REF_ZOOM;
    const scale = Math.pow(2, z - pivot);
    const raw = (pin.shrink ? MIN_FONT_PX : spec.base) * scale;
    // Map title is sized relative to the image and grows freely with
    // zoom — bypass the global floor and ceiling so it always reads
    // proportionally regardless of how far in or out the user zooms.
    if (pin.class === 'map-title') return raw;
    const min = isMobileView ? Math.max(MOBILE_MIN_PX, MIN_FONT_PX) : MIN_FONT_PX;
    const max = spec.max ?? MAX_FONT_PX;
    return Math.max(min, Math.min(max, raw));
  }

  // Marker labels scale slower than the map — a plain `2 ^ (z - pivot)`
  // curve makes them balloon quickly when zooming in. This fudge factor
  // multiplies the exponent so each zoom level grows the label by
  // `2 ^ factor` (≈ 1.41× at 0.5) instead of 2×.
  const MARKER_LABEL_SCALE = 0.5;

  /** Font size for the text label next to a marker. Sits at the
   * preset's `base` size for all zooms ≤ MARKER_REF_ZOOM (3), then
   * grows slowly above that per MARKER_LABEL_SCALE, clamped to `max`.
   * Never smaller than `base`. On mobile we swap the preset's size
   * for the shared `mobile` spec so every marker label lands in the
   * same readable range regardless of preset. Marker bodies (numbered
   * circle / overworld glyph) use `computeFontSize`. */
  function computeMarkerLabelSize(pin, zoom) {
    const z = zoom ?? MARKER_REF_ZOOM;
    const isMobileView = isMobile();
    const preset = resolvePreset(pin);
    const spec = isMobileView
      ? sizeSpec('mobile')
      : (preset ? sizeSpec(preset.size) : PIN_LABEL_SIZE);
    const raw = spec.base * Math.pow(2, (z - MARKER_REF_ZOOM) * MARKER_LABEL_SCALE);
    const floor = spec.base;
    const max = spec.max ?? MAX_FONT_PX;
    return Math.max(floor, Math.min(max, raw));
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

  /** Path feature: text flowing along a multi-node curve. Each node
   * carries optional `cpIn`/`cpOut` tangents; in `mode: 'bezier'` the
   * segment between two nodes is a cubic Bézier (using prev.cpOut and
   * cur.cpIn), otherwise a straight line. */
  function makePathIcon(pin, currentZoom) {
    const z = currentZoom ?? map?.getZoom() ?? REF_ZOOM;
    const zoomScale = map?.options?.crs?.scale ? map.options.crs.scale(z) : Math.pow(2, z);

    const s = resolvePreset(pin) || {};
    const font = FONTS[s.font] || FONTS.body;
    // `rawFontSize` is the preset-driven, clamped size used for path
    // bbox padding (so the icon's hit-area doesn't change with the
    // user-tunable label scale). `fontSize` is what the text actually
    // renders at — labelScale-multiplied, but never below MIN_FONT_PX.
    const rawFontSize = computeFontSize(pin, currentZoom);
    const fontSize = Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, rawFontSize * (labelScale ?? 1)));
    const weightClass = `font-${s.weight || 'normal'}`;
    const style = s.italic ? 'italic' : 'normal';
    const extra = extraStyles(s);
    const sizeClass = getSizeClass(s.size);
    const colorClass = s.colorClass || 'text-black';

    const nodes = Array.isArray(pin.nodes) && pin.nodes.length >= 2
      ? pin.nodes
      : [{ p: [pin.x, pin.y] }, { p: [pin.x, pin.y] }];
    const useBezier = pin.mode === 'bezier';

    // Image-pixel bbox covering every anchor + (when bezier) tangent
    // point. Pad by ~1.5 × font cap-height in image px so descenders/
    // ascenders don't clip when text sits above/below the curve.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const consider = (p) => {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    };
    for (const n of nodes) {
      consider(n.p);
      if (useBezier) {
        if (n.cpIn)  consider(n.cpIn);
        if (n.cpOut) consider(n.cpOut);
      }
    }
    const padImg = (rawFontSize * 1.5) / zoomScale;
    minX -= padImg; maxX += padImg;
    minY -= padImg; maxY += padImg;

    const cssW = (maxX - minX) * zoomScale;
    const cssH = (maxY - minY) * zoomScale;
    const px = (p) => [(p[0] - minX) * zoomScale, (p[1] - minY) * zoomScale];
    const fmt = (n) => n.toFixed(1);
    // Build the path d, optionally reversed when `flip` is true so
    // text renders on the opposite side. SVG 2's `textPath
    // side="right"` would be simpler but has patchy browser support;
    // reversing the path works everywhere.
    const flip = !!pin.flip;
    const ordered = flip ? [...nodes].reverse() : nodes;
    // When flipping, swap each node's cpIn/cpOut so the reversed
    // segments still pick up the correct handles in build order.
    const segNodes = flip
      ? ordered.map(n => ({ p: n.p, cpIn: n.cpOut, cpOut: n.cpIn }))
      : ordered;
    const dParts = [];
    {
      const [x0, y0] = px(segNodes[0].p);
      dParts.push(`M ${fmt(x0)} ${fmt(y0)}`);
    }
    for (let i = 1; i < segNodes.length; i++) {
      const prev = segNodes[i - 1], cur = segNodes[i];
      const [px2, py2] = px(cur.p);
      if (useBezier) {
        const [c1x, c1y] = px(prev.cpOut ?? prev.p);
        const [c2x, c2y] = px(cur.cpIn ?? cur.p);
        dParts.push(`C ${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(px2)} ${fmt(py2)}`);
      } else {
        dParts.push(`L ${fmt(px2)} ${fmt(py2)}`);
      }
    }
    const d = dParts.join(' ');

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
    const selNode = pin.id === selectedId ? selectedNodeIndex : null;
    if (isEditing) {
      // Iterate forward through the unflipped node list so handle
      // indices match the underlying data regardless of `flip`.
      const guideLines = [];
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const [nx, ny] = px(n.p);
        const selectedAttr = selNode === i ? ' node-selected' : '';
        handles += `<div class="path-handle path-endpoint${selectedAttr}" data-path-handle="p:${i}" data-pin-id="${pin.id}" style="left:${nx.toFixed(1)}px;top:${ny.toFixed(1)}px"></div>`;
        if (useBezier) {
          if (i > 0 && n.cpIn) {
            const [cx, cy] = px(n.cpIn);
            guideLines.push(`<line x1="${nx.toFixed(1)}" y1="${ny.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${cy.toFixed(1)}"/>`);
            handles += `<div class="path-handle path-control" data-path-handle="cpIn:${i}" data-pin-id="${pin.id}" style="left:${cx.toFixed(1)}px;top:${cy.toFixed(1)}px"></div>`;
          }
          if (i < nodes.length - 1 && n.cpOut) {
            const [cx, cy] = px(n.cpOut);
            guideLines.push(`<line x1="${nx.toFixed(1)}" y1="${ny.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${cy.toFixed(1)}"/>`);
            handles += `<div class="path-handle path-control" data-path-handle="cpOut:${i}" data-pin-id="${pin.id}" style="left:${cx.toFixed(1)}px;top:${cy.toFixed(1)}px"></div>`;
          }
        }
      }
      if (guideLines.length) {
        handles += `<svg class="path-guides" width="${cssW}" height="${cssH}" viewBox="0 0 ${cssW} ${cssH}">${guideLines.join('')}</svg>`;
      }
      // Dedicated move handle — the only way to translate the whole
      // curve. Sits at the bbox midpoint so it's clearly distinct
      // from the endpoint and control-point handles.
      const Mx = cssW / 2;
      const My = cssH / 2;
      handles += `<div class="path-handle path-move" data-path-handle="move" data-pin-id="${pin.id}" style="left:${Mx.toFixed(1)}px;top:${My.toFixed(1)}px" title="Drag to move curve"></div>`;
    }

    const selClass = isSelected ? ' selected' : '';
    const hiddenClass = labelHidden ? ' label-hidden' : '';
    const editStrokes = isEditing
      ? `<path class="path-stroke" d="${d}" fill="none"/><path class="path-hit" d="${d}" fill="none" data-pin-id="${pin.id}"/>`
      : '';
    const html = `<div class="map-path${selClass}${hiddenClass}" data-pin-id="${pin.id}"><svg class="path-text" width="${cssW}" height="${cssH}" viewBox="0 0 ${cssW} ${cssH}"><defs><path id="${pathId}" d="${d}" fill="none"/></defs>${editStrokes}<text class="${sizeClass} ${colorClass} ${weightClass}" text-anchor="${textAnchor}" dominant-baseline="${dominantBaseline}" style="${textStyle}"><textPath href="#${pathId}" startOffset="${startOffset}">${esc(pin.name)}</textPath></text></svg>${handles}</div>`;

    // Marker sits at nodes[0]; iconAnchor positions it within the
    // CSS-pixel bbox.
    const anchorX = (nodes[0].p[0] - minX) * zoomScale;
    const anchorY = (nodes[0].p[1] - minY) * zoomScale;
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
      // Style comes from the preset for text features. `rawSize` is the
      // preset-driven, clamped font size in image px; `displaySize`
      // applies the user-tunable per-map labelScale. Box-fit math uses
      // rawSize so changing labelScale only resizes the *text*, not the
      // surrounding bounding box. The map title is sized relative to
      // the image as a whole, so it ignores labelScale entirely. Every
      // displayed size is floored at MIN_FONT_PX so labels stay
      // readable no matter how aggressive the scale.
      const s = resolvePreset(pin) || {};
      const font = FONTS[s.font] || FONTS.body;
      const rawSize = computeFontSize(pin, currentZoom);
      const isMapTitle = pin.class === 'map-title';
      const scaled = isMapTitle ? rawSize : rawSize * (labelScale ?? 1);
      // Map title is exempt from both clamps — it scales with zoom
      // proportionally to the image and shouldn't be capped or floored.
      const displaySize = isMapTitle ? scaled : Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, scaled));
      const weightClass = `font-${s.weight || 'normal'}`;
      const style = s.italic ? 'italic' : 'normal';
      const transforms = [];
      if (pin.rotate) transforms.push(`rotate(${pin.rotate}deg)`);
      const transformStyle = transforms.length ? `transform: ${transforms.join(' ')};` : '';
      const extra = extraStyles(s);
      const textStyle = `font-family: ${font}; font-size: ${displaySize.toFixed(1)}px; font-style: ${style}; ${extra}`;
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
        const specForScale = rp ? sizeSpec(rp.size) : PIN_LABEL_SIZE;
        const startSize = pin.shrink ? (specForScale.min ?? specForScale.base) : specForScale.base;
        const unclamped = startSize * Math.pow(2, z - pivot);
        const clampRatio = unclamped > 0 ? rawSize / unclamped : 1;
        const zoomScale = rawZoomScale * clampRatio;
        const cssW = pin.width * zoomScale;
        const cssH = pin.height * zoomScale;
        const align = pin.align || 'center';
        const valign = pin.valign || 'middle';
        const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
        const alignItems = valign === 'top' ? 'flex-start' : valign === 'bottom' ? 'flex-end' : 'center';
        const boxStyle = `width: ${cssW.toFixed(1)}px; height: ${cssH.toFixed(1)}px; display: flex; justify-content: ${justify}; align-items: ${alignItems}; text-align: ${align}; ${transformStyle}`;
        // Alignment drives the anchor — same 9-point compass grid as
        // markers. The (x, y) image coord lands at the corner/edge the
        // text aligns toward, so authoring is "type here and the text
        // grows away from this point".
        const anchorY = valign === 'top' ? 'n' : valign === 'bottom' ? 's' : '';
        const anchorX = align === 'left' ? 'w' : align === 'right' ? 'e' : '';
        const anchorKey = (anchorY + anchorX) || 'center';
        const iconAnchorX = align === 'left' ? 0 : align === 'right' ? cssW : cssW / 2;
        const iconAnchorY = valign === 'top' ? 0 : valign === 'bottom' ? cssH : cssH / 2;
        const isSelected = pin.id === selectedId;
        const isEditing = editable && isSelected;
        const selClass = isEditing ? ' selected' : '';
        const handles = isEditing ? HANDLE_POSITIONS.map(h =>
          `<div class="resize-handle handle-${h}" data-handle="${h}" data-pin-id="${pin.id}"></div>`).join('') : '';
        const html = `<div class="map-text-box anchor-${anchorKey}${selClass}" style="${boxStyle}" data-pin-id="${pin.id}"><div class="map-label map-label-boxed ${sizeClass} ${colorClass} ${weightClass}" style="${textStyle}"><span class="map-label-text">${esc(pin.name)}</span></div>${handles}</div>`;
        return L.divIcon({
          className: '',
          html,
          iconSize: [cssW, cssH],
          iconAnchor: [iconAnchorX, iconAnchorY],
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
    // Glyph and label both follow the slower marker-label curve so a
    // 'large'-sized preset (capital, city) doesn't blow the glyph up
    // to label-typography proportions. The label scales by
    // `markerLabelScale` (per-map dial); the icon body stays viewBox-
    // driven so the marker keeps its authored visual hierarchy. Floor
    // the scaled label at MIN_FONT_PX so it never reads too small.
    const size = computeMarkerLabelSize(pin, currentZoom);
    const labelSize = Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, size * (markerLabelScale ?? 1)));
    const pinWeightClass = `font-${s.weight || 'normal'}`;
    const style = s.italic ? 'italic' : 'normal';
    const extra = extraStyles(s);
    const labelStyle = `font-family: ${font}; font-size: ${labelSize.toFixed(1)}px; font-style: ${style}; ${extra}`;
    const pinSizeClass = getSizeClass(s.size);
    const pinColorClass = s.colorClass || 'text-black';
    // Overworld pins render an SVG sprite symbol; town pins render a
    // numbered circle. The sprite preserves the authored size of each
    // symbol — capital is bigger than village by design.
    const preset = pin.class ? PIN_PRESETS[pin.class] : null;
    const isOverworld = preset?.category === 'overworld';
    const markClass = isOverworld ? 'map-pin-glyph' : 'map-pin-number';
    // Label-only pins hide the marker body. In edit mode, a selected
    // label-only pin still renders the body at 50% opacity so the user
    // can see what they're editing and can drag it.
    const isSelected = pin.id === selectedId;
    const showMark = !pin.labelOnly || (editable && isSelected);
    let markContent;
    let iconW = 24, iconH = 24;
    if (isOverworld) {
      const [vbW, vbH] = MARKER_SIZES[pin.class] ?? [1, 1];
      // SVG markers are authored at intentional viewBox sizes (capital
      // 15, town 8, etc.). Render them at a fixed px-per-unit so the
      // authored hierarchy comes through and font/label size changes
      // never resize the icon body. Halve the scale at zoom ≤ 2 so
      // the world view stays close to authored size. Frame matches
      // the icon exactly so the anchor crosshair lands on the icon —
      // label breathing room is added per-edge via CSS gap vars, not
      // by inflating the frame.
      const z = currentZoom ?? map?.getZoom() ?? REF_ZOOM;
      const pxPerUnit = z <= 2 ? MARKER_PX_PER_UNIT / 2 : MARKER_PX_PER_UNIT;
      iconW = vbW * pxPerUnit;
      iconH = vbH * pxPerUnit;
      markContent = `<svg viewBox="0 0 ${vbW} ${vbH}" width="100%" height="100%"><use href="#marker-${pin.class}"/></svg>`;
    } else {
      markContent = pin.number;
    }
    const markStyle = pin.labelOnly && showMark ? `opacity: 0.5;` : '';
    const markHtml = showMark ? `<span class="${markClass}" style="${markStyle}">${markContent}</span>` : '';
    // The visible marker (and its label) live inside a relative-positioned
    // frame sized to the actual icon. Label positions then become plain
    // 100%/50% percentages off the frame, regardless of marker size or
    // anchor — anchor is handled purely by where the frame sits inside
    // the 28×28 hit-box (see .map-pin-frame.anchor-* rules in scss).
    // Numbered pins skip the inline size so the .zoom-low CSS rule can
    // shrink them to 12×12 dots without an !important override.
    const frameStyle = isOverworld
      ? `width: ${iconW.toFixed(1)}px; height: ${iconH.toFixed(1)}px;`
      : '';
    return L.divIcon({
      className: '',
      html: `<div class="map-pin label-pos-${pin.labelPos || 'n'} anchor-${pin.anchor || 'center'}${isSelected ? ' selected' : ''}${isOverworld ? ' overworld' : ''}${labelHidden ? ' label-hidden' : ''}${pin.labelOnly ? ' label-only' : ''}"><div class="map-pin-frame" style="${frameStyle}"><span class="map-pin-label ${pinSizeClass} ${pinColorClass} ${pinWeightClass}" style="${labelStyle}">${label}</span>${markHtml}</div></div>`,
      iconSize: [28, 28],
      iconAnchor: pinIconAnchor(pin.anchor),
    });
  }

  // Map `pin.anchor` (center + 8 compass points) to Leaflet's iconAnchor
  // (pixel offset of the anchor point within the 28×28 icon box). E.g.
  // 'nw' puts the pin's top-left corner on (x, y); 's' puts the bottom
  // midpoint on (x, y) — classic dropped-pin feel.
  function pinIconAnchor(anchor) {
    switch (anchor) {
      case 'nw': return [0, 0];
      case 'n':  return [14, 0];
      case 'ne': return [28, 0];
      case 'w':  return [0, 14];
      case 'e':  return [28, 14];
      case 'sw': return [0, 28];
      case 's':  return [14, 28];
      case 'se': return [28, 28];
      default:   return [14, 14];
    }
  }

  function addMarker(pin) {
    if (!map) return;
    const isPath = pin.kind === 'path';
    // Paths anchor at endpoint A. The editor mirrors a→x,y on load for
    // its own bookkeeping, but the Astro site passes raw JSON, so
    // derive the latlng here so both callers work.
    const [lng, lat] = isPath && Array.isArray(pin.nodes) && pin.nodes[0]?.p ? pin.nodes[0].p : [pin.x, pin.y];
    const marker = L.marker([lat, lng], {
      icon: makeIcon(pin, map?.getZoom()),
      // Paths use a dedicated `.path-move` handle (not Leaflet's body
      // drag) so endpoint and bezier control handles always win the
      // mousedown — body drag would otherwise grab first and start
      // translating the curve before the handle ever sees the event.
      // Markers and text features still use Leaflet drag.
      draggable: editable && !isPath,
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
        // Leaflet suppresses the click event on drags, so a drag never
        // fires the normal click → select flow. Trigger it explicitly
        // so the pin shows as selected in the editor after being moved.
        dispatch('onPinClick', pin);
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
    const [lng, lat] = pin.kind === 'path' && Array.isArray(pin.nodes) && pin.nodes[0]?.p ? pin.nodes[0].p : [pin.x, pin.y];
    marker.setLatLng([lat, lng]);
  }

  export function panTo(pin) {
    if (!map) return;
    // Fall back to KIND_DEFAULTS when a pin hasn't stored its own
    // minZoom (the editor omits defaults from saved JSON, so most pins
    // arrive without a literal minZoom field).
    const minZ = pin.minZoom ?? KIND_DEFAULTS[pin.kind]?.minZoom ?? 0;
    const cur = map.getZoom();
    const [lng, lat] = pin.kind === 'path' && Array.isArray(pin.nodes) && pin.nodes[0]?.p ? pin.nodes[0].p : [pin.x, pin.y];
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

  // --- Grid overlay ---
  let gridLayer = null;
  function rebuildGrid() {
    if (!map) return;
    if (gridLayer) { gridLayer.remove(); gridLayer = null; }
    if (!grid || grid.shape === 'none' || !grid.shape) return;
    // The grid tool implies the user is editing it — force-show the
    // grid in that case so dragging works even if the visibility
    // toggle is off.
    const isGridTool = tool?.id === 'grid';
    if (!gridVisible && !isGridTool) return;
    const svg = buildGridSVG(grid, width, height);
    gridLayer = L.svgOverlay(svg, [[0, 0], [height, width]], {
      interactive: false,
      opacity: 1,
    }).addTo(map);
  }
  // Live updates: rebuild whenever grid config, visibility, active
  // tool, or zoom changes. Reading `grid.shape` etc. ensures Svelte's
  // deep proxy tracks edits to individual fields, not just whole-
  // object replacement.
  $effect(() => {
    if (!map) return;
    void grid?.shape;
    void grid?.size;
    void grid?.originX;
    void grid?.originY;
    void grid?.color;
    void gridVisible;
    void tool?.id;
    rebuildGrid();
  });

  // Grid visibility toggle button — sits as a Leaflet control in the
  // top-left, immediately below the zoom buttons. Only visible when a
  // grid is configured. Both the editor and the read-only viewer get
  // it via this single MapViewer-owned control.
  let gridToggleControl = null;
  let gridToggleBtn = null;
  function setupGridToggleControl() {
    if (!map || gridToggleControl) return;
    const Ctl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: () => {
        const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-grid-toggle');
        const a = L.DomUtil.create('a', '', wrap);
        a.setAttribute('role', 'button');
        a.setAttribute('aria-label', 'Toggle grid');
        a.title = 'Toggle grid';
        a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H3z"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>';
        L.DomEvent.on(a, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          L.DomEvent.stopPropagation(e);
          ongridtoggle?.();
        });
        L.DomEvent.disableClickPropagation(wrap);
        gridToggleBtn = a;
        return wrap;
      },
    });
    gridToggleControl = new Ctl();
  }
  // Add/remove the control as the configured grid comes and goes; sync
  // the active state when visibility flips.
  $effect(() => {
    if (!map || !gridToggleControl) return;
    const hasGrid = !!grid?.shape;
    const attached = !!gridToggleControl._map;
    if (hasGrid && !attached) gridToggleControl.addTo(map);
    else if (!hasGrid && attached) gridToggleControl.remove();
    if (gridToggleBtn) {
      gridToggleBtn.classList.toggle('active', !!gridVisible);
      gridToggleBtn.setAttribute('aria-pressed', gridVisible ? 'true' : 'false');
    }
  });

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

  // labelScale / markerLabelScale are global per-map dials; when they
  // change every marker icon needs a re-render. (Without this, only
  // newly-added or interacted-with pins pick up the new size.)
  $effect(() => {
    void labelScale;
    void markerLabelScale;
    if (!map) return;
    for (const [id, marker] of markerMap) {
      const pin = pins.find(p => p.id === id);
      if (pin) marker.setIcon(makeIcon(pin, map.getZoom()));
    }
  });

  // Re-render the active path when its selected node index changes so
  // the highlight tracks the user's click without waiting for a data
  // edit.
  $effect(() => {
    void selectedNodeIndex;
    if (!map || !selectedId) return;
    const marker = markerMap.get(selectedId);
    const pin = pins.find(p => p.id === selectedId);
    if (marker && pin?.kind === 'path') marker.setIcon(makeIcon(pin, map.getZoom()));
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
    const handle = resizing.handle;
    const { origX, origY, origW, origH, align, valign } = resizing;
    // (x, y) is the anchor: top-left for align/valign 'left'/'top',
    // bottom-right for 'right'/'bottom', etc. Reconstruct the original
    // bounding box from the anchor + alignment, slide only the moving
    // edges by the cursor delta, then re-derive (x, y, w, h) from the
    // new bounds. Edges that aren't part of the dragged handle stay
    // fixed in image coords, so the opposite corner / side never moves.
    const axFrac = align === 'left' ? 0 : align === 'right' ? 1 : 0.5;
    const ayFrac = valign === 'top' ? 0 : valign === 'bottom' ? 1 : 0.5;
    let left = origX - axFrac * origW;
    let top = origY - ayFrac * origH;
    let right = left + origW;
    let bottom = top + origH;
    if (handle.includes('w')) left += dx;
    if (handle.includes('e')) right += dx;
    if (handle.includes('n')) top += dy;
    if (handle.includes('s')) bottom += dy;
    // Cmd / Ctrl held: pivot resize around the anchor. Mirror the
    // un-dragged edge so the anchor stays put in image coords —
    // symmetric for centre alignment, no-op for the edge already at
    // the anchor.
    if (e.metaKey || e.ctrlKey) {
      if (handle.includes('e') && axFrac < 1) {
        left = (origX - axFrac * right) / (1 - axFrac);
      } else if (handle.includes('w') && axFrac > 0) {
        right = (origX - (1 - axFrac) * left) / axFrac;
      }
      if (handle.includes('s') && ayFrac < 1) {
        top = (origY - ayFrac * bottom) / (1 - ayFrac);
      } else if (handle.includes('n') && ayFrac > 0) {
        bottom = (origY - (1 - ayFrac) * top) / ayFrac;
      }
    }
    // Min-size clamp: collapse the moving edge into the fixed one
    // rather than letting it pass through.
    const MIN = 20;
    if (right - left < MIN) {
      if (handle.includes('w')) left = right - MIN;
      else right = left + MIN;
    }
    if (bottom - top < MIN) {
      if (handle.includes('n')) top = bottom - MIN;
      else bottom = top + MIN;
    }
    const w = right - left;
    const h = bottom - top;
    const x = left + axFrac * w;
    const y = top + ayFrac * h;
    ctx?.resize?.(pin, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** Cmd-click handler for inserting a new node along a path. Finds
   * the closest segment + parameter t to the cursor; for bezier mode
   * splits the cubic via de Casteljau (curve shape preserved exactly);
   * for straight mode just splices the click point in. */
  function insertNodeAtClick(pin, e) {
    const latlng = map.mouseEventToLatLng(e);
    const cx = latlng.lng, cy = latlng.lat;
    const nodes = pin.nodes;
    if (!Array.isArray(nodes) || nodes.length < 2) return;
    const useBezier = pin.mode === 'bezier';
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

    // Find closest segment + t (32-sample search, then 4 bisection
    // refinements). Coarse but plenty accurate for a click.
    let bestSeg = 0, bestT = 0, bestD2 = Infinity;
    for (let i = 0; i < nodes.length - 1; i++) {
      const A = nodes[i].p, B = nodes[i + 1].p;
      const C1 = useBezier ? (nodes[i].cpOut ?? A) : A;
      const C2 = useBezier ? (nodes[i + 1].cpIn ?? B) : B;
      const sample = (t) => {
        if (!useBezier) return lerp(A, B, t);
        const Q0 = lerp(A, C1, t), Q1 = lerp(C1, C2, t), Q2 = lerp(C2, B, t);
        const R0 = lerp(Q0, Q1, t), R1 = lerp(Q1, Q2, t);
        return lerp(R0, R1, t);
      };
      for (let s = 0; s <= 32; s++) {
        const t = s / 32;
        const [x, y] = sample(t);
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 < bestD2) { bestD2 = d2; bestSeg = i; bestT = t; }
      }
    }
    // Refine via bisection around bestT.
    {
      const i = bestSeg;
      const A = nodes[i].p, B = nodes[i + 1].p;
      const C1 = useBezier ? (nodes[i].cpOut ?? A) : A;
      const C2 = useBezier ? (nodes[i + 1].cpIn ?? B) : B;
      const sample = (t) => {
        if (!useBezier) return lerp(A, B, t);
        const Q0 = lerp(A, C1, t), Q1 = lerp(C1, C2, t), Q2 = lerp(C2, B, t);
        const R0 = lerp(Q0, Q1, t), R1 = lerp(Q1, Q2, t);
        return lerp(R0, R1, t);
      };
      let lo = Math.max(0, bestT - 1 / 32);
      let hi = Math.min(1, bestT + 1 / 32);
      for (let k = 0; k < 12; k++) {
        const m1 = lo + (hi - lo) / 3;
        const m2 = hi - (hi - lo) / 3;
        const [x1, y1] = sample(m1), [x2, y2] = sample(m2);
        const d1 = (x1 - cx) ** 2 + (y1 - cy) ** 2;
        const d2 = (x2 - cx) ** 2 + (y2 - cy) ** 2;
        if (d1 < d2) hi = m2; else lo = m1;
      }
      bestT = (lo + hi) / 2;
    }

    const i = bestSeg, t = bestT;
    const A = nodes[i].p, B = nodes[i + 1].p;
    let newNode;
    let beforeUpdate = null, afterUpdate = null;
    if (useBezier) {
      const C1 = nodes[i].cpOut ?? A;
      const C2 = nodes[i + 1].cpIn ?? B;
      const Q0 = lerp(A, C1, t);
      const Q1 = lerp(C1, C2, t);
      const Q2 = lerp(C2, B, t);
      const R0 = lerp(Q0, Q1, t);
      const R1 = lerp(Q1, Q2, t);
      const S  = lerp(R0, R1, t);
      const round2 = (p) => [Math.round(p[0]), Math.round(p[1])];
      newNode = { p: round2(S), cpIn: round2(R0), cpOut: round2(R1) };
      beforeUpdate = { cpOut: round2(Q0) };
      afterUpdate  = { cpIn:  round2(Q2) };
    } else {
      newNode = { p: [Math.round(cx), Math.round(cy)] };
    }
    ctx?.addPathNode?.(pin, i + 1, newNode, { before: beforeUpdate, after: afterUpdate });
    selectedNodeIndex = i + 1;
  }

  /** Translate mouse delta into image pixels and push the new position
   * of a path node anchor / control point to the editor. */
  function applyPathDrag(e) {
    if (!pathDragging || !map) return;
    const pin = pins.find(p => p.id === pathDragging.pinId);
    if (!pin) return;
    const scale = map.options.crs.scale(map.getZoom());
    const dxRaw = (e.clientX - pathDragging.startX);
    const dyRaw = (e.clientY - pathDragging.startY);
    // Treat tiny mouse jitter as a click, not a drag — that's how
    // mouseup distinguishes select-node from move-node.
    if (!pathDragging.moved && Math.hypot(dxRaw, dyRaw) > 2) {
      pathDragging.moved = true;
    }
    if (!pathDragging.moved) return;
    const dx = dxRaw / scale;
    const dy = dyRaw / scale;
    const x = Math.round(pathDragging.origX + dx);
    const y = Math.round(pathDragging.origY + dy);
    if (pathDragging.which === 'move') {
      ctx?.updatePos?.(pin, x, y);
    } else {
      ctx?.updatePathPoint?.(pin, pathDragging.role, pathDragging.idx, x, y);
    }
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
            // Alignment defines where (x, y) sits within the box;
            // applyResize uses it to keep the unmoved edges fixed.
            align: pin.align || 'center',
            valign: pin.valign || 'middle',
          };
          return;
        }
      }
      // Path endpoint / bezier control-point / whole-curve move drag
      const pathHandle = e.target.closest('.path-handle');
      if (pathHandle && e.button === 0) {
        const pinId = pathHandle.dataset.pinId;
        const pin = pins.find(p => p.id === pinId);
        const which = pathHandle.dataset.pathHandle;
        if (pin && which) {
          // `which` is one of: 'move', 'p:<i>', 'cpIn:<i>', 'cpOut:<i>'.
          // Capture the original image-space position so applyPathDrag
          // can compute cumulative deltas without drift.
          let role = which, idx = -1;
          if (which !== 'move') {
            const colon = which.indexOf(':');
            role = which.slice(0, colon);
            idx = Number(which.slice(colon + 1));
          }
          let orig;
          if (which === 'move') {
            orig = pin.nodes?.[0]?.p ?? [pin.x, pin.y];
          } else {
            const node = pin.nodes?.[idx];
            orig = (node && node[role]) || node?.p || [pin.x, pin.y];
          }
          e.preventDefault();
          e.stopPropagation();
          pathDragging = {
            pinId,
            which,
            role,
            idx,
            startX: e.clientX,
            startY: e.clientY,
            origX: orig[0],
            origY: orig[1],
            moved: false,
          };
          // Hide the cursor while the drag is in flight — the handle is
          // pinned to the mouse so the cursor glyph just adds clutter.
          container.classList.add('path-dragging');
          return;
        }
      }
      // Cmd/Ctrl-click anywhere on a selected path's body adds a node
      // at the click position. We accept hits on the invisible
      // `.path-hit` thick stroke OR on the rendered text glyphs (since
      // the text overlays the curve along its full length).
      if (e.button === 0 && (e.metaKey || e.ctrlKey)) {
        const pathContainer = e.target.closest('.map-path.selected');
        if (pathContainer) {
          const pinId = pathContainer.dataset.pinId;
          const pin = pins.find(p => p.id === pinId);
          if (pin?.kind === 'path') {
            e.preventDefault();
            e.stopPropagation();
            insertNodeAtClick(pin, e);
            return;
          }
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
        // No movement → treat as a click. Clicking an endpoint handle
        // selects that node (Delete then removes it). Other roles fall
        // through with no extra action.
        if (!pathDragging.moved && pathDragging.role === 'p') {
          selectedNodeIndex = pathDragging.idx;
        } else {
          ctx?.commit?.();
        }
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

  // Toggle marker drag/interact when `selectable` or selection changes.
  // Non-selectable tools (e.g. marker tool) still let the user nudge the
  // currently-selected marker — handy right after dropping a pin.
  // Path markers are never body-draggable: Leaflet creates `dragging`
  // regardless of the construction flag, so we keep it explicitly
  // disabled here. Translation happens through the dedicated
  // `.path-move` handle.
  $effect(() => {
    const canSelect = selectable && editable;
    const sel = selectedId;
    for (const [id, marker] of markerMap) {
      const pin = pins.find(p => p.id === id);
      const isPath = pin?.kind === 'path';
      const live = canSelect || (editable && id === sel);
      if (isPath) {
        marker.dragging?.disable();
      } else if (live) {
        marker.dragging?.enable();
      } else {
        marker.dragging?.disable();
      }
      const el = marker.getElement();
      if (el) el.style.pointerEvents = (live || (editable && isPath)) ? '' : 'none';
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

    rebuildGrid();
    setupGridToggleControl();
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
      // Grid stroke width is keyed to the current zoom (min 1) — refresh
      // the path on zoom changes without rebuilding the geometry.
      const path = gridLayer?.getElement()?.querySelector('path');
      if (path) path.setAttribute('stroke-width', String(Math.max(1, z)));
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

    // Delete-key removes the selected intermediate node from the
    // active path. Endpoints are protected by the editor's
    // removePathNode guard.
    if (editable) {
      window.addEventListener('keydown', onDeleteKey);
    }
  });

  function onDeleteKey(e) {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (selectedNodeIndex == null || !selectedId) return;
    const target = e.target;
    if (target && target.matches?.('input, textarea, [contenteditable="true"]')) return;
    const pin = pins.find(p => p.id === selectedId);
    if (!pin || pin.kind !== 'path') return;
    e.preventDefault();
    ctx?.removePathNode?.(pin, selectedNodeIndex);
    selectedNodeIndex = null;
    // Leaflet marker icons get tabindex=0 for keyboard accessibility,
    // so after a keyboard delete the icon retains focus and the
    // browser draws its default outline around the whole marker.
    // Drop focus so the outline disappears.
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }

  onDestroy(() => {
    window.removeEventListener('keydown', onDeleteKey);
    if (map) { map.remove(); map = null; }
  });
</script>

{@html MARKER_SPRITE}
<div class="map-container" bind:this={mapEl} style={haloStyle}></div>

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
