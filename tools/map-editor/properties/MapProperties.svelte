<script>
  let {
    title = $bindable(),
    description = $bindable(),
  } = $props();
</script>

<label>
  Title
  <input type="text" bind:value={title} autocomplete="off" />
</label>

<label>
  Description
  <textarea bind:value={description} rows="8"></textarea>
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
</style>
