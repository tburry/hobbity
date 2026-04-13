<script>
  import { PIN_PRESETS, findPreset } from '../../../src/components/map/tools.js';

  let {
    number = $bindable(''),
    cls = $bindable('landmark'),
    minZoom = $bindable(0),
    shrink = $bindable(false),
  } = $props();

  const FONTS = {
    body: "'Lora', serif",
    heading: "'Crimson Pro', serif",
    title: "'Uncial Antiqua', serif",
  };

  // POI goes first and spans full width; the rest follow in order.
  const townPresets = (() => {
    const list = PIN_PRESETS.filter(p => p.category === 'town');
    const poi = list.find(p => p.id === 'poi');
    const rest = list.filter(p => p.id !== 'poi');
    return poi ? [poi, ...rest] : list;
  })();
  const overworldPresets = PIN_PRESETS.filter(p => p.category === 'overworld');

  // Active tab follows the currently-selected class.
  let tab = $state('town');
  $effect(() => {
    const p = findPreset(cls);
    if (p?.category) tab = p.category;
  });

  function setTab(t) {
    tab = t;
  }

  /** Inline CSS matching how this preset renders the label. */
  function styleFor(preset) {
    const d = preset.defaults || {};
    const parts = [
      `font-family: ${FONTS[d.font] || FONTS.body}`,
      `font-weight: ${d.bold ? 700 : 400}`,
      `font-style: ${d.italic ? 'italic' : 'normal'}`,
    ];
    if (d.color) parts.push(`color: ${d.color}`);
    else if (d.font === 'title') parts.push('color: var(--title-color, #7f003f)');
    if (d.case && d.case !== 'none') {
      parts.push(`text-transform: ${d.case === 'upper' ? 'uppercase' : d.case === 'lower' ? 'lowercase' : 'capitalize'}`);
    }
    if (d.letterSpacing) parts.push(`letter-spacing: ${d.letterSpacing}px`);
    return parts.join('; ');
  }
</script>

<div class="tabs" role="tablist">
  <button type="button" role="tab" aria-selected={tab === 'town'} class:active={tab === 'town'} onclick={() => setTab('town')}>Town</button>
  <button type="button" role="tab" aria-selected={tab === 'overworld'} class:active={tab === 'overworld'} onclick={() => setTab('overworld')}>Overworld</button>
</div>

{#if tab === 'town'}
  <div class="text-grid" role="radiogroup" aria-label="Marker type">
    {#each townPresets as p}
      <button
        type="button"
        role="radio"
        aria-checked={cls === p.id}
        class:active={cls === p.id}
        class:full={p.id === 'poi'}
        onclick={() => cls = p.id}
        style={styleFor(p)}
      >{p.label}</button>
    {/each}
  </div>
  <label>
    Pin #
    <input
      type="text"
      bind:value={number}
      placeholder="(no number)"
      autocomplete="off"
      maxlength="3"
    />
  </label>
{:else}
  <div class="icon-grid" role="radiogroup" aria-label="Marker type">
    {#each overworldPresets as p}
      <button
        type="button"
        role="radio"
        aria-checked={cls === p.id}
        class:active={cls === p.id}
        onclick={() => cls = p.id}
      >
        <span class="icon">{p.icon}</span>
        <span class="tt" style={styleFor(p)}>{p.label}</span>
      </button>
    {/each}
  </div>
{/if}

<label class="min-zoom-label">
  Min zoom
  <div class="zoom-row">
    <div class="zoom-group" role="radiogroup" aria-label="Minimum zoom level">
      {#each [0, 1, 2, 3, 4] as z}
        <button
          type="button"
          role="radio"
          aria-checked={minZoom === z}
          class:active={minZoom === z}
          onclick={() => minZoom = z}
        >{z}</button>
      {/each}
    </div>
    <button
      type="button"
      class="shrink-toggle"
      class:active={shrink}
      aria-pressed={shrink}
      title="Start at min size at min zoom and grow proportionally"
      onclick={() => shrink = !shrink}
    >Shrink</button>
  </div>
</label>

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

  .tabs {
    display: flex;
    gap: 2px;
    margin-bottom: 0.6rem;
    border-bottom: 1px solid var(--panel-border, #5c4a32);
  }
  .tabs button {
    flex: 1;
    padding: 0.4rem 0.6rem;
    font: 700 0.8rem/1 'Crimson Pro', serif;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    color: inherit;
    opacity: 0.5;
    cursor: pointer;
    border-radius: 0;
  }
  .tabs button:hover { opacity: 0.85; background: var(--panel-hover, rgba(0,0,0,0.06)); }
  .tabs button.active { opacity: 1; border-bottom-color: var(--panel-accent, #c9a96e); }

  .text-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    margin-bottom: 0.6rem;
  }
  .text-grid button {
    padding: 0.5rem 0.6rem;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    border: 1px solid var(--panel-border, #5c4a32);
    background: transparent;
    color: inherit;
    border-radius: 3px;
    cursor: pointer;
    min-height: 40px;
  }
  .text-grid button:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }
  .text-grid button.active { background: var(--panel-accent, #c9a96e); color: #fff; border-color: var(--panel-accent, #c9a96e); }
  .text-grid button.full { grid-column: 1 / -1; }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
    margin-bottom: 0.6rem;
  }
  .icon-grid button {
    position: relative;
    aspect-ratio: 1;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--panel-border, #5c4a32);
    background: transparent;
    color: inherit;
    border-radius: 3px;
    cursor: pointer;
  }
  .icon-grid button .icon { font-size: 20px; line-height: 1; }
  .icon-grid button:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }
  .icon-grid button.active { background: var(--panel-accent, #c9a96e); color: #fff; border-color: var(--panel-accent, #c9a96e); }

  /* HTML tooltip: renders the feature label in the class's font/style */
  .tt {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    padding: 0.3rem 0.6rem;
    background: #faf6f0;
    color: #3b2e1e;
    border: 1px solid #5c4a32;
    border-radius: 3px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.1s;
    z-index: 50;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }
  .icon-grid button:hover .tt,
  .icon-grid button:focus-visible .tt { opacity: 1; }

  .min-zoom-label { display: block; margin-bottom: 0.6rem; font-size: 0.85rem; }
  .zoom-row { display: flex; gap: 6px; margin-top: 0.25rem; align-items: stretch; }
  .zoom-group { display: flex; gap: 2px; flex: 1; }
  .shrink-toggle {
    padding: 0 0.75rem !important;
    height: 30px;
    font: 700 11px/1 'Crimson Pro', serif;
    white-space: nowrap;
  }
  .zoom-group button {
    flex: 1;
    height: 30px;
    padding: 0;
    font: 700 12px/1 'Crimson Pro', serif;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--panel-border, #5c4a32);
    background: transparent;
    color: inherit;
    border-radius: 3px;
    cursor: pointer;
  }
  .zoom-group button:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }
  .zoom-group button.active { background: var(--panel-accent, #c9a96e); color: #fff; border-color: var(--panel-accent, #c9a96e); }
</style>
