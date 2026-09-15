<template>
  <button
    type="button"
    class="sound-toggle press-scale"
    :aria-pressed="enabled"
    :aria-label="label"
    :title="label"
    :data-sound="enabled ? 'release' : 'pulse'"
    @click="toggle"
  >
    <span class="sound-icon icon-swap" aria-hidden="true">
      <Volume2 class="size-icon" :data-visible="enabled" />
      <VolumeX class="size-icon" :data-visible="!enabled" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Volume2, VolumeX } from "@lucide/vue"
import { useClickSound } from "@features/click-sound/index.js"

const { enabled, toggle } = useClickSound()

const label = computed(() => (enabled.value ? "关闭点击音效" : "开启点击音效"))
</script>

<style scoped>
.sound-toggle {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-icon-button);
  min-height: var(--size-icon-button);
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--ink-muted);
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth),
    scale var(--duration-fast) var(--ease-out);
}

.sound-toggle:hover {
  background: var(--hover-quiet);
  color: var(--ink);
}

.sound-icon {
  width: var(--size-icon);
  height: var(--size-icon);
}

@media (pointer: coarse) {
  .sound-toggle {
    width: var(--size-control);
    min-height: var(--size-control);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sound-toggle {
    transition: none;
  }
}
</style>
