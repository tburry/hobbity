<script>
  import MapViewer from '../../src/components/map/MapViewer.svelte';
  import { TOOL_LIST, TOOLS } from '../../src/components/map/tools.js';
  import PinProperties from './properties/PinProperties.svelte';
  import TextProperties from './properties/TextProperties.svelte';

  let maps = $state([]);
  let currentMap = $state(null);
  let pins = $state([]);
  let labelsVisible = $state(localStorage.getItem('map-editor:labels-visible') === 'true');
  let viewer = $state();
  let viewInfo = $state({ zoom: 0, x: 0, y: 0 });
  let wheelInfo = $state({ deltaX: 0, deltaY: 0, ctrlKey: false, trackpad: false });

  // Editor state
  let editing = $state(false);
  let editingId = $state(null);
  let previewId = $state(null);
  let dialogTitle = $state('New Pin');
  let pinNumber = $state('1');
  let pinName = $state('');
  let pinLongName = $state('');
  let pinDesc = $state('');
  let pinLink = $state('');
  let pinKind = $state('pin');      // 'pin' | 'text' | 'path'
  let pinClass = $state('civic-space'); // typography preset (TEXT_PRESETS or PIN_PRESETS)
  let pinAlign = $state('center');  // 'left' | 'center' | 'right'
  let pinValign = $state('middle'); // 'top' | 'middle' | 'bottom'
  let pinWidth = $state(0);
  let pinHeight = $state(0);
  let pinMinZoom = $state(1);
  let showDelete = $state(false);

  // Active toolbox mode — determines what clicking the map does
  let toolMode = $state(localStorage.getItem('map-editor:tool') || 'select');

  function setToolMode(mode) {
    toolMode = mode;
    localStorage.setItem('map-editor:tool', mode);
  }

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
          if (rest.minZoom != null && rest.minZoom !== 0) out.minZoom = rest.minZoom;
        }
        if (rest.longName) out.longName = rest.longName;
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
    pinLongName = '';
    pinDesc = '';
    pinLink = '';
    pinAlign = 'center';
    pinValign = 'middle';
    pinWidth = data.width || 0;
    pinHeight = data.height || 0;
    showDelete = false;

    if (kind === 'pin') {
      const usedNums = new Set(pins.filter(p => (p.kind || 'pin') === 'pin').map(p => p.number).filter(Boolean));
      let next = 1;
      while (usedNums.has(String(next))) next++;
      pinNumber = String(next);
      pinClass = 'landmark';
      pinMinZoom = 0;
      dialogTitle = 'New Pin';
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
      x: data.x,
      y: data.y,
    }];
    editing = true;
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
      if (!editing) return;
      // Cancel any new-feature preview; close the editor for existing selections
      if (previewId) {
        pins = pins.filter(p => p.id !== previewId);
        previewId = null;
      }
      editingId = null;
      editing = false;
    },
  };

  function editFeature(pin) {
    editingId = pin.id;
    previewId = null;
    // Determine kind from stored field or infer from number presence
    pinKind = pin.kind || (pin.number ? 'pin' : 'text');
    dialogTitle = pinKind === 'pin' ? 'Edit Pin' : pinKind === 'text' ? 'Edit Text' : 'Edit Path';
    pinNumber = pin.number != null ? String(pin.number) : '';
    pinName = pin.name;
    pinLongName = pin.longName || '';
    pinDesc = pin.description || '';
    pinLink = pin.link || '';
    pinClass = pin.class || (pinKind === 'pin' ? 'landmark' : 'civic-space');
    pinAlign = pin.align || 'center';
    pinValign = pin.valign || 'middle';
    pinWidth = pin.width || 0;
    pinHeight = pin.height || 0;
    pinMinZoom = pin.minZoom ?? (pinKind === 'pin' ? 0 : 1);
    // Apply default size for text features that were created as point-labels
    if (pinKind === 'text' && (!pinWidth || !pinHeight)) {
      pinWidth = 300;
      pinHeight = 80;
    }
    showDelete = true;
    editing = true;
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
    const longName = pinLongName.trim() || undefined;
    const desc = pinDesc.trim() || undefined;
    const link = pinLink.trim() || undefined;
    if (pin.name !== name || pin.longName !== longName || pin.number !== num || pin.kind !== kind || pin.class !== cls || pin.align !== align || pin.valign !== valign || pin.width !== w || pin.height !== h || pin.x !== x || pin.y !== y || pin.minZoom !== mz || pin.description !== desc || pin.link !== link) {
      pin.name = name;
      pin.longName = longName;
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
      pin.description = desc;
      pin.link = link;
      viewer?.updateMarker(pin);
      pins = pins;
    }
  });

  function onSubmit(e) {
    e.preventDefault();
    if (!pinName.trim()) return;
    previewId = null;
    editingId = null;
    editing = false;
    savePins();
  }

  function onDelete() {
    if (!editingId) return;
    pins = pins.filter(p => p.id !== editingId);
    previewId = null;
    editingId = null;
    editing = false;
    savePins();
  }

  function onCancel() {
    // If cancelling a new pin, remove the preview
    if (previewId) {
      pins = pins.filter(p => p.id !== previewId);
      previewId = null;
    }
    editingId = null;
    editing = false;
  }

  function toggleLabels() {
    labelsVisible = !labelsVisible;
    localStorage.setItem('map-editor:labels-visible', String(labelsVisible));
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
  <h1>Map Pin Editor</h1>
  <select title="Select map" onchange={onMapSelect} value={currentMap?.slug}>
    {#each maps as m}
      <option value={m.slug}>{m.name}</option>
    {/each}
  </select>
  <button class="header-toggle" class:active={labelsVisible} onclick={toggleLabels}>
    {labelsVisible ? 'Hide Labels' : 'Show Labels'}
  </button>
</header>

<div class="layout">
  <div class="map-wrapper" class:labels-visible={labelsVisible}>
    <div class="toolbox">
      {#each TOOL_LIST as t}
        <button
          type="button"
          title={t.label}
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
        {labelsVisible}
        editable={true}
        tool={TOOLS[toolMode]}
        ctx={editorCtx}
        selectedId={editingId}
        onviewchange={(v) => viewInfo = v}
        onwheel={(w) => wheelInfo = w}
      />
    {/if}
  </div>
  <div class="sidebar">
    <div class="tabs">
      <button class:active={!editing} onclick={() => { if (editing) onCancel(); }}>Pins</button>
      <button class:active={editing}>{editing ? dialogTitle : 'Editor'}</button>
    </div>
    {#if editing}
      <div class="pin-editor">
        <form onsubmit={onSubmit}>
          {#if pinKind === 'pin'}
            <PinProperties
              bind:number={pinNumber}
              bind:cls={pinClass}
              bind:minZoom={pinMinZoom}
            />
          {:else if pinKind === 'text'}
            <TextProperties
              bind:preset={pinClass}
              bind:align={pinAlign}
              bind:valign={pinValign}
              bind:width={pinWidth}
              bind:height={pinHeight}
              bind:minZoom={pinMinZoom}
              onApplyPreset={applyPreset}
            />
          {/if}
          <label>Name <input type="text" bind:value={pinName} required autocomplete="off" /></label>
          {#if pinKind !== 'text'}
            <label>Longer Name <input type="text" bind:value={pinLongName} placeholder="(shown on hover)" autocomplete="off" /></label>
          {/if}
          <label>Description <textarea bind:value={pinDesc} rows="2"></textarea></label>
          <label>Link <input type="text" bind:value={pinLink} placeholder="/hobbity/world/places/#anchor" autocomplete="off" /></label>
          <div class="dialog-buttons">
            <button type="submit">{editingId && !previewId ? 'Update' : 'Save'}</button>
            {#if showDelete}
              <button type="button" class="danger" onclick={onDelete}>Delete</button>
            {/if}
            <button type="button" onclick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    {:else}
      <ul class="pin-list">
        {#each pins as pin}
          <li>
            <button class="pin-list-btn" onclick={() => clickPin(pin)}>
              {#if pin.number}
                <span class="pin-num">{pin.number}</span>
              {:else}
                <span class="pin-label-icon">Aa</span>
              {/if}
              <strong>{pin.name}</strong>
              <span class="pin-coords">({pin.x}, {pin.y})</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="actions">
      <button onclick={copyJson}>Copy JSON</button>
      <button class="danger" onclick={clearAll}>Clear All</button>
    </div>
  </div>
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
    font-family: 'Lora', serif;
    background: #1e1610;
    color: #d4c4a8;
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
    border-bottom: 1px solid #5c4a32;
  }
  header h1 { font-family: 'Crimson Pro', serif; font-size: 1rem; margin: 0; }
  header select {
    padding: 0.3rem 0.5rem;
    border: 1px solid #5c4a32;
    background: #2a1f14;
    color: inherit;
    border-radius: 3px;
    font: inherit;
    font-size: 0.85rem;
  }
  .status-bar {
    display: flex;
    gap: 1rem;
    padding: 0.25rem 0.75rem;
    border-top: 1px solid #5c4a32;
    font-size: 0.75rem;
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
    font-family: ui-monospace, monospace;
  }
  .status-bar span { white-space: nowrap; }
  .header-toggle { font-size: 0.85rem; }
  .header-toggle.active { background: #8b6914; }
  .header-toggle:disabled { opacity: 0.4; cursor: not-allowed; }
  .header-toggle:disabled:hover { background: #2a1f14; }

  .layout { flex: 1; display: flex; overflow: hidden; min-height: 0; }
  .map-wrapper { flex: 1; min-width: 0; min-height: 0; position: relative; }

  .sidebar {
    width: 280px;
    display: flex;
    flex-direction: column;
    border-left: 1px solid #5c4a32;
    min-height: 0;
    overflow: hidden;
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid #5c4a32;
  }
  .tabs button {
    flex: 1;
    padding: 0.5rem 0.75rem;
    font-family: 'Crimson Pro', serif;
    font-size: 0.9rem;
    font-weight: 700;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    color: inherit;
    opacity: 0.5;
    cursor: pointer;
    border-radius: 0;
  }
  .tabs button:hover { opacity: 0.8; background: none; }
  .tabs button.active { opacity: 1; border-bottom-color: #8b6914; }

  .pin-list { list-style: none; padding: 0; margin: 0; flex: 1; overflow-y: auto; }
  .pin-list li { border-bottom: 1px solid #3a2e20; }
  .pin-list-btn {
    width: 100%;
    text-align: left;
    padding: 0.35rem 0.75rem;
    font-size: 0.85rem;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    border-radius: 0;
  }
  .pin-list-btn:hover { background: rgba(255,255,255,0.05); }
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
  .pin-coords { opacity: 0.5; font-size: 0.8em; }

  .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.5rem 0.75rem; border-top: 1px solid #5c4a32; }
  .actions button { flex: 1; min-width: calc(50% - 0.25rem); }

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
    border: 1px solid #5c4a32;
    background: #2a1f14;
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
    background: #fff;
    border: 2px solid rgba(0,0,0,0.2);
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 1px 5px rgba(0,0,0,0.4);
  }
  .toolbox button {
    width: 30px;
    height: 30px;
    padding: 0;
    background: #fff;
    color: #333;
    border: none;
    border-bottom: 1px solid #ccc;
    border-radius: 0;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .toolbox button:last-child { border-bottom: none; }
  .toolbox button:hover { background: #f4f4f4; }
  .toolbox button.active { background: #c9a96e; color: #fff; }
  .toolbox svg { width: 18px; height: 18px; }

  .dialog-buttons { display: flex; gap: 0.5rem; margin-top: 1rem; }

</style>
