<script>
  import { TEXT_PRESETS } from '../../../src/components/map/tools.js';

  let {
    preset = $bindable('custom'),
    align = $bindable('center'),
    valign = $bindable('middle'),
    width = $bindable(0),
    height = $bindable(0),
    minZoom = $bindable(1),
    onApplyPreset,
  } = $props();



  // Picker order follows TEXT_PRESETS' insertion order (single source of
  // truth — reorder the keys in tools.js to reorder the picker).
  const orderedPresets = Object.entries(TEXT_PRESETS).map(([id, p]) => ({ id, ...p }));

  function styleFor(p) {
    const d = p || {};
    const parts = [];
    if (d.letterSpacing) parts.push(`letter-spacing: ${d.letterSpacing}px`);
    return parts.join('; ');
  }

  function classFor(p) {
    const d = p || {};
    const c = [
      d.colorClass || 'text-black',
      `font-${d.font || 'body'}`,
      `font-${d.weight || 'normal'}`,
    ];
    if (d.italic) c.push('italic');
    if (d.case === 'upper') c.push('uppercase');
    else if (d.case === 'title' || d.case === 'capitalize') c.push('capitalize');
    return c.join(' ');
  }
</script>

<div class="style-grid" role="radiogroup" aria-label="Text style">
  {#each orderedPresets as p}
    <button
      type="button"
      role="radio"
      aria-checked={preset === p.id}
      class={classFor(p)}
      class:active={preset === p.id}
      onclick={() => onApplyPreset?.(p.id)}
      style={styleFor(p)}
    >{p.label}</button>
  {/each}
</div>

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

  /* 2-column preset picker styled like PinProperties' Town grid. */
  .style-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    margin-bottom: 0.6rem;
  }
  .style-grid button {
    padding: var(--space-sm) 4px;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    border: 1px solid var(--panel-border, #5c4a32);
    background: transparent;
    border-radius: 3px;
    cursor: pointer;
    min-height: 40px;
  }
  .style-grid button:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }
  /* Lighter tan than the default accent so the parchment halo on the
     preset-colored text reads without the swatch going too dark. */
  .style-grid button.active { background: #d4b87a; border-color: #d4b87a; }

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
