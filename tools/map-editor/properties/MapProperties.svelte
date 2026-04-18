<script>
  let {
    title = $bindable(),
    description = $bindable(),
    halo = $bindable(),
  } = $props();

  const DEFAULT_HALO = '#faf6f0';

  function resetHalo() {
    halo = '';
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
</style>
