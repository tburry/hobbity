<script>
  import MapViewer from '../../src/components/map/MapViewer.svelte';
  import { TOOL_LIST, TOOLS, DEFAULT_MARKER_MIN_ZOOM, findPreset } from '../../src/components/map/tools.js';

  /** Bucket a pin for the sidebar list:
   *   0 = numbered marker, 1 = overworld glyph marker, 2 = text / freeform.
   * Numbered markers lead, overworld follow, text features last. Within
   * each bucket the natural-sort key is `number` for bucket 0 and
   * `name` for the others. */
  function markerBucket(pin) {
    // Class first: overworld markers belong in their own bucket even
    // if someone set a number on them.
    const preset = findPreset(pin.class);
    if (preset?.category === 'overworld') return 1;
    if (pin.number) return 0;
    return 2;
  }
  const listMarkers = $derived([...pins].sort((a, b) => {
    const ba = markerBucket(a);
    const bb = markerBucket(b);
    if (ba !== bb) return ba - bb;
    const key = ba === 0 ? 'number' : 'name';
    return natCollator.compare(String(a[key] || ''), String(b[key] || ''));
  }));

  /** Derive Tailwind-style utility classes from a marker's preset so the
   * sidebar row visually matches how the label renders on the map.
   * (Typography only — layout/spacing stays the sidebar's own.) */
  function markerClasses(pin) {
    const d = findPreset(pin.class)?.defaults || {};
    const out = [];
    if (d.font === 'body') out.push('font-body');
    else if (d.font === 'heading') out.push('font-heading');
    else if (d.font === 'title') out.push('font-title');
    const w = d.weight ?? (d.bold ? 700 : 400);
    if (w >= 700) out.push('font-bold');
    else if (w >= 600) out.push('font-semibold');
    else if (w >= 500) out.push('font-medium');
    else out.push('font-normal');
    if (d.italic) out.push('italic');
    if (d.case === 'upper') out.push('uppercase');
    else if (d.case === 'title') out.push('capitalize');
    out.push(d.colorClass || 'text-black');
    return out.join(' ');
  }
  import PinProperties from './properties/PinProperties.svelte';
  import TextProperties from './properties/TextProperties.svelte';

  let maps = $state([]);
  let currentMap = $state(null);
  let pins = $state([]);
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
  let previewId = $state(null);
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
  let pinShrink = $state(false);

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

  function applyPreset(presetId) {
    // For text features, the class fully drives font/size/case/letterSpacing
    // via TEXT_PRESETS. No need to copy fields onto the pin.
    pinClass = presetId;
  }

  // --- API ---
  async function fetchPins(slug) {
    const resp = await fetch(`/api/pins/${slug}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    // Assign runtime IDs (stripped on save for clean JSON)
    return data.map(p => ({
      ...p,
      id: p.id || crypto.randomUUID(),
      number: p.number ? String(p.number) : '',
    }));
  }

  const natCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  function pinsForSave() {
    return [...pins]
      .sort((a, b) => {
        // Empty/no-pin entries go last
        const aEmpty = !a.number;
        const bEmpty = !b.number;
        if (aEmpty && !bEmpty) return 1;
        if (!aEmpty && bEmpty) return -1;
        if (aEmpty && bEmpty) return a.x - b.x || a.y - b.y;
        return natCollator.compare(a.number, b.number);
      })
      .map(({ id, ...rest }) => {
        const kind = rest.kind || (rest.number ? 'pin' : 'text');
        const out = { kind, number: rest.number || '', name: rest.name, x: rest.x, y: rest.y };
        // Both kinds derive styling entirely from `class`.
        if (rest.class) out.class = rest.class;
        if (kind === 'text') {
          if (rest.width) out.width = rest.width;
          if (rest.height) out.height = rest.height;
          if (rest.align && rest.align !== 'center') out.align = rest.align;
          if (rest.valign && rest.valign !== 'middle') out.valign = rest.valign;
          if (rest.minZoom != null && rest.minZoom !== 1) out.minZoom = rest.minZoom;
        } else {
          if (rest.minZoom != null && rest.minZoom !== DEFAULT_MARKER_MIN_ZOOM) out.minZoom = rest.minZoom;
        }
        if (rest.shrink) out.shrink = true;
        if (rest.description) out.description = rest.description;
        if (rest.link) out.link = rest.link;
        return out;
      });
  }

  async function savePins() {
    if (!currentMap) return;
    await fetch(`/api/pins/${currentMap.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pinsForSave(), null, 2),
    });
  }

  async function selectMap(mapInfo) {
    currentMap = mapInfo;
    localStorage.setItem('map-editor:last-map', mapInfo.slug);
    pins = await fetchPins(mapInfo.slug);
  }

  function onMapSelect(e) {
    const m = maps.find(m => m.slug === e.target.value);
    if (m) selectMap(m);
  }

  // --- Pin actions (called by tools via ctx) ---
  /** Generic "create a feature" — tool passes the kind and shape fields */
  function createFeature(data) {
    const id = crypto.randomUUID();
    const kind = data.kind || 'pin';
    previewId = id;
    editingId = id;
    pinKind = kind;
    pinName = '';
    pinDesc = '';
    pinLink = '';
    pinAlign = 'center';
    pinValign = 'middle';
    pinWidth = data.width || 0;
    pinHeight = data.height || 0;
    pinShrink = false;
    pinLabelPos = 'n';

    if (kind === 'pin') {
      const usedNums = new Set(pins.filter(p => (p.kind || 'pin') === 'pin').map(p => p.number).filter(Boolean));
      let next = 1;
      while (usedNums.has(String(next))) next++;
      pinNumber = String(next);
      pinClass = 'landmark';
      pinMinZoom = DEFAULT_MARKER_MIN_ZOOM;
      dialogTitle = 'New Marker';
    } else if (kind === 'text') {
      pinNumber = '';
      pinClass = 'civic-space';
      pinMinZoom = 1;
      dialogTitle = 'New Text';
    } else {
      pinNumber = '';
      pinClass = '';
      pinMinZoom = 0;
      dialogTitle = 'New';
    }

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
      x: data.x,
      y: data.y,
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
    deselect: () => {
      if (!editingId) return;
      // Cancel any new-feature preview; close the editor for existing selections
      if (previewId) {
        pins = pins.filter(p => p.id !== previewId);
        previewId = null;
      }
      editingId = null;
      activeTab = 'markers';
    },
  };

  function editFeature(pin) {
    editingId = pin.id;
    previewId = null;
    // Determine kind from stored field or infer from number presence
    pinKind = pin.kind || (pin.number ? 'pin' : 'text');
    dialogTitle = pinKind === 'pin' ? 'Edit Marker' : pinKind === 'text' ? 'Edit Text' : 'Edit Path';
    pinNumber = pin.number != null ? String(pin.number) : '';
    pinName = pin.name;
    pinDesc = pin.description || '';
    pinLink = pin.link || '';
    pinClass = pin.class || (pinKind === 'pin' ? 'shop' : 'civic-space');
    pinAlign = pin.align || 'center';
    pinValign = pin.valign || 'middle';
    pinWidth = pin.width || 0;
    pinHeight = pin.height || 0;
    pinMinZoom = pin.minZoom ?? (pinKind === 'pin' ? DEFAULT_MARKER_MIN_ZOOM : 1);
    pinShrink = !!pin.shrink;
    pinLabelPos = pin.labelPos || 'n';
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
    const desc = pinDesc.trim() || undefined;
    const link = pinLink.trim() || undefined;
    if (pin.name !== name || pin.number !== num || pin.kind !== kind || pin.class !== cls || pin.align !== align || pin.valign !== valign || pin.width !== w || pin.height !== h || pin.x !== x || pin.y !== y || pin.minZoom !== mz || pin.shrink !== sh || pin.labelPos !== lp || pin.description !== desc || pin.link !== link) {
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
    previewId = null;
    editingId = null;
    activeTab = 'markers';
    savePins();
  }

  /** Close the editor without deleting the feature. Auto-saved changes stay. */
  function closeEditor() {
    previewId = null;
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
  <h1>Map Marker Editor</h1>
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/></svg>
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
        editable={mode === 'edit'}
        tool={mode === 'edit' ? TOOLS[toolMode] : null}
        ctx={editorCtx}
        selectedId={editingId}
        onviewchange={(v) => viewInfo = v}
        onwheel={(w) => wheelInfo = w}
      />
    {/if}
  </div>
  {#if mode === 'edit'}
  <div class="sidebar">
    <div class="tabs">
      <button class:active={activeTab === 'markers'} onclick={() => activeTab = 'markers'}>Markers</button>
      <button
        class:active={activeTab === 'editor'}
        disabled={!editingId}
        onclick={() => { if (editingId) activeTab = 'editor'; }}
      >{editingId ? dialogTitle : 'Editor'}</button>
    </div>
    {#if activeTab === 'editor' && editingId}
      <div class="pin-editor">
        <form onsubmit={(e) => { e.preventDefault(); closeEditor(); }}>
          {#if pinKind === 'pin'}
            <PinProperties
              bind:number={pinNumber}
              bind:cls={pinClass}
              bind:minZoom={pinMinZoom}
              bind:shrink={pinShrink}
              bind:labelPos={pinLabelPos}
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
          {/if}
          <label>Label <input type="text" bind:value={pinName} required autocomplete="off" /></label>
          <label>Description <textarea bind:value={pinDesc} rows="2"></textarea></label>
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
                {:else if pin.number}
                  <span class="pin-num">{pin.number}</span>
                {:else}
                  <span class="pin-label-icon">Aa</span>
                {/if}
                <strong class={markerClasses(pin)}>{pin.name}</strong>
                <span class="pin-coords">({pin.x}, {pin.y})</span>
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
  header h1 { font-family: var(--heading-font); font-size: 1rem; margin: 0; }
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
    opacity: 0.6;
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
  .sidebar .tabs button:hover:not(:disabled) { opacity: 0.85; background: var(--panel-hover); }
  .sidebar .tabs button.active { opacity: 1; background: var(--panel-accent); color: var(--accent-text); border-color: var(--panel-accent); }
  .sidebar .tabs button:disabled { opacity: 0.3; cursor: not-allowed; }

  .pin-list { list-style: none; padding: 0; margin: 0; flex: 1; overflow-y: auto; }
  .pin-row {
    display: flex;
    align-items: stretch;
    margin: 0 0.375rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }
  .pin-list li:last-child .pin-row { border-bottom: none; }
  .sidebar .pin-list-btn {
    flex: 1;
    min-width: 0;
    text-align: left;
    padding: 0.35rem 0;
    font-size: 0.85rem;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    border-radius: 0;
  }
  .sidebar .pin-row:hover { background: var(--panel-hover); }
  .sidebar .pin-list-edit {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
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
  .pin-coords { opacity: 0.5; font-size: 0.8em; }

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
    width: 30px;
    height: 30px;
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
