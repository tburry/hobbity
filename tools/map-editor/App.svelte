<script>
  import MapViewer from '../../src/components/map/MapViewer.svelte';

  let maps = $state([]);
  let currentMap = $state(null);
  let pins = $state([]);
  let labelsVisible = $state(false);
  let viewer = $state();
  let viewInfo = $state({ zoom: 0, x: 0, y: 0 });
  let wheelInfo = $state({ deltaX: 0, deltaY: 0, ctrlKey: false, trackpad: false });

  // Editor state
  let editing = $state(false);
  let editingId = $state(null);
  let previewId = $state(null);
  let dialogTitle = $state('New Pin');
  let pinNumber = $state(1);
  let pinName = $state('');
  let pinDesc = $state('');
  let pinLink = $state('');
  let pinFont = $state('body');
  let pinSize = $state('md');
  let pinBold = $state(false);
  let pinItalic = $state(false);
  let pinRotate = $state(0);
  let pinFixed = $state(false);
  let showDelete = $state(false);

  // --- API ---
  async function fetchPins(slug) {
    const resp = await fetch(`/api/pins/${slug}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    // Assign runtime IDs (stripped on save for clean JSON)
    return data.map(p => ({ ...p, id: p.id || crypto.randomUUID() }));
  }

  function pinsForSave() {
    return [...pins]
      .sort((a, b) => a.x - b.x || a.y - b.y)
      .map(({ id, ...rest }) => {
        const out = { number: rest.number, name: rest.name, x: rest.x, y: rest.y };
        // Only include non-default style fields
        if (rest.font && rest.font !== 'body') out.font = rest.font;
        if (rest.size && rest.size !== 'md') out.size = rest.size;
        if (rest.bold) out.bold = true;
        if (rest.italic) out.italic = true;
        if (rest.rotate) out.rotate = rest.rotate;
        if (rest.fixed) out.fixed = true;
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

  // --- Pin actions ---
  function onMapClick(latlng) {
    // Create a preview pin immediately
    const id = crypto.randomUUID();
    previewId = id;
    editingId = id;
    // Default to next available number
    const usedNums = pins.map(p => p.number).filter(Boolean);
    let next = 1;
    while (usedNums.includes(next)) next++;
    pinNumber = next;
    pinName = '';
    pinDesc = '';
    pinLink = '';
    pinFont = 'body';
    pinSize = 'md';
    pinBold = false;
    pinItalic = false;
    pinRotate = 0;
    pinFixed = false;
    showDelete = false;
    dialogTitle = 'New Pin';

    pins = [...pins, {
      id,
      number: pinNumber,
      name: '(new pin)',
      font: pinFont,
      size: pinSize,
      bold: pinBold,
      italic: pinItalic,
      rotate: pinRotate,
      fixed: pinFixed,
      x: Math.round(latlng.lng),
      y: Math.round(latlng.lat),
    }];
    editing = true;
  }

  function onPinClick(pin) {
    editingId = pin.id;
    previewId = null;
    dialogTitle = 'Edit Pin';
    pinNumber = pin.number ?? 1;
    pinName = pin.name;
    pinDesc = pin.description || '';
    pinLink = pin.link || '';
    pinFont = pin.font || 'body';
    pinSize = pin.size || 'md';
    pinBold = pin.bold || false;
    pinItalic = pin.italic || false;
    pinRotate = pin.rotate || 0;
    pinFixed = pin.fixed || false;
    showDelete = true;
    editing = true;
  }

  function onPinDrag(pin, x, y) {
    pin.x = x;
    pin.y = y;
    pins = pins;
    savePins();
  }

  // Update the preview/editing pin live as form fields change
  $effect(() => {
    if (!editingId) return;
    const pin = pins.find(p => p.id === editingId);
    if (!pin) return;
    const name = pinName.trim() || '(new pin)';
    const num = pinNumber;
    const font = pinFont;
    const size = pinSize;
    const bold = pinBold;
    const italic = pinItalic;
    const rotate = pinRotate;
    const fixed = pinFixed;
    const desc = pinDesc.trim() || undefined;
    const link = pinLink.trim() || undefined;
    if (pin.name !== name || pin.number !== num || pin.font !== font || pin.size !== size || pin.bold !== bold || pin.italic !== italic || pin.rotate !== rotate || pin.fixed !== fixed || pin.description !== desc || pin.link !== link) {
      pin.name = name;
      pin.number = num;
      pin.font = font;
      pin.size = size;
      pin.bold = bold;
      pin.italic = italic;
      pin.rotate = rotate;
      pin.fixed = fixed;
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
  <span class="view-info">z{viewInfo.zoom.toFixed(1)} ({viewInfo.x}, {viewInfo.y}) dX={wheelInfo.deltaX.toFixed(1)} dY={wheelInfo.deltaY.toFixed(1)} ctrl={wheelInfo.ctrlKey} {wheelInfo.trackpad ? 'trackpad' : 'mouse'}</span>
  <p>Click to place. Drag to move. Click pin to edit.</p>
</header>

<div class="layout">
  <div class="map-wrapper" class:labels-visible={labelsVisible}>
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
        onpinclick={onPinClick}
        onmapclick={onMapClick}
        onpindrag={onPinDrag}
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
          <label>
            Pin
            <div class="number-grid">
              <button
                type="button"
                class="none-btn"
                class:selected={pinNumber === 0}
                onclick={() => pinNumber = 0}
              >—</button>
              {#each Array.from({length: 20}, (_, i) => i + 1) as n}
                <button
                  type="button"
                  class:selected={pinNumber === n}
                  onclick={() => pinNumber = n}
                >{n}</button>
              {/each}
            </div>
          </label>
          <label>Name <input type="text" bind:value={pinName} required autocomplete="off" /></label>
          <div class="style-row">
            <label class="inline">
              Font
              <select bind:value={pinFont}>
                <option value="body">Lora</option>
                <option value="heading">Crimson Pro</option>
                <option value="title">Uncial Antiqua</option>
              </select>
            </label>
            <label class="inline">
              Size
              <select bind:value={pinSize}>
                <option value="sm">S</option>
                <option value="md">M</option>
                <option value="lg">L</option>
              </select>
            </label>
          </div>
          <div class="style-row">
            <button type="button" class="toggle" class:active={pinBold} onclick={() => pinBold = !pinBold}><b>B</b></button>
            <button type="button" class="toggle" class:active={pinItalic} onclick={() => pinItalic = !pinItalic}><i>I</i></button>
            {#if pinNumber === 0}
              <label class="inline rotate">
                Rotate
                <input type="number" bind:value={pinRotate} min="-180" max="180" step="5" />
                <span>°</span>
              </label>
              <button type="button" class="toggle" class:active={pinFixed} onclick={() => pinFixed = !pinFixed} title="Scale with map zoom">🔍</button>
            {/if}
          </div>
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
      <button class:active={labelsVisible} onclick={toggleLabels}>
        {labelsVisible ? 'Hide Labels' : 'Show Labels'}
      </button>
      <button onclick={copyJson}>Copy JSON</button>
      <button class="danger" onclick={clearAll}>Clear All</button>
    </div>
  </div>
</div>

<style>
  :global(*) { box-sizing: border-box; }
  :global(body) {
    font-family: 'Lora', serif;
    background: #1e1610;
    color: #d4c4a8;
    height: 100vh;
    margin: 0;
  }
  :global(#app) {
    height: 100vh;
    display: flex;
    flex-direction: column;
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
  .view-info { font-size: 0.8rem; opacity: 0.5; font-variant-numeric: tabular-nums; }
  header p { font-style: italic; opacity: 0.6; font-size: 0.85rem; margin-left: auto; }

  .layout { flex: 1; display: flex; overflow: hidden; min-height: 0; }
  .map-wrapper { flex: 1; min-width: 0; position: relative; }

  .sidebar {
    width: 280px;
    display: flex;
    flex-direction: column;
    border-left: 1px solid #5c4a32;
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
  .number-grid { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 0.25rem; }
  .number-grid button {
    width: 28px;
    height: 28px;
    font: 700 12px/1 'Crimson Pro', serif;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #c9a96e;
    border-radius: 50%;
    background: #fff;
    color: #3b2e1e;
    cursor: pointer;
  }
  .number-grid button:hover { background: #f3ece0; }
  .number-grid button.selected { background: #c9a96e; color: #fff; }
  .number-grid .none-btn { border-radius: 3px; font-size: 14px; }

  .style-row {
    display: flex;
    gap: 0.5rem;
    align-items: end;
    margin-bottom: 0.6rem;
  }
  .style-row select {
    display: block;
    width: 100%;
    margin-top: 0.2rem;
    padding: 0.3rem;
    border: 1px solid #5c4a32;
    background: #2a1f14;
    color: inherit;
    border-radius: 3px;
    font: inherit;
    font-size: 0.85rem;
  }
  label.inline { font-size: 0.85rem; flex: 1; }
  label.rotate { display: flex; align-items: center; gap: 0.3rem; flex: none; }
  label.rotate input { width: 60px; margin-top: 0; padding: 0.3rem; text-align: center; }
  .toggle {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
  }
  .dialog-buttons { display: flex; gap: 0.5rem; margin-top: 1rem; }

</style>
