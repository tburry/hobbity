<script>
  import { PIN_PRESETS, findPreset } from '../../../src/components/map/tools.js';
  import { MARKER_SPRITE, MARKER_SIZES } from '../../../src/components/map/markers.generated.js';

  let {
    number = $bindable(''),
    cls = $bindable('shop'),
    minZoom = $bindable(0),
    labelOnly = $bindable(false),
    labelPos = $bindable('n'),
    anchor = $bindable('center'),
    tab = $bindable('town'),
  } = $props();

  // 8 compass positions arranged in a 3x3 grid (center is the marker).
  const LABEL_POSITIONS = [
    { id: 'nw', row: 1, col: 1, title: 'Label NW' },
    { id: 'n',  row: 1, col: 2, title: 'Label N'  },
    { id: 'ne', row: 1, col: 3, title: 'Label NE' },
    { id: 'w',  row: 2, col: 1, title: 'Label W'  },
    { id: 'e',  row: 2, col: 3, title: 'Label E'  },
    { id: 'sw', row: 3, col: 1, title: 'Label SW' },
    { id: 's',  row: 3, col: 2, title: 'Label S'  },
    { id: 'se', row: 3, col: 3, title: 'Label SE' },
  ];

  // Pin anchor: which point of the 28x28 pin box sits on the marker's
  // (x, y) image coordinate. 9 cells in DOM order fill the 3x3 grid.
  const ANCHOR_POSITIONS = [
    { id: 'nw',     title: 'Anchor NW' },
    { id: 'n',      title: 'Anchor N'  },
    { id: 'ne',     title: 'Anchor NE' },
    { id: 'w',      title: 'Anchor W'  },
    { id: 'center', title: 'Anchor Center' },
    { id: 'e',      title: 'Anchor E'  },
    { id: 'sw',     title: 'Anchor SW' },
    { id: 's',      title: 'Anchor S'  },
    { id: 'se',     title: 'Anchor SE' },
  ];


  const pinEntries = Object.entries(PIN_PRESETS).map(([id, p]) => ({ id, ...p }));
  // Picker order follows PIN_PRESETS' insertion order — reorder the
  // keys in tools.js to reorder the picker.
  const townPresets = pinEntries.filter(p => p.category === 'town');
  const overworldPresets = pinEntries.filter(p => p.category === 'overworld');

  // Largest authored viewBox dimension across the overworld set —
  // used to scale picker icons so each one reflects its on-map
  // proportions (capital reads bigger than village, etc.).
  const MAX_PICKER_PX = 20;
  const MAX_MARKER_DIM = Math.max(
    1,
    ...overworldPresets.map((p) => {
      const dims = MARKER_SIZES[p.id];
      return dims ? Math.max(dims[0], dims[1]) : 0;
    }),
  );
  function iconBoxStyle(id) {
    const dims = MARKER_SIZES[id];
    if (!dims) return '';
    const scale = MAX_PICKER_PX / MAX_MARKER_DIM;
    const w = (dims[0] * scale).toFixed(1);
    const h = (dims[1] * scale).toFixed(1);
    return `width: ${w}px; height: ${h}px;`;
  }

  // Active tab follows the currently-selected class. The tab is bound
  // to the parent so it survives this component's lifecycle and a new
  // marker opens on whichever tab the user worked from last.
  $effect(() => {
    const p = findPreset(cls);
    if (p?.category) tab = p.category;
  });

  function setTab(t) {
    tab = t;
  }

  function styleFor(preset) {
    const d = preset || {};
    const parts = [];
    if (d.italic) parts.push('font-style: italic');
    if (d.letterSpacing) parts.push(`letter-spacing: ${d.letterSpacing}px`);
    return parts.join('; ');
  }

  // Single tooltip shared across icon-grid buttons. Rendered as a sibling
  // (not inside the scrolling panel tree via position: fixed) and moved
  // to document.body on mount so clipping ancestors don't hide it.
  let tooltip = $state(null); // { preset, x, y, align }
  let ttEl = $state(null);

  function showTooltip(e, preset) {
    const btn = e.currentTarget;
    const r = btn.getBoundingClientRect();
    // Measure after mount with reported label; reposition after paint.
    tooltip = { preset, x: r.left + r.width / 2, y: r.top - 6, btnBottom: r.bottom };
    queueMicrotask(() => {
      if (!ttEl || !tooltip) return;
      const tw = ttEl.offsetWidth;
      const th = ttEl.offsetHeight;
      const margin = 4;
      let left = r.left + r.width / 2 - tw / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));
      let top = r.top - th - 6;
      if (top < margin) top = r.bottom + 6;
      tooltip = { ...tooltip, x: left, y: top, measured: true };
    });
  }

  function hideTooltip() { tooltip = null; }

  /** Portal action: move node to document.body so fixed-position escapes any
   * transformed/filtered ancestor and sits above all other UI layers. */
  function portal(node) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
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

{@html MARKER_SPRITE}

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
        class={classFor(p)}
        class:active={cls === p.id}
        class:full={p.id === 'poi'}
        onclick={() => cls = p.id}
        style={styleFor(p)}
      >{p.label}</button>
    {/each}
  </div>
{:else}
  <div class="icon-grid" role="radiogroup" aria-label="Marker type">
    {#each overworldPresets as p}
      <button
        type="button"
        role="radio"
        aria-checked={cls === p.id}
        class:active={cls === p.id}
        onclick={() => cls = p.id}
        aria-label={p.label}
        onmouseenter={(e) => showTooltip(e, p)}
        onmouseleave={hideTooltip}
        onfocus={(e) => showTooltip(e, p)}
        onblur={hideTooltip}
      >
        <span class="icon" style={iconBoxStyle(p.id)}>
          <svg viewBox="0 0 {MARKER_SIZES[p.id]?.[0] ?? 1} {MARKER_SIZES[p.id]?.[1] ?? 1}"><use href="#marker-{p.id}"/></svg>
        </span>
      </button>
    {/each}
  </div>
{/if}

<div class="pin-row">
  {#if tab === 'town'}
    <label class="pin-num">
      Pin #
      <input
        type="text"
        bind:value={number}
        placeholder="(no number)"
        autocomplete="off"
        maxlength="3"
      />
    </label>
  {/if}
  <fieldset class="label-pos-field">
    <legend>Label Align</legend>
    <div class="label-pos-grid" role="radiogroup" aria-label="Label position">
      {#each LABEL_POSITIONS as p}
        <button
          type="button"
          role="radio"
          aria-checked={labelPos === p.id}
          class="pos-cell pos-{p.id}"
          class:active={labelPos === p.id}
          title={p.title}
          aria-label={p.title}
          onclick={() => labelPos = p.id}
        ></button>
      {/each}
      <span class="pos-center" aria-hidden="true"></span>
    </div>
  </fieldset>
  <fieldset class="label-pos-field">
    <legend>Pin Anchor</legend>
    <div class="anchor-grid" role="radiogroup" aria-label="Pin anchor">
      {#each ANCHOR_POSITIONS as p}
        <button
          type="button"
          role="radio"
          aria-checked={anchor === p.id}
          class="anchor-cell"
          class:active={anchor === p.id}
          title={p.title}
          aria-label={p.title}
          onclick={() => anchor = p.id}
        ></button>
      {/each}
    </div>
  </fieldset>
  <button
    type="button"
    class="label-only-toggle"
    class:active={labelOnly}
    aria-pressed={labelOnly}
    title="Hide the marker body and show only the label. Marker stays visible at 50% while selected in edit mode."
    onclick={() => labelOnly = !labelOnly}
  >Label only</button>
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

{#if tooltip}
  <div
    use:portal
    bind:this={ttEl}
    class="preset-tt"
    class:measured={tooltip.measured}
    style="left: {tooltip.x}px; top: {tooltip.y}px;"
  >
    <span class={classFor(tooltip.preset)} style={styleFor(tooltip.preset)}>{tooltip.preset.label}</span>
  </div>
{/if}

<style>
  /* Portaled to document.body, so scoped class names can't reach it. */
  :global(.preset-tt) {
    position: fixed;
    padding: 0.3rem 0.6rem;
    background: #faf6f0;
    color: #3b2e1e;
    border: 1px solid #5c4a32;
    border-radius: 3px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 9999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    opacity: 0;
    transition: opacity 0.1s;
  }
  :global(.preset-tt.measured) { opacity: 1; }

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
    /* margin-top: var(--space, 16px); */
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
    border-radius: 3px;
    cursor: pointer;
    min-height: 40px;
  }
  .text-grid button:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }
  /* Lighter tan than the default accent so the parchment halo on the
     preset-colored text reads without the swatch going too dark. */
  .text-grid button.active { background: #d4b87a; border-color: #d4b87a; }
  .text-grid button.full { grid-column: 1 / -1; }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
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
  /* Icon size comes from inline style (set per-marker by iconBoxStyle)
     so the picker reflects on-map proportions. */
  .icon-grid button .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .icon-grid button .icon svg { width: 100%; height: 100%; display: block; }
  .icon-grid button:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }
  .icon-grid button.active { background: var(--panel-accent, #c9a96e); color: #fff; border-color: var(--panel-accent, #c9a96e); }
  /* Active button is dark; flip the icon so it reads white on the accent. */
  .icon-grid button.active .icon { filter: invert(1); }

  /* Compass picker: 8 dots in a 3x3 grid around a central marker dot.
     Each button uses explicit grid placement so the cardinal/diagonal
     positions map naturally. */
  .pin-row {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.6rem;
  }
  .pin-row .pin-num { margin-bottom: 0; width: 5.5rem; flex: 0 0 auto; }
  .pin-row .pin-num input { width: 100%; }

  .label-pos-field {
    border: none;
    padding: 0;
    margin: 0;
    font-size: 0.85rem;
  }
  .label-pos-field legend {
    padding: 0;
    font: inherit;
    margin-bottom: 0.2rem;
  }
  .label-pos-grid {
    display: grid;
    grid-template-columns: repeat(3, 22px);
    grid-template-rows: repeat(3, 22px);
    gap: 1px;
    background: var(--panel-border, #5c4a32);
    border: 1px solid var(--panel-border, #5c4a32);
    border-radius: 3px;
    width: fit-content;
    position: relative;
    overflow: hidden;
  }
  .label-pos-grid .pos-cell {
    width: 22px;
    height: 22px;
    margin: 0;
    padding: 0;
    border: none;
    background: var(--panel-bg, #fff);
    border-radius: 0;
    cursor: pointer;
  }
  .label-pos-grid .pos-cell:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }
  .label-pos-grid .pos-cell.active {
    background: var(--panel-accent, #5c4a32);
  }
  .label-pos-grid .pos-nw { grid-column: 1; grid-row: 1; }
  .label-pos-grid .pos-n  { grid-column: 2; grid-row: 1; }
  .label-pos-grid .pos-ne { grid-column: 3; grid-row: 1; }
  .label-pos-grid .pos-w  { grid-column: 1; grid-row: 2; }
  .label-pos-grid .pos-e  { grid-column: 3; grid-row: 2; }
  .label-pos-grid .pos-sw { grid-column: 1; grid-row: 3; }
  .label-pos-grid .pos-s  { grid-column: 2; grid-row: 3; }
  .label-pos-grid .pos-se { grid-column: 3; grid-row: 3; }
  .label-pos-grid .pos-center {
    grid-column: 2;
    grid-row: 2;
    width: 22px;
    height: 22px;
    background:
      radial-gradient(circle, var(--text, #3a332a) 0 3px, transparent 3.5px) center / 100% 100% no-repeat,
      var(--panel-bg, #fff);
    pointer-events: none;
  }

  /* Pin Anchor: all 9 cells are clickable. Same look as label-pos-grid
     but a filled grid (no separate center marker). */
  .anchor-grid {
    display: grid;
    grid-template-columns: repeat(3, 22px);
    grid-template-rows: repeat(3, 22px);
    gap: 1px;
    background: var(--panel-border, #5c4a32);
    border: 1px solid var(--panel-border, #5c4a32);
    border-radius: 3px;
    width: fit-content;
    overflow: hidden;
  }
  .anchor-grid .anchor-cell {
    width: 22px;
    height: 22px;
    margin: 0;
    padding: 0;
    border: none;
    background: var(--panel-bg, #fff);
    border-radius: 0;
    cursor: pointer;
  }
  .anchor-grid .anchor-cell:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }
  .anchor-grid .anchor-cell.active { background: var(--panel-accent, #5c4a32); }

  .label-only-toggle {
    align-self: flex-end;
    padding: 0 0.6rem;
    height: 24px;
    font: 700 11px/1 'Crimson Pro', serif;
    white-space: nowrap;
    border: 1px solid var(--panel-border, #5c4a32);
    background: transparent;
    color: inherit;
    border-radius: 3px;
    cursor: pointer;
  }
  .label-only-toggle:hover { background: var(--panel-hover, rgba(0,0,0,0.06)); }
  .label-only-toggle.active { background: var(--panel-accent, #c9a96e); color: #fff; border-color: var(--panel-accent, #c9a96e); }

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
