<script>
  /**
   * Fullscreen read-only viewer wrapper. Listens for a `map-preview-open`
   * custom event (dispatched by MapPreview.astro) and mounts a MapViewer
   * in a dark lightbox overlay. Escape or the X button closes.
   */
  import MapViewer from './map/MapViewer.svelte';

  let {
    slug,
    title = slug,
    pins = [],
    halo = null,
    grid = null,
    labelScale = 1,
    markerLabelScale = 1,
    tileBasePath,
    tileMaxZoom,
    tileSize,
    imgWidth,
    imgHeight,
  } = $props();

  let open = $state(false);
  let leafletReady = $state(false);
  let fitMode = $state('bounds');

  // Per-map grid toggle, shared with the editor via the same
  // localStorage key so a preference set in one carries to the other.
  const gridKey = $derived(`map-editor:grid:${slug}`);
  let gridVisible = $state(true);
  function loadGridVisible() {
    if (typeof localStorage === 'undefined') return;
    const v = localStorage.getItem(gridKey);
    gridVisible = v === null ? true : v === '1';
  }
  function setGridVisible(v) {
    gridVisible = v;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(gridKey, v ? '1' : '0');
    }
  }

  const MOBILE_BREAKPOINT = 768;

  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

  /** Lazy-load Leaflet on first open so pages that never click the
   * preview don't pay the download cost. Deduped across multiple
   * overlays via data-* flags on the injected tags. */
  async function ensureLeaflet() {
    if (typeof window === 'undefined') return;
    if (window.L) { leafletReady = true; return; }
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      link.dataset.leaflet = 'true';
      document.head.appendChild(link);
    }
    const existing = document.querySelector('script[data-leaflet]');
    if (existing) {
      if (window.L) { leafletReady = true; return; }
      await new Promise((resolve) => existing.addEventListener('load', resolve, { once: true }));
      leafletReady = !!window.L;
      return;
    }
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = LEAFLET_JS;
      s.dataset.leaflet = 'true';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load Leaflet'));
      document.head.appendChild(s);
    });
    leafletReady = !!window.L;
  }

  /** Deep-link hash for this overlay: `#<slug>-map`. */
  const hash = $derived(`#${slug}-map`);
  // Tracks whether we pushed our own history entry. Lets close() decide
  // between `history.back()` (pop our entry — same effect as the browser
  // back button) and `replaceState` (drop the hash without stepping back
  // into a previous page the user didn't come from).
  let pushedEntry = false;

  function openOverlay() {
    fitMode = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches ? 'height' : 'bounds';
    loadGridVisible();
    open = true;
    ensureLeaflet();
    if (location.hash !== hash) {
      history.pushState(null, '', hash);
      pushedEntry = true;
    }
  }

  function close() {
    if (pushedEntry) {
      // Popping our pushed entry fires popstate/hashchange, which the
      // listener uses to set `open = false`. Avoids leaving a stale
      // hashed entry in history that forces a double-back to leave.
      pushedEntry = false;
      history.back();
    } else {
      open = false;
      if (location.hash === hash) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    }
  }

  $effect(() => {
    const openHandler = (e) => {
      if (e.detail?.slug !== slug) return;
      openOverlay();
    };
    const hashHandler = () => {
      if (location.hash === hash && !open) openOverlay();
      else if (location.hash !== hash && open) open = false;
    };
    window.addEventListener('map-preview-open', openHandler);
    window.addEventListener('hashchange', hashHandler);
    // Auto-open on mount if the page loaded with this overlay's hash.
    if (location.hash === hash) openOverlay();
    return () => {
      window.removeEventListener('map-preview-open', openHandler);
      window.removeEventListener('hashchange', hashHandler);
    };
  });

  // Scroll lock + Escape-to-close while the overlay is open. Capture
  // phase so Leaflet's keyboard handler (which can swallow events on
  // the focused map container) doesn't beat us to it.
  $effect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key.toLowerCase() === 'g' && grid?.shape) {
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
        e.stopPropagation();
        setGridVisible(!gridVisible);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey, true);
    };
  });
</script>

{#if open}
  <div class="map-overlay" role="dialog" aria-modal="true" aria-label={`${title} map`}>
    <button
      class="map-overlay-close"
      onpointerdown={(e) => { e.stopPropagation(); close(); }}
      aria-label="Close map"
    >×</button>
    {#if leafletReady}
      <MapViewer
        width={imgWidth}
        height={imgHeight}
        tiles={{ basePath: tileBasePath, maxZoom: tileMaxZoom, tileSize, width: imgWidth, height: imgHeight }}
        initialZoom={null}
        fit={fitMode}
        minZoom={0}
        maxZoom={tileMaxZoom}
        {pins}
        {halo}
        {grid}
        {gridVisible}
        {labelScale}
        {markerLabelScale}
        ongridtoggle={() => setGridVisible(!gridVisible)}
        editable={false}
      />
    {:else}
      <div class="map-overlay-loading" aria-live="polite">Loading map…</div>
    {/if}
  </div>
{/if}

<style>
  .map-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: #1a1a1a;
    display: flex;
  }
  /* MapViewer fills the overlay. The :global selector reaches through
     the component boundary without affecting other usages. */
  .map-overlay :global(.map-container) {
    flex: 1;
    background: transparent !important;
  }
  /* Match the Leaflet zoom buttons so all controls read as one set. */
  .map-overlay-close {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 1001;
    width: 30px;
    height: 30px;
    padding: 0;
    font: 700 22px/1 var(--body-font, 'Lora', serif);
    color: var(--text, #3a332a);
    background: var(--bg, #faf6f0);
    border: var(--border-width, 2px) solid var(--border, #c9a96e);
    border-radius: var(--border-radius, 5px);
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  }
  .map-overlay-close:hover { background: var(--accent-bg, #f3ece0); }
  .map-overlay-loading {
    margin: auto;
    color: #faf6f0;
    font-family: 'Crimson Pro', serif;
    font-style: italic;
    opacity: 0.8;
  }
</style>
