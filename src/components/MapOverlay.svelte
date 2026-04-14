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
    tileBasePath,
    tileMaxZoom,
    tileSize,
    imgWidth,
    imgHeight,
  } = $props();

  let open = $state(false);
  let leafletReady = $state(false);
  let fitMode = $state('bounds');

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

  function close() { open = false; }

  $effect(() => {
    const handler = (e) => {
      if (e.detail?.slug !== slug) return;
      fitMode = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches ? 'height' : 'bounds';
      open = true;
      ensureLeaflet();
    };
    window.addEventListener('map-preview-open', handler);
    return () => window.removeEventListener('map-preview-open', handler);
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
