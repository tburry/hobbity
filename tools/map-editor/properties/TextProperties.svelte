<script>
  import { TEXT_PRESETS } from '../../../src/components/map/tools.js';

  let {
    preset = $bindable('custom'),
    align = $bindable('center'),
    valign = $bindable('middle'),
    width = $bindable(0),
    height = $bindable(0),
    minZoom = $bindable(1),
    shrink = $bindable(false),
    onApplyPreset,
  } = $props();
</script>

<label>
  Style
  <select value={preset} onchange={(e) => onApplyPreset?.(e.target.value)}>
    {#each TEXT_PRESETS as p}
      <option value={p.id}>{p.label}</option>
    {/each}
  </select>
</label>

<div class="style-row">
  <div class="align-group" aria-label="Horizontal alignment">
    <button type="button" title="Align left" aria-label="Align left" class:active={align === 'left'} onclick={() => align = 'left'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>
    </button>
    <button type="button" title="Align center" aria-label="Align center" class:active={align === 'center'} onclick={() => align = 'center'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/></svg>
    </button>
    <button type="button" title="Align right" aria-label="Align right" class:active={align === 'right'} onclick={() => align = 'right'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/></svg>
    </button>
  </div>
  <div class="align-group" aria-label="Vertical alignment">
    <button type="button" title="Align top" aria-label="Align top" class:active={valign === 'top'} onclick={() => valign = 'top'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="3" y2="3"/><line x1="7" x2="7" y1="9" y2="21"/><line x1="13" x2="13" y1="9" y2="15"/><line x1="19" x2="19" y1="9" y2="18"/></svg>
    </button>
    <button type="button" title="Align middle" aria-label="Align middle" class:active={valign === 'middle'} onclick={() => valign = 'middle'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="12" y2="12"/><line x1="7" x2="7" y1="6" y2="18"/><line x1="13" x2="13" y1="8" y2="16"/><line x1="19" x2="19" y1="4" y2="20"/></svg>
    </button>
    <button type="button" title="Align bottom" aria-label="Align bottom" class:active={valign === 'bottom'} onclick={() => valign = 'bottom'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="21" y2="21"/><line x1="7" x2="7" y1="3" y2="15"/><line x1="13" x2="13" y1="9" y2="15"/><line x1="19" x2="19" y1="6" y2="15"/></svg>
    </button>
  </div>
</div>

<div class="style-row">
  <label class="inline size">
    Size
    <input type="number" bind:value={width} min="0" step="1" />
    <span>×</span>
    <input type="number" bind:value={height} min="0" step="1" />
    <span>px</span>
  </label>
</div>

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
  label select, label input {
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

  .style-row {
    display: flex;
    gap: 0.5rem;
    align-items: end;
    margin-bottom: 0.6rem;
  }
  label.inline { font-size: 0.85rem; flex: 1; }
  label.inline.size { display: flex; align-items: center; gap: 0.3rem; }
  label.inline.size input { width: 70px; padding: 0.3rem; text-align: center; }
  .min-zoom-label { display: block; margin-bottom: 0.6rem; font-size: 0.85rem; }
  .zoom-row { display: flex; gap: 6px; margin-top: 0.25rem; align-items: stretch; }
  .zoom-group { display: flex; gap: 2px; flex: 1; }
  .shrink-toggle {
    padding: 0 0.75rem;
    height: 30px;
    font: 700 11px/1 'Crimson Pro', serif;
    white-space: nowrap;
    border: 1px solid var(--panel-border, #5c4a32);
    background: transparent;
    color: inherit;
    border-radius: 3px;
    cursor: pointer;
  }
  .shrink-toggle:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }
  .shrink-toggle.active { background: var(--panel-accent, #c9a96e); color: #fff; border-color: var(--panel-accent, #c9a96e); }
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

  .align-group { display: flex; gap: 2px; flex: 1; }
  .align-group button {
    flex: 1;
    height: 30px;
    padding: 0;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--panel-border, #5c4a32);
    background: transparent;
    color: inherit;
    border-radius: 3px;
    cursor: pointer;
  }
  .align-group button:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }
  .align-group button.active { background: var(--panel-accent, #c9a96e); color: #fff; border-color: var(--panel-accent, #c9a96e); }
  .align-group button svg { width: 16px; height: 16px; }
</style>
