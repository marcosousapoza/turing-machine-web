<script lang="ts">
  import MoonStar from '@lucide/svelte/icons/moon-star'
  import SunMedium from '@lucide/svelte/icons/sun-medium'
  import { mode, toggleMode } from 'mode-watcher'
</script>

<button
  type="button"
  aria-label="Toggle dark mode"
  class="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
  onclick={toggleMode}
>
  {#if mode.current === 'dark'}
    <SunMedium class="size-4" />
  {:else}
    <MoonStar class="size-4" />
  {/if}
</button>
