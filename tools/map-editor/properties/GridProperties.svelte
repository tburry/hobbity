<script>
  let { grid = $bindable() } = $props();

  const DEFAULT_GRID_COLOR = 'rgba(60, 40, 20, 0.35)';

  function parseRgba(str) {
    const fallback = { hex: '#3c2814', alpha: 0.35 };
    if (!str) return fallback;
    const m = String(str).match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
    if (!m) return fallback;
    const r = Math.max(0, Math.min(255, parseInt(m[1], 10)));
    const g = Math.max(0, Math.min(255, parseInt(m[2], 10)));
    const b = Math.max(0, Math.min(255, parseInt(m[3], 10)));
    const a = m[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(m[4]))) : 1;
    const hex = '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
    return { hex, alpha: a };
  }

  function composeRgba(hex, alpha) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return DEFAULT_GRID_COLOR;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const a = Math.max(0, Math.min(1, Number(alpha)));
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
  }

  function ensureGrid() {
    if (!grid) {
      grid = {
        shape: 'square',
        size: 100,
        originX: 0,
        originY: 0,
        color: DEFAULT_GRID_COLOR,
      };
    }
  }

  function setShape(shape) {
    if (shape === 'none') {
      grid = undefined;
      return;
    }
    ensureGrid();
    grid = { ...grid, shape };
  }

  function updateGrid(patch) {
    ensureGrid();
    grid = { ...grid, ...patch };
  }
</script>

<div class="grid-shape" role="radiogroup" aria-label="Grid shape">
  {#each [
    { id: 'none', label: 'None' },
    { id: 'square', label: 'Square' },
    { id: 'hex-pointy', label: 'Hex ⬢' },
    { id: 'hex-flat', label: 'Hex ⬣' },
  ] as opt}
    <button
      type="button"
      role="radio"
      aria-checked={(grid?.shape ?? 'none') === opt.id}
      class:active={(grid?.shape ?? 'none') === opt.id}
      onclick={() => setShape(opt.id)}
    >{opt.label}</button>
  {/each}
</div>

{#if grid?.shape && grid.shape !== 'none'}
  {@const parsed = parseRgba(grid.color || DEFAULT_GRID_COLOR)}
  <label class="grid-num">
    Size <span class="grid-hint">{grid.shape === 'square' ? '(px)' : '(centre→vertex)'}</span>
    <input
      type="number"
      min="1"
      step="1"
      value={grid.size ?? 100}
      oninput={(e) => updateGrid({ size: Math.max(1, Number(e.currentTarget.value) || 100) })}
    />
  </label>
  <p class="grid-origin-hint">
    Origin: ({grid.originX ?? 0}, {grid.originY ?? 0}) — drag the map with the grid tool active to move it.
  </p>
  <label class="grid-color-row">
    Color
    <div class="grid-color-controls">
      <input
        type="color"
        value={parsed.hex}
        oninput={(e) => updateGrid({ color: composeRgba(e.currentTarget.value, parsed.alpha) })}
      />
      <input
        class="grid-alpha"
        type="range"
        min="0"
        max="1"
        step="any"
        value={parsed.alpha}
        oninput={(e) => updateGrid({ color: composeRgba(parsed.hex, e.currentTarget.valueAsNumber) })}
        title="Opacity (0–1)"
      />
      <input
        class="grid-alpha-num"
        type="number"
        min="0"
        max="1"
        step="0.01"
        value={parsed.alpha.toFixed(2)}
        oninput={(e) => updateGrid({ color: composeRgba(parsed.hex, Math.max(0, Math.min(1, Number(e.currentTarget.value) || 0))) })}
      />
      <span class="grid-swatch" style="--swatch-color: {grid.color || DEFAULT_GRID_COLOR}"></span>
    </div>
  </label>
{/if}

<style>
  label { display: block; margin-bottom: 0.6rem; font-size: 0.85rem; }
  label input {
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

  .grid-shape {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    margin-bottom: 0.6rem;
  }
  .grid-shape button {
    padding: 0.4rem 0;
    font: 700 0.8rem/1 'Crimson Pro', serif;
    border: 1px solid var(--panel-border, #5c4a32);
    background: transparent;
    color: inherit;
    border-radius: 3px;
    cursor: pointer;
  }
  .grid-shape button:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }
  .grid-shape button.active { background: var(--panel-accent, #c9a96e); color: #fff; border-color: var(--panel-accent, #c9a96e); }

  .grid-num { display: block; margin-bottom: 0.4rem; }
  .grid-hint { font-weight: 400; opacity: 0.7; font-size: 0.75rem; }


  .grid-origin-hint {
    margin: 0 0 0.6rem 0;
    font-size: 0.78rem;
    line-height: 1.35;
    opacity: 0.75;
    font-style: italic;
  }

  .grid-color-row { display: block; margin: 0; }
  .grid-color-controls {
    display: flex;
    gap: 0.3rem;
    margin-top: 0.2rem;
    align-items: stretch;
  }
  .grid-color-controls input[type="color"] {
    width: 40px;
    min-width: 40px;
    padding: 2px;
    margin: 0;
    cursor: pointer;
  }
  .grid-alpha {
    flex: 1;
    min-width: 0;
    margin: 0;
    align-self: center;
  }
  .grid-alpha-num {
    flex: 0 0 auto;
    width: 3.5rem;
    margin: 0;
  }
  .grid-swatch {
    flex: 0 0 auto;
    width: 30px;
    border: 1px solid var(--panel-border, #5c4a32);
    border-radius: 3px;
    /* Color layer ON TOP of the checker so reduced alpha actually
       reveals the checker beneath, instead of showing the color through
       the checker's gaps. */
    background:
      linear-gradient(var(--swatch-color, transparent), var(--swatch-color, transparent)),
      linear-gradient(45deg, #ccc 25%, transparent 25%) 0 0 / 8px 8px,
      linear-gradient(-45deg, #ccc 25%, transparent 25%) 0 4px / 8px 8px,
      linear-gradient(45deg, transparent 75%, #ccc 75%) 4px -4px / 8px 8px,
      linear-gradient(-45deg, transparent 75%, #ccc 75%) -4px 0 / 8px 8px,
      #fff;
  }
</style>
