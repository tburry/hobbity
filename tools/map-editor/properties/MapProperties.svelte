<script>
  let {
    title = $bindable(),
    description = $bindable(),
    halo = $bindable(),
    labelScale = $bindable(),
    markerLabelScale = $bindable(),
  } = $props();

  const DEFAULT_HALO = '#faf6f0';

  function resetHalo() {
    halo = '';
  }

  // Clamp a scale input to a sane range; treat empty / non-numeric as
  // "use default" by setting the bindable to undefined (strip-empty
  // pass drops it from the saved JSON).
  function clampScale(v) {
    if (v === '' || v == null) return undefined;
    const n = Number(v);
    if (Number.isNaN(n)) return undefined;
    return Math.max(0.1, Math.min(5, n));
  }
</script>

<label>
  Title
  <input type="text" bind:value={title} autocomplete="off" />
</label>

<label>
  Description
  <textarea bind:value={description} rows="8"></textarea>
</label>

<label class="halo-row">
  Halo color
  <div class="halo-controls">
    <input
      type="color"
      value={halo || DEFAULT_HALO}
      oninput={(e) => halo = e.currentTarget.value}
    />
    <input
      type="text"
      value={halo || ''}
      placeholder={DEFAULT_HALO}
      oninput={(e) => halo = e.currentTarget.value}
      autocomplete="off"
    />
    <button type="button" class="halo-reset" onclick={resetHalo} title="Reset to default">×</button>
  </div>
</label>

<fieldset class="scale-fieldset">
  <legend>Label scale</legend>
  <p class="scale-hint">Multiplies font size for text and path labels (default 1).</p>
  <div class="scale-row">
    <label class="scale-label">
      Text / Path
      <div class="scale-controls">
        <input
          type="range"
          min="0.25"
          max="2"
          step="0.05"
          value={labelScale ?? 1}
          oninput={(e) => labelScale = clampScale(e.currentTarget.valueAsNumber)}
        />
        <input
          class="scale-num"
          type="number"
          min="0.1"
          max="5"
          step="0.05"
          value={(labelScale ?? 1).toFixed(2)}
          oninput={(e) => labelScale = clampScale(e.currentTarget.value)}
        />
      </div>
    </label>
    <label class="scale-label">
      Markers
      <div class="scale-controls">
        <input
          type="range"
          min="0.25"
          max="2"
          step="0.05"
          value={markerLabelScale ?? 1}
          oninput={(e) => markerLabelScale = clampScale(e.currentTarget.valueAsNumber)}
        />
        <input
          class="scale-num"
          type="number"
          min="0.1"
          max="5"
          step="0.05"
          value={(markerLabelScale ?? 1).toFixed(2)}
          oninput={(e) => markerLabelScale = clampScale(e.currentTarget.value)}
        />
      </div>
    </label>
  </div>
</fieldset>

<style>
  label { display: block; margin-bottom: 0.6rem; font-size: 0.85rem; }
  label input, label textarea {
    display: block;
    width: 100%;
    margin-top: 0.2rem;
    padding: 0.4rem;
    border: 1px solid var(--panel-border, #5c4a32);
    background: #fff;
    color: inherit;
    border-radius: 3px;
    font: inherit;
  }

  .halo-controls {
    display: flex;
    gap: 0.3rem;
    margin-top: 0.2rem;
    align-items: stretch;
  }
  .halo-controls input[type="color"] {
    width: 40px;
    min-width: 40px;
    padding: 2px;
    margin: 0;
    cursor: pointer;
  }
  .halo-controls input[type="text"] {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--mono-font, monospace);
  }
  .halo-reset {
    flex: 0 0 auto;
    width: 30px;
    padding: 0;
    border: 1px solid var(--panel-border, #5c4a32);
    background: transparent;
    color: inherit;
    border-radius: 3px;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
  }
  .halo-reset:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }

  .scale-fieldset {
    border: 1px solid var(--panel-border, #5c4a32);
    border-radius: 3px;
    padding: 0.4rem 0.6rem 0.6rem;
    margin: 0 0 0.6rem;
    font-size: 0.85rem;
  }
  .scale-fieldset legend {
    font: 700 0.8rem/1 'Crimson Pro', serif;
    padding: 0 0.3rem;
  }
  .scale-hint {
    margin: 0 0 0.4rem;
    font-size: 0.75rem;
    opacity: 0.75;
    font-style: italic;
  }
  .scale-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .scale-label { margin: 0; }
  .scale-controls {
    display: flex;
    gap: 0.3rem;
    margin-top: 0.2rem;
    align-items: center;
  }
  .scale-controls input[type="range"] {
    flex: 1;
    min-width: 0;
    margin: 0;
  }
  .scale-num {
    flex: 0 0 auto;
    width: 3.6rem;
    margin: 0;
  }
</style>
