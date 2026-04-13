<script>
  import { PIN_PRESETS, findPreset } from '../../../src/components/map/tools.js';

  let {
    number = $bindable(''),
    cls = $bindable('landmark'),
    minZoom = $bindable(0),
  } = $props();

  const FONTS = {
    body: "'Lora', serif",
    heading: "'Crimson Pro', serif",
    title: "'Uncial Antiqua', serif",
  };

  const townPresets = PIN_PRESETS.filter(p => p.category === 'town');
  const overworldPresets = PIN_PRESETS.filter(p => p.category === 'overworld');

  // Active tab follows the currently-selected class.
  let tab = $state('town');
  $effect(() => {
    const p = findPreset(cls);
    if (p?.category) tab = p.category;
  });

  function setTab(t) {
    tab = t;
    const p = findPreset(cls);
    if (p?.category !== t) {
      const first = PIN_PRESETS.find(q => q.category === t);
      if (first) cls = first.id;
    }
  }

  /** Inline CSS matching how this preset renders the label. */
  function styleFor(preset) {
    const d = preset.defaults || {};
    const parts = [
      `font-family: ${FONTS[d.font] || FONTS.body}`,
      `font-weight: ${d.bold ? 700 : 400}`,
      `font-style: ${d.italic ? 'italic' : 'normal'}`,
    ];
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
  <div class="text-grid" role="radiogroup" aria-label="Pin type">
    {#each townPresets as p}
      <button
        type="button"
        role="radio"
        aria-checked={cls === p.id}
        class:active={cls === p.id}
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
  <div class="icon-grid" role="radiogroup" aria-label="Pin type">
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
  <div class="zoom-group" role="radiogroup" aria-label="Minimum zoom level">
    {#each [0, 1, 2, 3, 4, 5, 6, 7] as z}
      <button
        type="button"
        role="radio"
        aria-checked={minZoom === z}
        class:active={minZoom === z}
        onclick={() => minZoom = z}
      >{z}</button>
    {/each}
  </div>
</label>

<style>
  label { display: block; margin-bottom: 0.6rem; font-size: 0.85rem; }
  label input {
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

  .tabs {
    display: flex;
    gap: 2px;
    margin-bottom: 0.6rem;
    border-bottom: 1px solid #5c4a32;
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
  .tabs button:hover { opacity: 0.85; background: rgba(255,255,255,0.04); }
  .tabs button.active { opacity: 1; border-bottom-color: #c9a96e; }

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
    border: 1px solid #5c4a32;
    background: #2a1f14;
    color: inherit;
    border-radius: 3px;
    cursor: pointer;
    min-height: 40px;
  }
  .text-grid button:hover { background: #3a2e20; }
  .text-grid button.active { background: #c9a96e; color: #3b2e1e; border-color: #c9a96e; }

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
    border: 1px solid #5c4a32;
    background: #2a1f14;
    color: inherit;
    border-radius: 3px;
    cursor: pointer;
  }
  .icon-grid button .icon { font-size: 20px; line-height: 1; }
  .icon-grid button:hover { background: #3a2e20; }
  .icon-grid button.active { background: #c9a96e; color: #3b2e1e; border-color: #c9a96e; }

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
  .zoom-group { display: flex; gap: 2px; margin-top: 0.25rem; }
  .zoom-group button {
    flex: 1;
    height: 30px;
    padding: 0;
    font: 700 12px/1 'Crimson Pro', serif;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #5c4a32;
    background: #2a1f14;
    color: inherit;
    border-radius: 3px;
    cursor: pointer;
  }
  .zoom-group button:hover { background: #3a2e20; }
  .zoom-group button.active { background: #c9a96e; color: #fff; border-color: #c9a96e; }
</style>
