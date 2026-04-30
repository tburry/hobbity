<script>
  import { PATH_PRESETS } from '../../../src/components/map/tools.js';

  let {
    cls = $bindable('river'),
    mode = $bindable('straight'),
    textAlign = $bindable('center'),
    textBaseline = $bindable('baseline'),
    flip = $bindable(false),
    minZoom = $bindable(0),
    onModeChange,
  } = $props();

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

  function setMode(next) {
    if (mode === next) return;
    const prev = mode;
    mode = next;
    onModeChange?.(prev, next);
  }
</script>

<div class="style-grid" role="radiogroup" aria-label="Path style">
  {#each Object.entries(PATH_PRESETS) as [id, p]}
    <button
      type="button"
      role="radio"
      aria-checked={cls === id}
      class={classFor(p)}
      class:active={cls === id}
      onclick={() => cls = id}
      style={styleFor(p)}
    >{p.label}</button>
  {/each}
</div>

<div class="style-row">
  <div class="align-group" aria-label="Curve mode">
    <button type="button" class:active={mode === 'straight'} onclick={() => setMode('straight')}>Straight</button>
    <button type="button" class:active={mode === 'bezier'} onclick={() => setMode('bezier')}>Bezier</button>
  </div>
</div>

<div class="style-row">
  <div class="align-group" aria-label="Text alignment along path">
    <button type="button" title="Align left" aria-label="Align left" class:active={textAlign === 'left'} onclick={() => textAlign = 'left'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>
    </button>
    <button type="button" title="Align center" aria-label="Align center" class:active={textAlign === 'center'} onclick={() => textAlign = 'center'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/></svg>
    </button>
    <button type="button" title="Align right" aria-label="Align right" class:active={textAlign === 'right'} onclick={() => textAlign = 'right'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/></svg>
    </button>
  </div>
  <button
    type="button"
    class="flip-toggle"
    class:active={flip}
    aria-pressed={flip}
    title="Flip text to the other side of the path"
    onclick={() => flip = !flip}
  >Flip</button>
</div>

<div class="style-row">
  <div class="align-group" aria-label="Text vertical alignment on path">
    <button type="button" title="Path on top of text" aria-label="Path on top" class:active={textBaseline === 'top'} onclick={() => textBaseline = 'top'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="7" y2="7"/><text x="12" y="20" text-anchor="middle" font-size="11" stroke="none" fill="currentColor">Ag</text></svg>
    </button>
    <button type="button" title="Path through middle" aria-label="Middle" class:active={textBaseline === 'middle'} onclick={() => textBaseline = 'middle'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="13" y2="13"/><text x="12" y="17" text-anchor="middle" font-size="11" stroke="none" fill="currentColor">Ag</text></svg>
    </button>
    <button type="button" title="Path at baseline" aria-label="Baseline" class:active={textBaseline === 'baseline'} onclick={() => textBaseline = 'baseline'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="18" y2="18"/><text x="12" y="17" text-anchor="middle" font-size="11" stroke="none" fill="currentColor">Ag</text></svg>
    </button>
  </div>
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

  .style-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    margin-bottom: 0.6rem;
  }
  .style-grid button {
    padding: 0.5rem 0.6rem;
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
  .style-grid button.active { background: #d4b87a; border-color: #d4b87a; }

  .style-row {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
    margin-bottom: 0.6rem;
  }

  .align-group { display: flex; gap: 2px; flex: 1; }
  .align-group button {
    flex: 1;
    height: 30px;
    padding: 0;
    font: 700 11px/1 'Crimson Pro', serif;
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

  .flip-toggle {
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
  .flip-toggle:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }
  .flip-toggle.active { background: var(--panel-accent, #c9a96e); color: #fff; border-color: var(--panel-accent, #c9a96e); }

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
</style>
